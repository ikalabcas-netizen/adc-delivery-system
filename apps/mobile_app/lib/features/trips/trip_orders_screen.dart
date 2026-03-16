import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme.dart';

class TripOrdersScreen extends StatefulWidget {
  final String tripId;
  const TripOrdersScreen({super.key, required this.tripId});

  @override
  State<TripOrdersScreen> createState() => _TripOrdersScreenState();
}

class _TripOrdersScreenState extends State<TripOrdersScreen> {
  final _supabase = Supabase.instance.client;
  List<Map<String, dynamic>> _orders = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  Future<void> _fetch() async {
    setState(() => _loading = true);
    try {
      final res = await _supabase.from('orders').select('''
        id, code, status, note,
        pickup_location:locations!orders_pickup_location_id_fkey(id, name, address),
        delivery_location:locations!orders_delivery_location_id_fkey(id, name, address)
      ''').eq('trip_id', widget.tripId).order('created_at');
      if (mounted) {
        setState(() {
          _orders = List<Map<String, dynamic>>.from(res);
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFEFF6FF),
      appBar: AppBar(
        title: Text('Đơn trong chuyến (${_orders.length})'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh_rounded), onPressed: _fetch),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _orders.isEmpty
              ? const Center(
                  child: Text('Không có đơn trong chuyến này', style: TextStyle(color: Colors.grey)),
                )
              : RefreshIndicator(
                  onRefresh: _fetch,
                  child: ListView.builder(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    itemCount: _orders.length,
                    itemBuilder: (_, i) => _OrderItem(order: _orders[i], index: i + 1),
                  ),
                ),
    );
  }
}

class _OrderItem extends StatelessWidget {
  final Map<String, dynamic> order;
  final int index;
  const _OrderItem({required this.order, required this.index});

  @override
  Widget build(BuildContext context) {
    final pickup   = order['pickup_location']   as Map<String, dynamic>?;
    final delivery = order['delivery_location'] as Map<String, dynamic>?;
    final status   = order['status'] as String? ?? 'in_transit';
    final statusColor = AppTheme.statusColors[status] ?? const Color(0xFF7c3aed);
    final statusLabel = AppTheme.statusLabels[status] ?? status;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 6, offset: const Offset(0, 2)),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Stop number
            Container(
              width: 32, height: 32,
              decoration: BoxDecoration(
                color: const Color(0xFF0A3444),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Center(
                child: Text('$index', style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w800)),
              ),
            ),
            const SizedBox(width: 12),
            // Content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        order['code']?.toString() ?? '—',
                        style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w700, color: const Color(0xFF0f172a)),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: statusColor.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(statusLabel, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: statusColor)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  _locationRow(Icons.fiber_manual_record, const Color(0xFF06B6D4), pickup?['name'] ?? '—'),
                  const SizedBox(height: 3),
                  _locationRow(Icons.location_on_rounded, const Color(0xFFD97706), delivery?['name'] ?? '—'),
                  if (order['note'] != null && order['note'].toString().isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Text('📝 ${order['note']}', style: TextStyle(fontSize: 11, color: Colors.grey[500], fontStyle: FontStyle.italic)),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _locationRow(IconData icon, Color color, String text) {
    return Row(
      children: [
        Icon(icon, size: 11, color: color),
        const SizedBox(width: 6),
        Expanded(
          child: Text(text,
            style: const TextStyle(fontSize: 13, color: Color(0xFF475569)),
            maxLines: 1, overflow: TextOverflow.ellipsis),
        ),
      ],
    );
  }
}
