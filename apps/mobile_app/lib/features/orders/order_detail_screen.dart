import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';

/// Order detail — full info + action buttons (start delivery, confirm, reject)
class OrderDetailScreen extends StatefulWidget {
  final String orderId;
  const OrderDetailScreen({super.key, required this.orderId});

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  final _supabase = Supabase.instance.client;
  Map<String, dynamic>? _order;
  List<Map<String, dynamic>> _events = [];
  bool _loading = true;
  bool _acting = false;

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  Future<void> _fetch() async {
    setState(() => _loading = true);
    try {
      final res = await _supabase
          .from('orders')
          .select('''
            *,
            pickup_location:locations!orders_pickup_location_id_fkey(id, name, address),
            delivery_location:locations!orders_delivery_location_id_fkey(id, name, address),
            assigned_driver:profiles!orders_assigned_to_fkey(id, full_name, phone, vehicle_plate)
          ''')
          .eq('id', widget.orderId)
          .single();

      final events = await _supabase
          .from('order_events')
          .select('*, actor:profiles!order_events_actor_id_fkey(full_name)')
          .eq('order_id', widget.orderId)
          .order('created_at', ascending: false);

      if (mounted) {
        setState(() {
          _order = res;
          _events = List<Map<String, dynamic>>.from(events);
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Lỗi: $e')),
        );
      }
    }
  }

  Future<void> _updateStatus(String newStatus, {String? reason}) async {
    setState(() => _acting = true);
    try {
      final updates = <String, dynamic>{'status': newStatus};

      // If rejecting or failed → unassign and return to pending
      if (newStatus == 'pending') {
        updates['assigned_to'] = null;
        if (reason != null) updates['rejection_note'] = reason;
      }

      await _supabase
          .from('orders')
          .update(updates)
          .eq('id', widget.orderId);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('✓ Cập nhật thành công')),
        );
      }
      _fetch();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Lỗi: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _acting = false);
    }
  }

  Future<void> _showReasonDialog(String action) async {
    final controller = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(action == 'reject' ? 'Lý do từ chối' : 'Lý do không thành công'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(
            hintText: 'Nhập lý do...',
          ),
          maxLines: 3,
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Huỷ'),
          ),
          FilledButton(
            onPressed: () {
              if (controller.text.trim().isEmpty) {
                ScaffoldMessenger.of(ctx).showSnackBar(
                  const SnackBar(content: Text('Vui lòng nhập lý do')),
                );
                return;
              }
              Navigator.pop(ctx, controller.text.trim());
            },
            child: const Text('Xác nhận'),
          ),
        ],
      ),
    );

    if (reason != null && reason.isNotEmpty) {
      _updateStatus('pending', reason: reason);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: Text(_order?['code']?.toString() ?? 'Chi tiết đơn'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => context.go('/orders'),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _order == null
              ? const Center(child: Text('Không tìm thấy đơn hàng'))
              : RefreshIndicator(
                  onRefresh: _fetch,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      _buildStatusCard(cs),
                      const SizedBox(height: 12),
                      _buildRouteCard(cs),
                      const SizedBox(height: 12),
                      _buildInfoCard(cs),
                      const SizedBox(height: 12),
                      _buildActions(cs),
                      const SizedBox(height: 20),
                      _buildTimeline(cs),
                    ],
                  ),
                ),
    );
  }

  Widget _buildStatusCard(ColorScheme cs) {
    final status = _order!['status'] as String? ?? 'pending';
    final color = AppTheme.statusColors[status] ?? Colors.grey;
    final label = AppTheme.statusLabels[status] ?? status;

    return Card(
      color: color.withValues(alpha: 0.08),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 12,
              height: 12,
              decoration: BoxDecoration(
                color: color,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 12),
            Text(
              label,
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRouteCard(ColorScheme cs) {
    final pickup = _order!['pickup_location'] as Map<String, dynamic>?;
    final delivery = _order!['delivery_location'] as Map<String, dynamic>?;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Lộ trình',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            const SizedBox(height: 12),
            _locationRow(
              Icons.circle, const Color(0xFF06B6D4),
              pickup?['name'] ?? '—',
              pickup?['address'] ?? '',
            ),
            Container(
              width: 1.5, height: 20,
              margin: const EdgeInsets.only(left: 7),
              color: Colors.grey[200],
            ),
            _locationRow(
              Icons.circle, const Color(0xFFD97706),
              delivery?['name'] ?? '—',
              delivery?['address'] ?? '',
            ),
          ],
        ),
      ),
    );
  }

  Widget _locationRow(IconData icon, Color color, String name, String address) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Icon(icon, size: 12, color: color),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(name,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
              if (address.isNotEmpty)
                Text(address,
                    style: TextStyle(fontSize: 12, color: Colors.grey[500])),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildInfoCard(ColorScheme cs) {
    final driver = _order!['assigned_driver'] as Map<String, dynamic>?;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Thông tin',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            const SizedBox(height: 12),
            if (_order!['note'] != null)
              _infoRow('Ghi chú', _order!['note'].toString()),
            if (driver != null) ...[
              _infoRow('Giao nhận', driver['full_name'] ?? '—'),
              if (driver['phone'] != null)
                _infoRow('SĐT', driver['phone']),
              if (driver['vehicle_plate'] != null)
                _infoRow('Biển số', driver['vehicle_plate']),
            ],
            _infoRow('Loại', _order!['type']?.toString() ?? 'delivery'),
          ],
        ),
      ),
    );
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 80,
            child: Text(label,
                style: TextStyle(fontSize: 13, color: Colors.grey[500])),
          ),
          Expanded(
            child: Text(value, style: const TextStyle(fontSize: 13)),
          ),
        ],
      ),
    );
  }

  Widget _buildActions(ColorScheme cs) {
    final status = _order!['status'] as String? ?? 'pending';
    final userId = _supabase.auth.currentUser?.id;
    final isMyOrder = _order!['assigned_to'] == userId;

    if (!isMyOrder && status != 'pending') return const SizedBox.shrink();

    return Column(
      children: [
        // Claim (if pending and not mine)
        if (status == 'pending' && !isMyOrder)
          SizedBox(
            width: double.infinity,
            height: 50,
            child: FilledButton.icon(
              onPressed: _acting ? null : () => _updateStatus('assigned'),
              icon: const Icon(Icons.add_task_rounded),
              label: Text(_acting ? 'Đang xử lý...' : 'Nhận đơn này'),
            ),
          ),

        // Start delivery
        if (status == 'assigned' && isMyOrder) ...[
          SizedBox(
            width: double.infinity,
            height: 50,
            child: FilledButton.icon(
              onPressed: _acting ? null : () => _updateStatus('in_transit'),
              icon: const Icon(Icons.local_shipping_rounded),
              label: Text(_acting ? 'Đang xử lý...' : 'Bắt đầu giao'),
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            height: 50,
            child: OutlinedButton.icon(
              onPressed: _acting ? null : () => _showReasonDialog('reject'),
              icon: const Icon(Icons.undo_rounded),
              label: const Text('Từ chối đơn'),
              style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
            ),
          ),
        ],

        // Confirm delivery or fail
        if (status == 'in_transit' && isMyOrder) ...[
          SizedBox(
            width: double.infinity,
            height: 50,
            child: FilledButton.icon(
              onPressed: _acting ? null : () => _updateStatus('delivered'),
              icon: const Icon(Icons.check_circle_rounded),
              label: Text(_acting ? 'Đang xử lý...' : 'Giao thành công'),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF059669),
              ),
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            height: 50,
            child: OutlinedButton.icon(
              onPressed: _acting ? null : () => _showReasonDialog('fail'),
              icon: const Icon(Icons.cancel_rounded),
              label: const Text('Không thành công'),
              style: OutlinedButton.styleFrom(foregroundColor: Colors.orange),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildTimeline(ColorScheme cs) {
    if (_events.isEmpty) return const SizedBox.shrink();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Lịch sử',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            const SizedBox(height: 12),
            ..._events.map((e) {
              final actor = e['actor'] as Map<String, dynamic>?;
              final dt = DateTime.tryParse(e['created_at']?.toString() ?? '');
              final timeStr = dt != null
                  ? '${dt.toLocal().day.toString().padLeft(2, '0')}/${dt.toLocal().month.toString().padLeft(2, '0')} ${dt.toLocal().hour.toString().padLeft(2, '0')}:${dt.toLocal().minute.toString().padLeft(2, '0')}'
                  : '';

              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      margin: const EdgeInsets.only(top: 5),
                      decoration: BoxDecoration(
                        color: cs.primary,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            e['description']?.toString() ?? e['event_type']?.toString() ?? '—',
                            style: const TextStyle(fontSize: 13),
                          ),
                          Text(
                            '${actor?['full_name'] ?? '—'} · $timeStr',
                            style: TextStyle(fontSize: 11, color: Colors.grey[400]),
                          ),
                          if (e['note'] != null && e['note'].toString().isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: 2),
                              child: Text(
                                '💬 ${e['note']}',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontStyle: FontStyle.italic,
                                  color: Colors.grey[500],
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            }),
          ],
        ),
      ),
    );
  }
}
