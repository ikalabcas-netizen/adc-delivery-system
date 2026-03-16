import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme.dart';
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
  bool _loading = true;
  final _supabase = Supabase.instance.client;

  // ── Trip Assembly State ──────────────────────────────────
  /// Orders staged (selected) for the current trip
  final Set<String> _staged = {};
  bool _buildingTrip = false;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
    _fetchOrders();
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetchOrders() async {
    setState(() => _loading = true);
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

      if (mounted) {
        setState(() {
          _available = List<Map<String, dynamic>>.from(availRes);
          _assigned  = List<Map<String, dynamic>>.from(assignedRes);
          _loading   = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _claimOrder(String orderId) async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return;
    try {
      await _supabase.from('orders').update({
        'assigned_to': userId,
        'status': 'assigned',
      }).eq('id', orderId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('✓ Đã nhận đơn')),
        );
      }
      _fetchOrders();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Lỗi: $e')),
        );
      }
    }
  }

  // ── Stage / unstage an order ─────────────────────────────
  void _toggleStage(String orderId) {
    setState(() {
      if (_staged.contains(orderId)) {
        _staged.remove(orderId);
      } else {
        _staged.add(orderId);
      }
    });
  }

  void _cancelTripMode() {
    setState(() => _staged.clear());
  }

  // ── Start trip: create trip + set orders in_transit ──────
  Future<void> _startTrip() async {
    if (_staged.isEmpty || _buildingTrip) return;
    setState(() => _buildingTrip = true);
    Navigator.of(context).pop(); // close bottom sheet
    try {
      // Mark staged orders as staging in DB first
      await _supabase
          .from('orders')
          .update({'status': 'staging'})
          .inFilter('id', _staged.toList());

      final tripId = await TripService.createAndStartTrip(_staged.toList());

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
        onRemove: (id) {
          Navigator.of(context).pop();
          _toggleStage(id);
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
          tabs: [
            Tab(text: 'Chờ nhận (${_available.length})'),
            Tab(text: 'Đã nhận (${_assigned.length})'),
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

// ─── Available Order Card ────────────────────────────────────
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
        color: Colors.white, borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFD97706).withValues(alpha: 0.2)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 6, offset: const Offset(0, 2))],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    _codeChip(order['code']?.toString() ?? '—'),
                    const SizedBox(width: 8),
                    _statusBadge('pending'),
                    const Spacer(),
                    Text(_formatTime(order['created_at']),
                        style: TextStyle(fontSize: 11, color: Colors.grey[400])),
                  ],
                ),
                const SizedBox(height: 10),
                _routeRow(Icons.fiber_manual_record, const Color(0xFF06B6D4), pickup?['name'] ?? '—'),
                Padding(padding: const EdgeInsets.only(left: 5),
                    child: Container(width: 1.5, height: 10, color: Colors.grey[200])),
                _routeRow(Icons.location_on_rounded, const Color(0xFFD97706), delivery?['name'] ?? '—'),
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: onClaim,
                    icon: const Icon(Icons.add_task_rounded, size: 17),
                    label: const Text('Nhận đơn này'),
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

// ─── Assigned Order Card (long-press for trip) ───────────────
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
      opacity: isStaged ? 0.45 : 1.0,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        decoration: BoxDecoration(
          color: isStaged ? const Color(0xFFECFEFF) : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isStaged ? const Color(0xFF06B6D4) : const Color(0xFFE2E8F0),
            width: isStaged ? 2 : 1,
          ),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 6, offset: const Offset(0, 2))],
        ),
        child: Material(
          color: Colors.transparent,
          borderRadius: BorderRadius.circular(14),
          child: InkWell(
            onTap: onTap,
            onLongPress: onLongPress,
            borderRadius: BorderRadius.circular(14),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            _codeChip(order['code']?.toString() ?? '—'),
                            const SizedBox(width: 8),
                            _statusBadge('assigned'),
                            const Spacer(),
                            Text(_formatTime(order['created_at']),
                                style: TextStyle(fontSize: 11, color: Colors.grey[400])),
                          ],
                        ),
                        const SizedBox(height: 10),
                        _routeRow(Icons.fiber_manual_record, const Color(0xFF06B6D4), pickup?['name'] ?? '—'),
                        Padding(padding: const EdgeInsets.only(left: 5),
                            child: Container(width: 1.5, height: 10, color: Colors.grey[200])),
                        _routeRow(Icons.location_on_rounded, const Color(0xFFD97706), delivery?['name'] ?? '—'),
                        if (!isStaged) ...[
                          const SizedBox(height: 8),
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
                  const SizedBox(width: 8),
                  // Stage toggle button
                  GestureDetector(
                    onTap: onAdd,
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      width: 36, height: 36,
                      decoration: BoxDecoration(
                        color: isStaged ? const Color(0xFF06B6D4) : Colors.grey.shade100,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: isStaged ? const Color(0xFF06B6D4) : Colors.grey.shade300,
                        ),
                      ),
                      child: Center(
                        child: Icon(
                          isStaged ? Icons.check_rounded : Icons.add_rounded,
                          color: isStaged ? Colors.white : Colors.grey.shade500,
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
