import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme.dart';
import '../../core/cache_service.dart';
import '../trips/trip_service.dart';
import '../shell/app_shell.dart';

// ─── Main Screen ────────────────────────────────────────────
/// Tabs: Chờ nhận | Đã nhận
class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;
  List<Map<String, dynamic>> _available = [];
  List<Map<String, dynamic>> _assigned  = [];
  List<Map<String, dynamic>> _history   = [];
  bool _loading = true;
  final _supabase = Supabase.instance.client;
  final _cache = CacheService.instance;

  // ── Realtime channels ──────────────────────────────────
  RealtimeChannel? _channelNew;
  RealtimeChannel? _channelMine;

  // ── Trip Assembly State ──────────────────────────────────
  final Set<String> _staged = {};
  bool _buildingTrip = false;

  // ── Lazy load flags ─────────────────────────────────────
  bool _historyLoaded = false;
  bool _historyLoadingMore = false;
  bool _historyHasMore = true;
  static const _historyPageSize = 20;
  final ScrollController _historyScroll = ScrollController();

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 3, vsync: this);
    _tabCtrl.addListener(_onTabChanged);
    _fetchOrders();
    _subscribeRealtime();
    _historyScroll.addListener(_onHistoryScroll);
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    _channelNew?.unsubscribe();
    _channelMine?.unsubscribe();
    _historyScroll.dispose();
    super.dispose();
  }

  void _onTabChanged() {
    if (_tabCtrl.index == 2 && !_historyLoaded) {
      _fetchHistory();
    }
  }

  void _onHistoryScroll() {
    if (_historyScroll.position.pixels >= _historyScroll.position.maxScrollExtent - 200) {
      _loadMoreHistory();
    }
  }

  void _subscribeRealtime() {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return;

    // Channel 1: new pending orders (INSERT on orders table)
    _channelNew = _supabase
        .channel('orders_new_pending')
        .onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: 'orders',
          callback: (payload) {
            final rec = payload.newRecord;
            if (rec['status'] == 'pending') {
              _cache.invalidatePrefix('orders_');
              _fetchOrders();
            }
          },
        )
        .subscribe();

    // Channel 2: updates to orders assigned to me
    _channelMine = _supabase
        .channel('orders_mine_$userId')
        .onPostgresChanges(
          event: PostgresChangeEvent.update,
          schema: 'public',
          table: 'orders',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'assigned_to',
            value: userId,
          ),
          callback: (_) {
            _cache.invalidatePrefix('orders_');
            _fetchOrders();
          },
        )
        .subscribe();
  }

  Future<void> _fetchOrders() async {
    // Stale-while-revalidate: show cached data immediately
    final cachedAvail = _cache.peek<List<Map<String, dynamic>>>('orders_available');
    final cachedAssigned = _cache.peek<List<Map<String, dynamic>>>('orders_assigned');
    if (cachedAvail != null && _available.isEmpty) {
      setState(() { _available = cachedAvail; _assigned = cachedAssigned ?? []; _loading = false; });
    } else {
      setState(() => _loading = true);
    }

    final userId = _supabase.auth.currentUser?.id;
    try {
      final selectQuery = '''
        *,
        pickup_location:locations!orders_pickup_location_id_fkey(id, name, address, lat, lng),
        delivery_location:locations!orders_delivery_location_id_fkey(id, name, address, lat, lng),
        assigned_driver:profiles!orders_assigned_to_fkey(id, full_name)
      ''';

      final availRes = await _supabase
          .from('orders')
          .select(selectQuery)
          .eq('status', 'pending')
          .order('created_at', ascending: false)
          .limit(50);

      List<Map<String, dynamic>> assignedRes = [];
      if (userId != null) {
        assignedRes = await _supabase
            .from('orders')
            .select(selectQuery)
            .eq('assigned_to', userId)
            .eq('status', 'assigned')
            .order('created_at', ascending: false)
            .limit(50);
      }

      final avail = List<Map<String, dynamic>>.from(availRes);
      final assigned = List<Map<String, dynamic>>.from(assignedRes);

      // Cache results
      _cache.set('orders_available', avail, ttl: const Duration(minutes: 1));
      _cache.set('orders_assigned', assigned, ttl: const Duration(minutes: 1));

      if (mounted) {
        setState(() {
          _available = avail;
          _assigned  = assigned;
          _loading   = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Lazy-loaded: only called when user switches to History tab
  Future<void> _fetchHistory() async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return;
    try {
      final selectQuery = '''
        *,
        pickup_location:locations!orders_pickup_location_id_fkey(id, name, address, lat, lng),
        delivery_location:locations!orders_delivery_location_id_fkey(id, name, address, lat, lng),
        assigned_driver:profiles!orders_assigned_to_fkey(id, full_name)
      ''';
      final historyRes = await _supabase
          .from('orders')
          .select(selectQuery)
          .eq('assigned_to', userId)
          .inFilter('status', ['delivered', 'failed', 'cancelled'])
          .order('delivered_at', ascending: false)
          .limit(_historyPageSize);
      if (mounted) {
        setState(() {
          _history = List<Map<String, dynamic>>.from(historyRes);
          _historyLoaded = true;
          _historyHasMore = historyRes.length >= _historyPageSize;
        });
      }
    } catch (_) {}
  }

  /// Pagination: next page of history
  Future<void> _loadMoreHistory() async {
    if (_historyLoadingMore || !_historyHasMore) return;
    _historyLoadingMore = true;
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) { _historyLoadingMore = false; return; }
    try {
      final selectQuery = '''
        *,
        pickup_location:locations!orders_pickup_location_id_fkey(id, name, address, lat, lng),
        delivery_location:locations!orders_delivery_location_id_fkey(id, name, address, lat, lng),
        assigned_driver:profiles!orders_assigned_to_fkey(id, full_name)
      ''';
      final moreRes = await _supabase
          .from('orders')
          .select(selectQuery)
          .eq('assigned_to', userId)
          .inFilter('status', ['delivered', 'failed', 'cancelled'])
          .order('delivered_at', ascending: false)
          .range(_history.length, _history.length + _historyPageSize - 1);
      if (mounted) {
        setState(() {
          _history.addAll(List<Map<String, dynamic>>.from(moreRes));
          _historyHasMore = moreRes.length >= _historyPageSize;
        });
      }
    } catch (_) {}
    _historyLoadingMore = false;
  }

  bool _claiming = false;

  Future<void> _claimOrder(String orderId) async {
    if (_claiming) return;
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return;
    setState(() => _claiming = true);
    try {
      await _supabase.from('orders').update({
        'assigned_to': userId,
        'status': 'assigned',
      }).eq('id', orderId);

      _cache.invalidatePrefix('orders_');
      await _fetchOrders();

      if (mounted) {
        // Switch to Tab 2 (Đã nhận) so driver sees the order moved there
        _tabCtrl.animateTo(1);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('✓ Đã nhận đơn — xem trong tab "Đã nhận"'),
            backgroundColor: Color(0xFF059669),
            duration: Duration(seconds: 3),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Lỗi nhận đơn: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _claiming = false);
    }
  }

  // ── Stage / unstage ────────────────────────────────────
  Future<void> _toggleStage(String orderId) async {
    final isAdding = !_staged.contains(orderId);
    setState(() {
      if (isAdding) { _staged.add(orderId); }
      else           { _staged.remove(orderId); }
    });
    // Immediately write status to DB for real-time visibility on web
    try {
      await _supabase.from('orders').update({
        'status': isAdding ? 'staging' : 'assigned',
      }).eq('id', orderId);
    } catch (_) {
      // Revert local state if DB failed
      setState(() {
        if (isAdding) { _staged.remove(orderId); }
        else           { _staged.add(orderId); }
      });
    }
  }

  // Revert all staged orders back to 'assigned' and clear selection
  Future<void> _cancelTripMode() async {
    final toRevert = _staged.toList();
    setState(() => _staged.clear());
    if (toRevert.isEmpty) return;
    try {
      await _supabase.from('orders')
          .update({'status': 'assigned'})
          .inFilter('id', toRevert);
    } catch (_) {}
  }

  // ── Start trip: create trip + set orders in_transit ──────
  Future<void> _startTrip() async {
    if (_staged.isEmpty || _buildingTrip) return;
    setState(() => _buildingTrip = true);
    Navigator.of(context).pop(); // close bottom sheet
    try {
      final tripId = await TripService.createAndStartTrip(_staged.toList());
      // Note: TripService.createAndStartTrip already sets status → in_transit

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('✓ Đã bắt đầu chuyến giao!'),
            backgroundColor: Color(0xFF059669),
            duration: Duration(seconds: 2),
          ),
        );
        setState(() => _staged.clear());
        await _fetchOrders();
        await Future.delayed(const Duration(milliseconds: 300));
        if (mounted) context.go('/trips/$tripId');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Lỗi: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _buildingTrip = false);
    }
  }

  // ── Open trip assembly bottom sheet ──────────────────────
  void _openTripSheet() {
    final stagedOrders = _assigned
        .where((o) => _staged.contains(o['id'] as String))
        .toList();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _TripAssemblySheet(
        stagedOrders: stagedOrders,
        onStart: _startTrip,
        onRemove: (id) async {
          Navigator.of(context).pop();
          await _toggleStage(id); // writes 'assigned' back to DB
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFEFF6FF),
      appBar: AppBar(
        title: const Text('Đơn hàng'),
        bottom: TabBar(
          controller: _tabCtrl,
          isScrollable: false,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white60,
          indicatorColor: Colors.white,
          indicatorWeight: 3,
          dividerColor: Colors.transparent,
          labelStyle: GoogleFonts.outfit(fontWeight: FontWeight.w700, fontSize: 12),
          unselectedLabelStyle: GoogleFonts.outfit(fontWeight: FontWeight.w500, fontSize: 12),
          tabs: [
            Tab(text: 'Chờ nhận (${_available.length})'),
            Tab(text: 'Đã nhận (${_assigned.length})'),
            Tab(text: 'Lịch sử (${_history.length})'),
          ],
        ),
        actions: [
          IconButton(icon: const Icon(Icons.refresh_rounded), onPressed: _fetchOrders),
          const HamburgerMenu(),
          const SizedBox(width: 4),
        ],
      ),
      body: Stack(
        children: [
          _loading
              ? const Center(child: CircularProgressIndicator())
              : TabBarView(
                  controller: _tabCtrl,
                  children: [
                    _buildAvailableList(),
                    _buildAssignedList(),
                    _buildHistoryList(),
                  ],
                ),
          // ── Floating trip bubble ───────────────────────
          if (_staged.isNotEmpty)
            Positioned(
              bottom: 16, left: 24, right: 24,
              child: _TripBubble(
                count: _staged.length,
                onTap: _openTripSheet,
                onCancel: _cancelTripMode,
              ),
            ),
        ],
      ),
    );
  }

  // ─── Tab 1: Available (pending) ─────────────────────────
  Widget _buildAvailableList() {
    if (_available.isEmpty) {
      return _emptyState(Icons.inbox_rounded, 'Không có đơn chờ nhận');
    }
    return RefreshIndicator(
      onRefresh: _fetchOrders,
      child: ListView.builder(
        padding: EdgeInsets.fromLTRB(0, 8, 0, _staged.isNotEmpty ? 88 : 8),
        itemCount: _available.length,
        itemBuilder: (_, i) => _AvailableCard(
          order: _available[i],
          onClaim: () => _claimOrder(_available[i]['id']),
          onTap: () => context.go('/orders/${_available[i]['id']}'),
        ),
      ),
    );
  }

  // ─── Tab 2: Assigned (long-press to add to trip) ────────
  Widget _buildAssignedList() {
    if (_assigned.isEmpty) {
      return _emptyState(Icons.task_alt_rounded, 'Chưa có đơn đã nhận');
    }
    return RefreshIndicator(
      onRefresh: _fetchOrders,
      child: ListView.builder(
        padding: EdgeInsets.fromLTRB(0, 8, 0, _staged.isNotEmpty ? 88 : 8),
        itemCount: _assigned.length,
        itemBuilder: (_, i) {
          final orderId = _assigned[i]['id'] as String;
          final isStaged = _staged.contains(orderId);
          return _AssignedCard(
            order: _assigned[i],
            isStaged: isStaged,
            onTap: () => context.go('/orders/$orderId'),
            onLongPress: () {
              HapticFeedback.mediumImpact();
              _toggleStage(orderId);
            },
            onAdd: () => _toggleStage(orderId),
          );
        },
      ),
    );
  }

  // ─── Tab 3: Lịch sử (delivered / failed / cancelled) ────
  Widget _buildHistoryList() {
    if (!_historyLoaded) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_history.isEmpty) {
      return _emptyState(Icons.history_rounded, 'Chưa có lịch sử giao hàng');
    }
    return RefreshIndicator(
      onRefresh: _fetchHistory,
      child: ListView.builder(
        controller: _historyScroll,
        padding: const EdgeInsets.symmetric(vertical: 8),
        itemCount: _history.length + (_historyHasMore ? 1 : 0),
        itemBuilder: (_, i) {
          if (i >= _history.length) {
            return const Padding(
              padding: EdgeInsets.all(16),
              child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
            );
          }
          final o = _history[i];
          final status = o['status'] as String? ?? '';
          final Color statusColor;
          final String statusLabel;
          switch (status) {
            case 'delivered':
              statusColor = const Color(0xFF059669);
              statusLabel = 'Đã giao';
            case 'failed':
              statusColor = const Color(0xFFDC2626);
              statusLabel = 'Thất bại';
            default:
              statusColor = const Color(0xFF94A3B8);
              statusLabel = 'Đã huỷ';
          }
          final loc = (o['delivery_location'] as Map?) ?? {};
          final delivAt = o['delivered_at'] as String?;

          return Container(
            margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0)),
              boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 4, offset: const Offset(0, 2))],
            ),
            child: Material(
              color: Colors.transparent,
              borderRadius: BorderRadius.circular(16),
              child: InkWell(
                onTap: () => context.go('/orders/${o['id']}'),
                borderRadius: BorderRadius.circular(16),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Row(children: [
                    // 44px icon box
                    Container(
                      width: 44, height: 44,
                      decoration: BoxDecoration(
                        color: statusColor.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(
                        status == 'delivered' ? Icons.check_circle_rounded
                        : status == 'failed'  ? Icons.cancel_rounded
                        : Icons.remove_circle_rounded,
                        color: statusColor, size: 22,
                      ),
                    ),
                    const SizedBox(width: 12),
                    // Info
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(o['code'] as String? ?? '—',
                            style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w700, color: const Color(0xFF0F172A))),
                        const SizedBox(height: 3),
                        if (loc['name'] != null)
                          Row(children: [
                            const Icon(Icons.location_on_rounded, size: 12, color: Color(0xFFD97706)),
                            const SizedBox(width: 4),
                            Expanded(child: Text(loc['name'] as String,
                                style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                                maxLines: 1, overflow: TextOverflow.ellipsis)),
                          ]),
                        if (delivAt != null)
                          Text(_fmtDate(delivAt),
                              style: const TextStyle(fontSize: 11, color: Color(0xFFCBD5E1))),
                      ]),
                    ),
                    // Status badge
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: statusColor.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(statusLabel,
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: statusColor)),
                    ),
                    const SizedBox(width: 4),
                    const Icon(Icons.chevron_right_rounded, size: 20, color: Color(0xFFCBD5E1)),
                  ]),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  String _fmtDate(String ts) {
    try {
      final dt = DateTime.parse(ts).toLocal();
      return '${dt.day.toString().padLeft(2,'0')}/${dt.month.toString().padLeft(2,'0')} ${dt.hour.toString().padLeft(2,'0')}:${dt.minute.toString().padLeft(2,'0')}';
    } catch (_) { return ''; }
  }

  Widget _emptyState(IconData icon, String label) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 56, color: Colors.grey[300]),
          const SizedBox(height: 12),
          Text(label, style: TextStyle(fontSize: 15, color: Colors.grey[500])),
        ],
      ),
    );
  }
}

