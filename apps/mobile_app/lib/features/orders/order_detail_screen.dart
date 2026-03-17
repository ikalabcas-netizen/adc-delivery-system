import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme.dart';

/// Chi tiết đơn hàng — giao diện sáng, tiếng Việt đầy đủ
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
      if (newStatus == 'pending') {
        updates['assigned_to'] = null;
        if (reason != null) updates['rejection_note'] = reason;
      }
      await _supabase.from('orders').update(updates).eq('id', widget.orderId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('✓ Cập nhật thành công'), backgroundColor: Color(0xFF059669)),
        );
      }
      _fetch();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Lỗi: $e')));
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
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          action == 'reject' ? 'Lý do từ chối' : 'Lý do không thành công',
          style: GoogleFonts.outfit(fontWeight: FontWeight.w700, fontSize: 16, color: const Color(0xFF0F172A)),
        ),
        content: TextField(
          controller: controller,
          decoration: InputDecoration(
            hintText: 'Nhập lý do...',
            hintStyle: const TextStyle(color: Color(0xFF94A3B8)),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: Color(0xFF06B6D4), width: 2),
            ),
          ),
          maxLines: 3,
          autofocus: true,
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Huỷ')),
          FilledButton(
            onPressed: () {
              if (controller.text.trim().isEmpty) {
                ScaffoldMessenger.of(ctx).showSnackBar(const SnackBar(content: Text('Vui lòng nhập lý do')));
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
    return Scaffold(
      backgroundColor: const Color(0xFFEFF6FF),
      appBar: AppBar(
        title: Text(_order?['code']?.toString() ?? 'Chi tiết đơn',
            style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
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
                    padding: const EdgeInsets.all(14),
                    children: [
                      _buildStatusCard(),
                      const SizedBox(height: 10),
                      _buildRouteCard(),
                      const SizedBox(height: 10),
                      _buildInfoCard(),
                      const SizedBox(height: 10),
                      _buildActions(),
                      if (_events.isNotEmpty) ...[
                        const SizedBox(height: 10),
                        _buildTimeline(),
                      ],
                      const SizedBox(height: 20),
                    ],
                  ),
                ),
    );
  }

  // ─── Card container (Voucher style) ─────────────────────
  Widget _card({required Widget child}) => Container(
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: const Color(0xFFE2E8F0)),
      boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 4, offset: const Offset(0, 2))],
    ),
    padding: const EdgeInsets.all(16),
    child: child,
  );

  Widget _buildStatusCard() {
    final status = _order!['status'] as String? ?? 'pending';
    final color = AppTheme.statusColors[status] ?? Colors.grey;
    final label = AppTheme.statusLabels[status] ?? status;

    return _card(
      child: Row(children: [
        Container(
          width: 44, height: 44,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(_statusIcon(status), size: 22, color: color),
        ),
        const SizedBox(width: 14),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Trạng thái', style: TextStyle(fontSize: 11, color: Colors.grey[500])),
          const SizedBox(height: 2),
          Text(label, style: GoogleFonts.outfit(fontSize: 17, fontWeight: FontWeight.w700, color: color)),
        ]),
        const Spacer(),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(20)),
          child: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color)),
        ),
      ]),
    );
  }

  IconData _statusIcon(String status) {
    switch (status) {
      case 'pending':    return Icons.hourglass_empty_rounded;
      case 'assigned':   return Icons.person_pin_rounded;
      case 'staging':    return Icons.inventory_2_outlined;
      case 'in_transit': return Icons.local_shipping_rounded;
      case 'delivered':  return Icons.check_circle_rounded;
      case 'failed':     return Icons.cancel_rounded;
      case 'cancelled':  return Icons.block_rounded;
      default:           return Icons.help_outline_rounded;
    }
  }

  Widget _buildRouteCard() {
    final pickup = _order!['pickup_location'] as Map<String, dynamic>?;
    final delivery = _order!['delivery_location'] as Map<String, dynamic>?;

    return _card(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(Icons.route_rounded, size: 16, color: Color(0xFF0891B2)),
          const SizedBox(width: 8),
          Text('Lộ trình giao hàng', style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w700, color: const Color(0xFF0F172A))),
        ]),
        const SizedBox(height: 14),
        _locationRow(Icons.circle, const Color(0xFF06B6D4), 'Điểm lấy hàng',
            pickup?['name'] ?? '—', pickup?['address'] ?? ''),
        Padding(
          padding: const EdgeInsets.only(left: 6),
          child: Container(width: 1.5, height: 16, color: const Color(0xFFE2E8F0)),
        ),
        _locationRow(Icons.location_on_rounded, const Color(0xFFD97706), 'Điểm giao hàng',
            delivery?['name'] ?? '—', delivery?['address'] ?? ''),
      ]),
    );
  }

  Widget _locationRow(IconData icon, Color color, String label, String name, String address) {
    return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Padding(
        padding: const EdgeInsets.only(top: 2),
        child: Icon(icon, size: 12, color: color),
      ),
      const SizedBox(width: 12),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: TextStyle(fontSize: 11, color: Colors.grey[500])),
        Text(name, style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: const Color(0xFF0F172A))),
        if (address.isNotEmpty)
          Text(address, style: TextStyle(fontSize: 12, color: Colors.grey[500])),
      ])),
    ]);
  }

  Widget _buildInfoCard() {
    final driver = _order!['assigned_driver'] as Map<String, dynamic>?;

    return _card(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(Icons.info_outline_rounded, size: 16, color: Color(0xFF0891B2)),
          const SizedBox(width: 8),
          Text('Thông tin đơn hàng', style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w700, color: const Color(0xFF0F172A))),
        ]),
        const SizedBox(height: 14),
        if (_order!['note'] != null && _order!['note'].toString().isNotEmpty)
          _infoRow('Ghi chú', _order!['note'].toString()),
        if (driver != null) ...[
          _infoRow('Nhân viên giao', driver['full_name'] ?? '—'),
          if (driver['phone'] != null)
            _infoRow('Số điện thoại', driver['phone']),
          if (driver['vehicle_plate'] != null)
            _infoRow('Biển số xe', driver['vehicle_plate']),
        ],
        _infoRow('Loại đơn', _order!['type']?.toString() == 'pickup' ? 'Lấy hàng' : 'Giao hàng'),
        if (_order!['extra_fee'] != null && (_order!['extra_fee'] as num) > 0)
          _infoRow('Phụ phí', '${_order!['extra_fee']} ₫'),
      ]),
    );
  }

  Widget _infoRow(String label, String value) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SizedBox(
        width: 100,
        child: Text(label, style: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFF94A3B8))),
      ),
      Expanded(child: Text(value, style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: const Color(0xFF0F172A)))),
    ]),
  );

  Widget _buildActions() {
    final status = _order!['status'] as String? ?? 'pending';
    final userId = _supabase.auth.currentUser?.id;
    final isMyOrder = _order!['assigned_to'] == userId;

    if (!isMyOrder && status != 'pending') return const SizedBox.shrink();

    return Column(children: [
      if (status == 'pending' && !isMyOrder)
        _actionButton('Nhận đơn này', Icons.add_task_rounded, const Color(0xFF0891B2), () => _updateStatus('assigned')),

      if (status == 'assigned' && isMyOrder) ...[
        _actionButton('Bắt đầu giao hàng', Icons.local_shipping_rounded, const Color(0xFF0891B2), () => _updateStatus('in_transit')),
        const SizedBox(height: 8),
        _outlineButton('Từ chối đơn', Icons.undo_rounded, const Color(0xFFDC2626), () => _showReasonDialog('reject')),
      ],

      if (status == 'in_transit' && isMyOrder) ...[
        _actionButton('Giao thành công', Icons.check_circle_rounded, const Color(0xFF059669), () => _updateStatus('delivered')),
        const SizedBox(height: 8),
        _outlineButton('Giao không thành công', Icons.cancel_rounded, const Color(0xFFD97706), () => _showReasonDialog('fail')),
      ],
    ]);
  }

  Widget _actionButton(String text, IconData icon, Color color, VoidCallback onPressed) => SizedBox(
    width: double.infinity, height: 50,
    child: FilledButton.icon(
      onPressed: _acting ? null : onPressed,
      icon: Icon(icon, size: 18),
      label: Text(_acting ? 'Đang xử lý...' : text, style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
      style: FilledButton.styleFrom(
        backgroundColor: color,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
  );

  Widget _outlineButton(String text, IconData icon, Color color, VoidCallback onPressed) => SizedBox(
    width: double.infinity, height: 50,
    child: OutlinedButton.icon(
      onPressed: _acting ? null : onPressed,
      icon: Icon(icon, size: 18),
      label: Text(text, style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
      style: OutlinedButton.styleFrom(
        foregroundColor: color,
        side: BorderSide(color: color.withValues(alpha: 0.3)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
  );

  Widget _buildTimeline() {
    return _card(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(Icons.timeline_rounded, size: 16, color: Color(0xFF0891B2)),
          const SizedBox(width: 8),
          Text('Lịch sử đơn hàng', style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w700, color: const Color(0xFF0F172A))),
        ]),
        const SizedBox(height: 14),
        ..._events.map((e) {
          final actor = e['actor'] as Map<String, dynamic>?;
          final dt = DateTime.tryParse(e['created_at']?.toString() ?? '');
          final timeStr = dt != null
              ? '${dt.toLocal().day.toString().padLeft(2, '0')}/${dt.toLocal().month.toString().padLeft(2, '0')} ${dt.toLocal().hour.toString().padLeft(2, '0')}:${dt.toLocal().minute.toString().padLeft(2, '0')}'
              : '';

          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(
                width: 8, height: 8,
                margin: const EdgeInsets.only(top: 5),
                decoration: const BoxDecoration(color: Color(0xFF06B6D4), shape: BoxShape.circle),
              ),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(
                  _translateEvent(e['description']?.toString() ?? e['event_type']?.toString() ?? '—'),
                  style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: const Color(0xFF0F172A)),
                ),
                Text(
                  '${actor?['full_name'] ?? '—'} · $timeStr',
                  style: TextStyle(fontSize: 11, color: Colors.grey[400]),
                ),
                if (e['note'] != null && e['note'].toString().isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 3),
                    child: Text('💬 ${e['note']}',
                        style: TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: Colors.grey[500])),
                  ),
              ])),
            ]),
          );
        }),
      ]),
    );
  }

  String _translateEvent(String event) {
    final map = {
      'created': 'Tạo đơn',
      'assigned': 'Đã gán giao nhận',
      'in_transit': 'Bắt đầu giao',
      'delivered': 'Giao thành công',
      'failed': 'Giao thất bại',
      'cancelled': 'Đã huỷ đơn',
      'status_change': 'Thay đổi trạng thái',
    };
    return map[event] ?? event;
  }
}
