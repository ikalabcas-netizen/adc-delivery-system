import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:google_fonts/google_fonts.dart';
import '../shell/app_shell.dart';

class TripsScreen extends StatefulWidget {
  const TripsScreen({super.key});
  @override
  State<TripsScreen> createState() => _TripsScreenState();
}

class _TripsScreenState extends State<TripsScreen>
    with SingleTickerProviderStateMixin {
  final _supabase = Supabase.instance.client;
  List<Map<String, dynamic>> _active    = [];
  List<Map<String, dynamic>> _completed = [];
  bool _loading = true;
  RealtimeChannel? _channel;
  late TabController _tabCtrl;

  // ── Lazy load / pagination ──────────────────────────────
  bool _completedLoaded = false;
  bool _completedLoadingMore = false;
  bool _completedHasMore = true;
  static const _pageSize = 20;
  final ScrollController _completedScroll = ScrollController();

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
    _tabCtrl.addListener(_onTabChanged);
    _fetchActive();
    _subscribeRealtime();
    _completedScroll.addListener(_onCompletedScroll);
  }

  void _subscribeRealtime() {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return;
    _channel = _supabase
        .channel('trips_list_$userId')
        .onPostgresChanges(
          event: PostgresChangeEvent.update,
          schema: 'public',
          table: 'trips',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'driver_id',
            value: userId,
          ),
          callback: (_) {
            _fetchActive();
            if (_completedLoaded) _fetchCompletedRefresh();
          },
        )
        .subscribe();
  }

  void _onTabChanged() {
    if (_tabCtrl.index == 1 && !_completedLoaded) {
      _fetchCompleted();
    }
  }

  void _onCompletedScroll() {
    if (_completedScroll.position.pixels >= _completedScroll.position.maxScrollExtent - 200) {
      _loadMoreCompleted();
    }
  }

  /// Fetch only active trips (always needed on open)
  Future<void> _fetchActive() async {
    setState(() => _loading = true);
    try {
      final userId = _supabase.auth.currentUser?.id;
      final res = await _supabase
          .from('trips')
          .select('*, orders(id, status)')
          .eq('driver_id', userId!)
          .eq('status', 'active')
          .order('created_at', ascending: false)
          .limit(50);

      if (mounted) {
        setState(() {
          _active = List<Map<String, dynamic>>.from(res);
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Lazy: first page of completed trips
  Future<void> _fetchCompleted() async {
    try {
      final userId = _supabase.auth.currentUser?.id;
      final res = await _supabase
          .from('trips')
          .select('*, orders(id, status)')
          .eq('driver_id', userId!)
          .eq('status', 'completed')
          .order('created_at', ascending: false)
          .limit(_pageSize);

      if (mounted) {
        setState(() {
          _completed = List<Map<String, dynamic>>.from(res);
          _completedLoaded = true;
          _completedHasMore = res.length >= _pageSize;
        });
      }
    } catch (_) {}
  }

  /// Refresh completed (for realtime)
  Future<void> _fetchCompletedRefresh() async {
    try {
      final userId = _supabase.auth.currentUser?.id;
      final res = await _supabase
          .from('trips')
          .select('*, orders(id, status)')
          .eq('driver_id', userId!)
          .eq('status', 'completed')
          .order('created_at', ascending: false)
          .limit(_completed.length.clamp(_pageSize, 200));

      if (mounted) setState(() => _completed = List<Map<String, dynamic>>.from(res));
    } catch (_) {}
  }

  /// Pagination: next page
  Future<void> _loadMoreCompleted() async {
    if (_completedLoadingMore || !_completedHasMore) return;
    _completedLoadingMore = true;
    try {
      final userId = _supabase.auth.currentUser?.id;
      final res = await _supabase
          .from('trips')
          .select('*, orders(id, status)')
          .eq('driver_id', userId!)
          .eq('status', 'completed')
          .order('created_at', ascending: false)
          .range(_completed.length, _completed.length + _pageSize - 1);

      if (mounted) {
        setState(() {
          _completed.addAll(List<Map<String, dynamic>>.from(res));
          _completedHasMore = res.length >= _pageSize;
        });
      }
    } catch (_) {}
    _completedLoadingMore = false;
  }

  Widget _tripsList(List<Map<String, dynamic>> trips, bool completed, {
    ScrollController? scroll, bool hasMore = false,
  }) {
    if (_loading && !completed) return const Center(child: CircularProgressIndicator());
    if (!completed && trips.isEmpty) return _emptyTab(false);
    if (completed && !_completedLoaded) return const Center(child: CircularProgressIndicator());
    if (completed && trips.isEmpty) return _emptyTab(true);
    return RefreshIndicator(
      onRefresh: completed ? _fetchCompleted : _fetchActive,
      child: ListView.builder(
        controller: scroll,
        padding: const EdgeInsets.symmetric(vertical: 8),
        itemCount: trips.length + (hasMore ? 1 : 0),
        itemBuilder: (_, i) {
          if (i >= trips.length) {
            return const Padding(
              padding: EdgeInsets.all(16),
              child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
            );
          }
          return _TripCard(
            trip: trips[i],
            completed: completed,
            onTap: () => context.go('/trips/${trips[i]['id']}'),
          );
        },
      ),
    );
  }

  Widget _emptyTab(bool completed) => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          completed ? Icons.check_circle_outline_rounded : Icons.local_shipping_outlined,
          size: 56, color: Colors.grey[300],
        ),
        const SizedBox(height: 12),
        Text(
          completed ? 'Chưa có chuyến đi hoàn thành' : 'Không có chuyến đang giao',
          style: TextStyle(fontSize: 15, color: Colors.grey[500]),
        ),
      ],
    ),
  );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFEFF6FF),
      appBar: AppBar(
        title: const Text('Chuyến đi'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh_rounded), onPressed: () {
            _fetchActive();
            if (_completedLoaded) _fetchCompletedRefresh();
          }),
          const HamburgerMenu(),
          const SizedBox(width: 4),
        ],
        bottom: TabBar(
          controller: _tabCtrl,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white60,
          indicatorColor: Colors.white,
          indicatorWeight: 3,
          dividerColor: Colors.transparent,
          tabs: [
            Tab(
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.local_shipping_rounded, size: 16),
                const SizedBox(width: 6),
                Text('Đang giao (${_active.length})',
                    style: GoogleFonts.outfit(fontWeight: FontWeight.w700, fontSize: 13)),
              ]),
            ),
            Tab(
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.check_circle_rounded, size: 16),
                const SizedBox(width: 6),
                Text('Hoàn thành (${_completed.length})',
                    style: GoogleFonts.outfit(fontWeight: FontWeight.w700, fontSize: 13)),
              ]),
            ),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabCtrl,
        children: [
          _tripsList(_active, false),
          _tripsList(_completed, true, scroll: _completedScroll, hasMore: _completedHasMore),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    _channel?.unsubscribe();
    _completedScroll.dispose();
    super.dispose();
  }
}