// ─── Available Order Card (Voucher-style) ────────────────────
class _AvailableCard extends StatelessWidget {
  final Map<String, dynamic> order;
  final VoidCallback onClaim;
  final VoidCallback onTap;
  const _AvailableCard({required this.order, required this.onClaim, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final pickup   = order['pickup_location']   as Map<String, dynamic>?;
    final delivery = order['delivery_location'] as Map<String, dynamic>?;
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 4, offset: const Offset(0, 2))],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Container(
                    width: 44, height: 44,
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF3C7),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.inventory_2_outlined, size: 22, color: Color(0xFFD97706)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Text(order['code']?.toString() ?? '—',
                          style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w700, color: const Color(0xFF0F172A))),
                      const SizedBox(width: 8),
                      _statusBadge('pending'),
                    ]),
                    const SizedBox(height: 2),
                    Text(_formatTime(order['created_at']),
                        style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
                  ])),
                ]),
                const SizedBox(height: 12),
                _routeRow(Icons.circle, const Color(0xFF06B6D4), pickup?['name'] ?? '—'),
                Padding(padding: const EdgeInsets.only(left: 5),
                    child: Container(width: 1.5, height: 10, color: const Color(0xFFE2E8F0))),
                _routeRow(Icons.location_on_rounded, const Color(0xFFD97706), delivery?['name'] ?? '—'),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: onClaim,
                    icon: const Icon(Icons.add_task_rounded, size: 17),
                    label: Text('Nhận đơn này', style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF0891B2),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ─── Assigned Order Card (Voucher-style, long-press for trip) ─
