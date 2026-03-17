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

class _TripsScreenState extends State<TripsScreen> {
  final _supabase = Supabase.instance.client;
  List<Map<String, dynamic>> _active    = [];
  List<Map<String, dynamic>> _completed = [];
  bool _loading = true;
  RealtimeChannel? _channel;

  @override
  void initState() {
    super.initState();
    _fetch();
    _subscribeRealtime();
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
          callback: (_) => _fetch(),
        )
        .subscribe();
  }

  Future<void> _fetch() async {
    setState(() => _loading = true);
    try {
      final userId = _supabase.auth.currentUser?.id;
      final res = await _supabase
          .from('trips')
          .select('*, orders(id, status)')
          .eq('driver_id', userId!)
          .order('created_at', ascending: false)
          .limit(100);

      final all = List<Map<String, dynamic>>.from(res);
      if (mounted) {
        setState(() {
          _active    = all.where((t) => t['status'] == 'active').toList();
          _completed = all.where((t) => t['status'] == 'completed').toList();
          _loading   = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isEmpty = _active.isEmpty && _completed.isEmpty;
    return Scaffold(
      backgroundColor: const Color(0xFFEFF6FF),
      appBar: AppBar(
        title: const Text('Chuyến đi'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh_rounded), onPressed: _fetch),
          const HamburgerMenu(),
          const SizedBox(width: 4),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : isEmpty
              ? _empty()
              : RefreshIndicator(
                  onRefresh: _fetch,
                  child: ListView(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    children: [
                      if (_active.isNotEmpty) ...[
                        _sectionHeader('🚚 Đang giao (${_active.length})', const Color(0xFF0891B2)),
                        ..._active.map((t) => _TripCard(
                              trip: t,
                              completed: false,
                              onTap: () => context.go('/trips/${t['id']}'),
                            )),
                      ],
                      if (_completed.isNotEmpty) ...[
                        _sectionHeader('✅ Đã hoàn thành (${_completed.length})', const Color(0xFF059669)),
                        ..._completed.map((t) => _TripCard(
                              trip: t,
                              completed: true,
                              onTap: () => context.go('/trips/${t['id']}'),
                            )),
                      ],
                    ],
                  ),
                ),
    );
  }

  Widget _sectionHeader(String title, Color color) => Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 4),
        child: Text(title,
            style: GoogleFonts.outfit(
                fontSize: 13, fontWeight: FontWeight.w700, color: color)),
      );

  Widget _empty() => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.route_rounded, size: 56, color: Colors.grey[300]),
            const SizedBox(height: 12),
            Text('Chưa có chuyến đi nào',
                style: TextStyle(fontSize: 15, color: Colors.grey[500])),
            const SizedBox(height: 6),
            Text('Xếp chuyến từ tab Đã nhận',
                style: TextStyle(fontSize: 13, color: Colors.grey[400])),
          ],
        ),
      );

  @override
  void dispose() {
    _channel?.unsubscribe();
    super.dispose();
  }
}

// ─── Trip Card ────────────────────────────────────────────────
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

    return Opacity(
      opacity: completed ? 0.65 : 1.0,
      child: Card(
        margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        elevation: 0,
        color: Colors.white,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                // Icon
                Container(
                  width: 48, height: 48,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: completed
                          ? [const Color(0xFF059669), const Color(0xFF047857)]
                          : [const Color(0xFF0891B2), const Color(0xFF0C4A6E)],
                      begin: Alignment.topLeft, end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Center(
                    child: Icon(
                      completed ? Icons.check_circle_rounded : Icons.local_shipping_rounded,
                      color: Colors.white, size: 24,
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                // Info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Chuyến $startedAt',
                          style: GoogleFonts.outfit(
                              fontSize: 15, fontWeight: FontWeight.w600,
                              color: const Color(0xFF0f172a))),
                      const SizedBox(height: 3),
                      Row(children: [
                        Icon(Icons.inventory_2_outlined, size: 13,
                            color: completed ? const Color(0xFF059669) : const Color(0xFF0891B2)),
                        const SizedBox(width: 4),
                        Text('$doneCount/$total đơn',
                            style: TextStyle(
                                fontSize: 13, fontWeight: FontWeight.w500,
                                color: completed ? const Color(0xFF059669) : const Color(0xFF0891B2))),
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
                    color: (completed ? const Color(0xFF059669) : const Color(0xFF0891B2))
                        .withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    completed ? 'Hoàn thành' : 'Đang giao',
                    style: TextStyle(
                        fontSize: 11, fontWeight: FontWeight.w700,
                        color: completed ? const Color(0xFF059669) : const Color(0xFF0891B2)),
                  ),
                ),
                const SizedBox(width: 6),
                const Icon(Icons.chevron_right_rounded, color: Colors.grey),
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