// ─── Trip Card (Voucher-style) ───────────────────────────────
class _TripCard extends StatelessWidget {
  final Map<String, dynamic> trip;
  final bool completed;
  final VoidCallback onTap;
  const _TripCard({required this.trip, required this.completed, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final orders     = (trip['orders'] as List?) ?? [];
    final total      = orders.length;
    final doneCount  = orders.where((o) => o['status'] != 'in_transit').length;
    final startedAt  = _fmt(trip['started_at']);
    final completedAt = completed ? _fmt(trip['completed_at']) : null;

    final Color accent = completed ? const Color(0xFF059669) : const Color(0xFF0891B2);

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
            child: Row(
              children: [
                // 44px icon box
                Container(
                  width: 44, height: 44,
                  decoration: BoxDecoration(
                    color: accent.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    completed ? Icons.check_circle_rounded : Icons.local_shipping_rounded,
                    color: accent, size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                // Info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Chuyến $startedAt',
                          style: GoogleFonts.outfit(
                              fontSize: 14, fontWeight: FontWeight.w700,
                              color: const Color(0xFF0F172A))),
                      const SizedBox(height: 3),
                      Row(children: [
                        Icon(Icons.inventory_2_outlined, size: 13, color: accent),
                        const SizedBox(width: 4),
                        Text('$doneCount/$total đơn',
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: accent)),
                        if (completedAt != null) ...[
                          const SizedBox(width: 8),
                          Text('⏱ $completedAt',
                              style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
                        ],
                      ]),
                    ],
                  ),
                ),
                // Status badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: accent.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    completed ? 'Hoàn thành' : 'Đang giao',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: accent),
                  ),
                ),
                const SizedBox(width: 4),
                const Icon(Icons.chevron_right_rounded, size: 20, color: Color(0xFFCBD5E1)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _fmt(dynamic ts) {
    if (ts == null) return '—';
    try {
      final dt = DateTime.parse(ts.toString()).toLocal();
      return '${dt.day.toString().padLeft(2,'0')}/${dt.month.toString().padLeft(2,'0')} '
             '${dt.hour.toString().padLeft(2,'0')}:${dt.minute.toString().padLeft(2,'0')}';
    } catch (_) { return '—'; }
  }
}