class _AssignedCard extends StatelessWidget {
  final Map<String, dynamic> order;
  final bool isStaged;
  final VoidCallback onTap;
  final VoidCallback onLongPress;
  final VoidCallback onAdd;
  const _AssignedCard({
    required this.order, required this.isStaged,
    required this.onTap, required this.onLongPress, required this.onAdd,
  });

  @override
  Widget build(BuildContext context) {
    final pickup   = order['pickup_location']   as Map<String, dynamic>?;
    final delivery = order['delivery_location'] as Map<String, dynamic>?;
    return Opacity(
      opacity: isStaged ? 0.5 : 1.0,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        decoration: BoxDecoration(
          color: isStaged ? const Color(0xFFF0FDFA) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isStaged ? const Color(0xFF06B6D4) : const Color(0xFFE2E8F0),
            width: isStaged ? 2 : 1,
          ),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 4, offset: const Offset(0, 2))],
        ),
        child: Material(
          color: Colors.transparent,
          borderRadius: BorderRadius.circular(16),
          child: InkWell(
            onTap: onTap,
            onLongPress: onLongPress,
            borderRadius: BorderRadius.circular(16),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 44px icon box (cyan)
                  Container(
                    width: 44, height: 44,
                    decoration: BoxDecoration(
                      color: const Color(0xFFECFEFF),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.assignment_turned_in_outlined, size: 22, color: Color(0xFF0891B2)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(children: [
                          Text(order['code']?.toString() ?? '—',
                              style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w700, color: const Color(0xFF0F172A))),
                          const SizedBox(width: 8),
                          _statusBadge('assigned'),
                        ]),
                        const SizedBox(height: 2),
                        Text(_formatTime(order['created_at']),
                            style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
                        const SizedBox(height: 8),
                        _routeRow(Icons.circle, const Color(0xFF06B6D4), pickup?['name'] ?? '—'),
                        Padding(padding: const EdgeInsets.only(left: 5),
                            child: Container(width: 1.5, height: 10, color: const Color(0xFFE2E8F0))),
                        _routeRow(Icons.location_on_rounded, const Color(0xFFD97706), delivery?['name'] ?? '—'),
                        if (!isStaged) ...[
                          const SizedBox(height: 6),
                          Row(children: [
                            Icon(Icons.touch_app_rounded, size: 12, color: Colors.grey[400]),
                            const SizedBox(width: 4),
                            Text('Nhấn giữ để thêm vào chuyến',
                                style: TextStyle(fontSize: 11, color: Colors.grey[400])),
                          ]),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: 6),
                  GestureDetector(
                    onTap: onAdd,
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      width: 36, height: 36,
                      decoration: BoxDecoration(
                        color: isStaged ? const Color(0xFF06B6D4) : const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: isStaged ? const Color(0xFF06B6D4) : const Color(0xFFE2E8F0)),
                      ),
                      child: Center(
                        child: Icon(
                          isStaged ? Icons.check_rounded : Icons.add_rounded,
                          color: isStaged ? Colors.white : const Color(0xFF94A3B8),
                          size: 20,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ─── Floating Trip Bubble ────────────────────────────────────
class _TripBubble extends StatelessWidget {
  final int count;
  final VoidCallback onTap;
  final VoidCallback onCancel;
  const _TripBubble({required this.count, required this.onTap, required this.onCancel});

  @override
  Widget build(BuildContext context) {
    return Material(
      borderRadius: BorderRadius.circular(20),
      elevation: 8,
      shadowColor: const Color(0xFF0891B2).withValues(alpha: 0.4),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF0A3444), Color(0xFF0C4A6E)],
              begin: Alignment.topLeft, end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Row(
            children: [
              Container(
                width: 40, height: 40,
                decoration: BoxDecoration(
                  color: const Color(0xFF0891B2).withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    const Icon(Icons.local_shipping_rounded, color: Colors.white, size: 22),
                    Positioned(
                      top: 2, right: 2,
                      child: Container(
                        padding: const EdgeInsets.all(3),
                        decoration: const BoxDecoration(
                          color: Color(0xFF06B6D4),
                          shape: BoxShape.circle,
                        ),
                        child: Text('$count',
                            style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w800)),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Chuyến đang xếp',
                        style: GoogleFonts.outfit(color: Colors.white70, fontSize: 11)),
                    Text('$count đơn • Nhấn để xem',
                        style: GoogleFonts.outfit(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w700)),
                  ],
                ),
              ),
              GestureDetector(
                onTap: onCancel,
                child: Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.close_rounded, color: Colors.white70, size: 16),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Trip Assembly Bottom Sheet ──────────────────────────────
class _TripAssemblySheet extends StatelessWidget {
  final List<Map<String, dynamic>> stagedOrders;
  final VoidCallback onStart;
  final void Function(String orderId) onRemove;
  const _TripAssemblySheet({required this.stagedOrders, required this.onStart, required this.onRemove});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 0, 12, 24),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.all(Radius.circular(24)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Handle
          Center(
            child: Container(
              width: 40, height: 4,
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(color: Colors.grey[200], borderRadius: BorderRadius.circular(2)),
            ),
          ),
          // Title
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFF0891B2).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.local_shipping_rounded, color: Color(0xFF0891B2), size: 22),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Danh sách chuyến',
                      style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w700, color: const Color(0xFF0f172a))),
                  Text('${stagedOrders.length} đơn đã chọn',
                      style: const TextStyle(fontSize: 12, color: Color(0xFF64748b))),
                ],
              ),
            ],
          ),
          const SizedBox(height: 16),
          // Order list
          if (stagedOrders.isNotEmpty)
            Container(
              constraints: const BoxConstraints(maxHeight: 240),
              child: SingleChildScrollView(
                child: Column(
                  children: stagedOrders.map((o) {
                    final delivery = o['delivery_location'] as Map<String, dynamic>?;
                    return Container(
                      margin: const EdgeInsets.only(bottom: 6),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.location_on_rounded, size: 15, color: Color(0xFFD97706)),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(o['code']?.toString() ?? '—',
                                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF0f172a))),
                                Text(delivery?['name'] ?? '—',
                                    style: const TextStyle(fontSize: 12, color: Color(0xFF64748b))),
                              ],
                            ),
                          ),
                          GestureDetector(
                            onTap: () => onRemove(o['id'] as String),
                            child: const Icon(Icons.remove_circle_outline_rounded, size: 18, color: Color(0xFF94A3B8)),
                          ),
                        ],
                      ),
                    );
                  }).toList(),
                ),
              ),
            ),
          const SizedBox(height: 16),
          // Start button
          SizedBox(
            width: double.infinity,
            height: 52,
            child: FilledButton.icon(
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF059669),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              onPressed: stagedOrders.isEmpty ? null : onStart,
              icon: const Icon(Icons.play_arrow_rounded, size: 22),
              label: Text(
                'Bắt đầu giao chuyến này',
                style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w700),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Shared helper widgets ────────────────────────────────────
Widget _codeChip(String code) => Container(
  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
  decoration: BoxDecoration(color: const Color(0xFF0A3444), borderRadius: BorderRadius.circular(6)),
  child: Text(code, style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white, letterSpacing: 0.5)),
);

Widget _statusBadge(String status) {
  final color = AppTheme.statusColors[status] ?? Colors.grey;
  final label = AppTheme.statusLabels[status] ?? status;
  return Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
    decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
    child: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color)),
  );
}

Widget _routeRow(IconData icon, Color color, String text) {
  return Row(children: [
    Icon(icon, size: 11, color: color),
    const SizedBox(width: 8),
    Expanded(
      child: Text(text,
        style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.black87),
        maxLines: 1, overflow: TextOverflow.ellipsis),
    ),
  ]);
}

String _formatTime(dynamic ts) {
  if (ts == null) return '';
  try {
    final dt = DateTime.parse(ts.toString()).toLocal();
    return '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')} '
        '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  } catch (_) {
    return '';
  }
}
