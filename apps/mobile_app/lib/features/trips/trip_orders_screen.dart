import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme.dart';
import 'delivery_proof_helper.dart';
import 'trip_service.dart';

final _supabase = Supabase.instance.client;
final _picker   = ImagePicker();

/// Screen listing all orders inside a specific trip.
/// Each order card has: Hoàn thành đơn (requires photo) | Không thành công (requires reason)
class TripOrdersScreen extends StatefulWidget {
  final String tripId;
  const TripOrdersScreen({super.key, required this.tripId});

  @override
  State<TripOrdersScreen> createState() => _TripOrdersScreenState();
}

class _TripOrdersScreenState extends State<TripOrdersScreen> {
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
        id, code, status, note, delivery_proof_url,
        extra_fee, extra_fee_note, extra_fee_status,
        pickup_location:locations!orders_pickup_location_id_fkey(id, name, address),
        delivery_location:locations!orders_delivery_location_id_fkey(id, name, address)
      ''').eq('trip_id', widget.tripId).order('created_at');
      if (mounted) setState(() { _orders = List<Map<String, dynamic>>.from(res); _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _onComplete(Map<String, dynamic> order) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _CompleteOrderSheet(
        order: order,
        onDone: _afterOrderAction,
      ),
    );
  }

  // After any order action: refresh + check if trip is done
  Future<void> _afterOrderAction() async {
    await _fetch();
    final done = await TripService.checkAndCompleteTrip(widget.tripId);
    if (done && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('🎉 Tất cả đơn đã hoàn thành — Chuyến đi đã kết thúc!'),
          backgroundColor: Color(0xFF059669),
          duration: Duration(seconds: 3),
        ),
      );
      // Navigate back to trips list after a short delay so snackbar is visible
      await Future.delayed(const Duration(seconds: 1));
      if (mounted) context.go('/trips');
    }
  }

  void _onFail(Map<String, dynamic> order) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _FailOrderSheet(
        order: order,
        onDone: _afterOrderAction,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final active   = _orders.where((o) => o['status'] == 'in_transit').toList();
    final finished = _orders.where((o) => o['status'] != 'in_transit').toList();

    return Scaffold(
      backgroundColor: const Color(0xFFEFF6FF),
      appBar: AppBar(
        title: Text('Đơn trong chuyến (${_orders.length})'),
        actions: [IconButton(icon: const Icon(Icons.refresh_rounded), onPressed: _fetch)],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _orders.isEmpty
              ? const Center(child: Text('Không có đơn', style: TextStyle(color: Colors.grey)))
              : RefreshIndicator(
                  onRefresh: _fetch,
                  child: ListView(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    children: [
                      if (active.isNotEmpty) ...[
                        _sectionHeader('🚚 Đang giao (${active.length})', const Color(0xFF7C3AED)),
                        ...active.asMap().entries.map((e) => _OrderItem(
                          order: e.value, index: e.key + 1,
                          onComplete: () => _onComplete(e.value),
                          onFail:     () => _onFail(e.value),
                        )),
                      ],
                      if (finished.isNotEmpty) ...[
                        _sectionHeader('✅ Đã xử lý (${finished.length})', const Color(0xFF059669)),
                        ...finished.asMap().entries.map((e) => _OrderItem(
                          order: e.value, index: active.length + e.key + 1,
                          onComplete: null, onFail: null,
                        )),
                      ],
                    ],
                  ),
                ),
    );
  }

  Widget _sectionHeader(String title, Color color) => Padding(
    padding: const EdgeInsets.fromLTRB(14, 12, 14, 4),
    child: Text(title, style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w700, color: color)),
  );
}

// ─── Order Item Card ─────────────────────────────────────────
class _OrderItem extends StatelessWidget {
  final Map<String, dynamic> order;
  final int index;
  final VoidCallback? onComplete;
  final VoidCallback? onFail;
  const _OrderItem({required this.order, required this.index, this.onComplete, this.onFail});

  @override
  Widget build(BuildContext context) {
    final pickup   = order['pickup_location']   as Map<String, dynamic>?;
    final delivery = order['delivery_location'] as Map<String, dynamic>?;
    final status   = order['status'] as String? ?? 'in_transit';
    final statusColor = AppTheme.statusColors[status] ?? const Color(0xFF7C3AED);
    final statusLabel = AppTheme.statusLabels[status] ?? status;
    final proofUrl    = order['delivery_proof_url'] as String?;
    final isDone      = onComplete == null;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      decoration: BoxDecoration(
        color: isDone ? const Color(0xFFF8FAFC) : Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 6, offset: const Offset(0, 2))],
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Row(
              children: [
                Container(
                  width: 30, height: 30,
                  decoration: BoxDecoration(color: const Color(0xFF0A3444), borderRadius: BorderRadius.circular(8)),
                  child: Center(child: Text('$index', style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w800))),
                ),
                const SizedBox(width: 10),
                Text(order['code']?.toString() ?? '—',
                    style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w700, color: const Color(0xFF0f172a))),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(color: statusColor.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(20)),
                  child: Text(statusLabel, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: statusColor)),
                ),
              ],
            ),
            const SizedBox(height: 10),
            // Route
            _loc(Icons.fiber_manual_record, const Color(0xFF06B6D4), pickup?['name'] ?? '—'),
            const SizedBox(height: 3),
            _loc(Icons.location_on_rounded, const Color(0xFFD97706), delivery?['name'] ?? '—'),
            // Cost info (for completed orders)
            if (status == 'delivered') ...[
              const SizedBox(height: 8),
              _costInfo(order),
            ],
            // Proof photo preview
            if (proofUrl != null) ...[
              const SizedBox(height: 10),
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Image.network(proofUrl, height: 100, width: double.infinity, fit: BoxFit.cover),
              ),
            ],
            // Action buttons (only for active orders)
            if (!isDone) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFFDC2626),
                        side: const BorderSide(color: Color(0xFFDC2626)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        padding: const EdgeInsets.symmetric(vertical: 10),
                      ),
                      onPressed: onFail,
                      icon: const Icon(Icons.close_rounded, size: 16),
                      label: const Text('Không thành công', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF059669),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        padding: const EdgeInsets.symmetric(vertical: 10),
                      ),
                      onPressed: onComplete,
                      icon: const Icon(Icons.camera_alt_rounded, size: 16),
                      label: const Text('Hoàn thành', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _loc(IconData icon, Color color, String text) => Row(children: [
    Icon(icon, size: 11, color: color),
    const SizedBox(width: 6),
    Expanded(child: Text(text, style: const TextStyle(fontSize: 13, color: Color(0xFF475569)), maxLines: 1, overflow: TextOverflow.ellipsis)),
  ]);

  Widget _costInfo(Map<String, dynamic> order) {
    final fee = order['extra_fee'];
    final feeNote = order['extra_fee_note']?.toString() ?? '';
    final feeStatus = order['extra_fee_status']?.toString() ?? '';
    if (fee == null || fee == 0) {
      return const SizedBox.shrink();
    }
    final feeInt = (fee as num).toInt();
    final formatted = feeInt.toString().replaceAllMapped(
        RegExp(r'(\d)(?=(\d{3})+(?!\d))'), (m) => '${m[1]}.');
    Color statusColor;
    String statusLabel;
    switch (feeStatus) {
      case 'approved': statusColor = const Color(0xFF059669); statusLabel = 'Đã duyệt'; break;
      case 'rejected': statusColor = const Color(0xFFDC2626); statusLabel = 'Từ chối'; break;
      default:         statusColor = const Color(0xFFD97706); statusLabel = 'Chờ duyệt';
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: const Color(0xFFFEFCE8),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFFDE68A)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            const Icon(Icons.attach_money_rounded, size: 13, color: Color(0xFFD97706)),
            const SizedBox(width: 4),
            Text('Phụ phí: $formatted ₫',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFFD97706))),
            const Spacer(),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(color: statusColor.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)),
              child: Text(statusLabel, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: statusColor)),
            ),
          ]),
          if (feeNote.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text('📝 $feeNote', style: const TextStyle(fontSize: 11, color: Color(0xFF78716C))),
          ],
        ],
      ),
    );
  }
}

// ─── Complete Order Sheet (camera only + stamp + upload) ─────
class _CompleteOrderSheet extends StatefulWidget {
  final Map<String, dynamic> order;
  final VoidCallback onDone;
  const _CompleteOrderSheet({required this.order, required this.onDone});

  @override
  State<_CompleteOrderSheet> createState() => _CompleteOrderSheetState();
}

class _CompleteOrderSheetState extends State<_CompleteOrderSheet> {
  Uint8List? _stampedBytes;   // stamped image bytes (shown as preview + uploaded)
  bool _uploading = false;
  String? _error;
  String _status = '';

  // Extra fee
  final _feeCtrl  = TextEditingController();
  final _noteCtrl = TextEditingController();

  @override
  void dispose() {
    _feeCtrl.dispose();
    _noteCtrl.dispose();
    super.dispose();
  }

  // CAMERA ONLY — no gallery
  Future<void> _captureAndStamp() async {
    setState(() { _error = null; });
    final picked = await _picker.pickImage(
      source: ImageSource.camera,
      imageQuality: 55,
      maxWidth: 800,
      preferredCameraDevice: CameraDevice.rear,
    );
    if (picked == null) return;

    setState(() => _status = 'Đang tạo stamp...');
    try {
      final raw = await picked.readAsBytes();
      final delivery = widget.order['delivery_location'] as Map<String, dynamic>?;
      final stamped = await stampDeliveryProof(
        raw,
        orderCode:   widget.order['code']?.toString() ?? '—',
        locationName: delivery?['name']?.toString() ?? '—',
        capturedAt:  DateTime.now(),
      );
      if (mounted) setState(() { _stampedBytes = stamped; _status = ''; });
    } catch (e) {
      if (mounted) setState(() { _error = 'Lỗi tạo stamp: $e'; _status = ''; });
    }
  }

  Future<void> _confirm() async {
    if (_stampedBytes == null) {
      setState(() => _error = 'Bắt buộc phải chụp ảnh xác nhận');
      return;
    }
    setState(() { _uploading = true; _error = null; _status = 'Đang nén và tải ảnh...' ; });
    try {
      final orderId = widget.order['id'] as String;
      final path    = 'proofs/$orderId-${DateTime.now().millisecondsSinceEpoch}.jpg';

      // Upload stamped PNG (already compressed via imageQuality in picker)
      await _supabase.storage.from('delivery-proofs').uploadBinary(
        path, _stampedBytes!,
        fileOptions: const FileOptions(contentType: 'image/jpeg', upsert: true),
      );

      final publicUrl = _supabase.storage.from('delivery-proofs').getPublicUrl(path);

      final feeVal = int.tryParse(_feeCtrl.text.trim());
      await _supabase.from('orders').update({
        'status': 'delivered',
        'delivery_proof_url': publicUrl,
        if (feeVal != null && feeVal > 0) 'extra_fee': feeVal,
        if (feeVal != null && feeVal > 0 && _noteCtrl.text.trim().isNotEmpty)
          'extra_fee_note': _noteCtrl.text.trim(),
        if (feeVal != null && feeVal > 0) 'extra_fee_status': 'pending',
      }).eq('id', orderId);

      if (mounted) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('✓ Đơn đã hoàn thành — ảnh đã lưu!'),
            backgroundColor: Color(0xFF059669),
          ),
        );
        widget.onDone();
      }
    } catch (e) {
      if (mounted) setState(() { _error = 'Lỗi upload: $e'; _uploading = false; _status = ''; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasPhoto = _stampedBytes != null;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        margin: const EdgeInsets.fromLTRB(12, 0, 12, 24),
        decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.all(Radius.circular(24))),
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle
            Center(child: Container(width: 40, height: 4, margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(color: Colors.grey[200], borderRadius: BorderRadius.circular(2)))),
            // Title
            Row(children: [
              Container(padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(color: const Color(0xFF059669).withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)),
                child: const Icon(Icons.camera_alt_rounded, color: Color(0xFF059669), size: 22)),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Hoàn thành đơn', style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w700)),
                Text(widget.order['code']?.toString() ?? '', style: const TextStyle(fontSize: 12, color: Color(0xFF64748b))),
              ])),
            ]),
            const SizedBox(height: 6),
            const Text(
              '📸 Chụp ảnh ngay lúc giao hàng. Ảnh sẽ được đóng dấu thời gian tự động.',
              style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
            ),
            const SizedBox(height: 14),

            // Photo area
            GestureDetector(
              onTap: (_uploading || _status.isNotEmpty) ? null : _captureAndStamp,
              child: Container(
                height: 190, width: double.infinity,
                decoration: BoxDecoration(
                  color: hasPhoto ? null : const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: hasPhoto ? const Color(0xFF059669) : const Color(0xFFE2E8F0),
                    width: 2,
                  ),
                ),
                child: _status.isNotEmpty
                    ? Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                        const CircularProgressIndicator(strokeWidth: 2),
                        const SizedBox(height: 10),
                        Text(_status, style: const TextStyle(fontSize: 12, color: Color(0xFF64748b))),
                      ])
                    : hasPhoto
                        ? Stack(
                            children: [
                              ClipRRect(
                                borderRadius: BorderRadius.circular(12),
                                child: Image.memory(_stampedBytes!, fit: BoxFit.cover,
                                    width: double.infinity, height: double.infinity),
                              ),
                              Positioned(
                                top: 8, right: 8,
                                child: GestureDetector(
                                  onTap: _captureAndStamp,
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: Colors.black54,
                                      borderRadius: BorderRadius.circular(20),
                                    ),
                                    child: const Row(mainAxisSize: MainAxisSize.min, children: [
                                      Icon(Icons.refresh_rounded, size: 13, color: Colors.white),
                                      SizedBox(width: 4),
                                      Text('Chụp lại', style: TextStyle(color: Colors.white, fontSize: 11)),
                                    ]),
                                  ),
                                ),
                              ),
                            ],
                          )
                        : Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                            const Icon(Icons.add_a_photo_rounded, size: 52, color: Color(0xFF94A3B8)),
                            const SizedBox(height: 10),
                            Text('Nhấn để mở camera', style: TextStyle(color: Colors.grey[500], fontSize: 14, fontWeight: FontWeight.w500)),
                            const SizedBox(height: 4),
                            const Text('Chỉ chụp trực tiếp, không dùng thư viện', style: TextStyle(color: Color(0xFFCBD5E1), fontSize: 11)),
                          ]),
              ),
            ),

            if (_error != null)
              Padding(padding: const EdgeInsets.only(top: 8),
                child: Text(_error!, style: const TextStyle(color: Color(0xFFDC2626), fontSize: 12))),

            const SizedBox(height: 14),

            // ── Optional extra fee ────────────────────────────
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFFEFCE8),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFFDE68A)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(children: [
                    Icon(Icons.attach_money_rounded, size: 14, color: Color(0xFFD97706)),
                    SizedBox(width: 4),
                    Text('Phụ phí thêm (không bắt buộc)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFFD97706))),
                  ]),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _feeCtrl,
                    keyboardType: TextInputType.number,
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                    decoration: InputDecoration(
                      hintText: 'Số tiền (VD: 20000)',
                      hintStyle: const TextStyle(fontSize: 12, color: Color(0xFFCBD5E1)),
                      suffixText: '₫',
                      isDense: true,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFFFDE68A))),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFFFDE68A))),
                      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFFD97706), width: 2)),
                      filled: true, fillColor: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _noteCtrl,
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.black87),
                    decoration: InputDecoration(
                      hintText: 'Lý do phụ phí...',
                      hintStyle: const TextStyle(fontSize: 12, color: Color(0xFFCBD5E1)),
                      isDense: true,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFFFDE68A))),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFFFDE68A))),
                      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFFD97706), width: 2)),
                      filled: true, fillColor: Colors.white,
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity, height: 52,
              child: FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: hasPhoto ? const Color(0xFF059669) : const Color(0xFFCBD5E1),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                onPressed: (_uploading || _status.isNotEmpty) ? null : _confirm,
                icon: _uploading
                    ? const SizedBox(width: 18, height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.check_circle_rounded, size: 20),
                label: Text(
                  _uploading ? 'Đang tải ảnh...' : 'Xác nhận hoàn thành',
                  style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w700),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Fail Order Sheet (requires reason) ─────────────────────
class _FailOrderSheet extends StatefulWidget {
  final Map<String, dynamic> order;
  final VoidCallback onDone;
  const _FailOrderSheet({required this.order, required this.onDone});

  @override
  State<_FailOrderSheet> createState() => _FailOrderSheetState();
}

class _FailOrderSheetState extends State<_FailOrderSheet> {
  final _ctrl    = TextEditingController();
  bool _loading  = false;
  String? _error;

  static const _presets = [
    'Khách không có mặt',
    'Sai địa chỉ',
    'Khách từ chối nhận',
    'Không liên lạc được',
    'Hàng bị hỏng',
  ];

  Future<void> _submit() async {
    final reason = _ctrl.text.trim();
    if (reason.isEmpty) { setState(() => _error = 'Vui lòng nhập lý do'); return; }
    setState(() { _loading = true; _error = null; });
    try {
      final orderId = widget.order['id'] as String;
      final actorId = Supabase.instance.client.auth.currentUser?.id;

      // 1. Reset order — do NOT concatenate into note
      await _supabase.from('orders').update({
        'status': 'pending',
        'assigned_to': null,
        'trip_id': null,
      }).eq('id', orderId);

      // 2. Record failure reason in order_events only
      await _supabase.from('order_events').insert({
        'order_id': orderId,
        'actor_id': actorId,
        'event_type': 'failed',
        'metadata': {'reason': reason},
      });

      if (mounted) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Đơn đã trả về Chờ xử lý'), backgroundColor: Color(0xFFD97706), duration: Duration(seconds: 3)),
        );
        widget.onDone();
      }
    } catch (e) {
      if (mounted) setState(() { _error = 'Lỗi: $e'; _loading = false; });
    }
  }

  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        margin: const EdgeInsets.fromLTRB(12, 0, 12, 24),
        decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.all(Radius.circular(24))),
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(child: Container(width: 40, height: 4, margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(color: Colors.grey[200], borderRadius: BorderRadius.circular(2)))),
            // Title
            Row(children: [
              Container(padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(color: const Color(0xFFDC2626).withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)),
                child: const Icon(Icons.cancel_rounded, color: Color(0xFFDC2626), size: 22)),
              const SizedBox(width: 12),
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Giao không thành công', style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w700, color: const Color(0xFF0f172a))),
                Text(widget.order['code']?.toString() ?? '', style: const TextStyle(fontSize: 12, color: Color(0xFF64748b))),
              ]),
            ]),
            const SizedBox(height: 4),
            const Text('Đơn sẽ trở về trạng thái Chờ xử lý để điều phối lại.',
                style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8))),
            const SizedBox(height: 16),

            // Preset reasons
            Wrap(spacing: 6, runSpacing: 6,
              children: _presets.map((r) => GestureDetector(
                onTap: () => setState(() => _ctrl.text = r),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: _ctrl.text == r ? const Color(0xFFFFF1F2) : const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: _ctrl.text == r ? const Color(0xFFDC2626) : const Color(0xFFE2E8F0)),
                  ),
                  child: Text(r, style: TextStyle(
                    fontSize: 12, fontWeight: FontWeight.w500,
                    color: _ctrl.text == r ? const Color(0xFFDC2626) : const Color(0xFF475569))),
                ),
              )).toList(),
            ),
            const SizedBox(height: 12),

            // Free text reason
            TextField(
              controller: _ctrl,
              onChanged: (_) => setState(() {}),
              maxLines: 2,
              decoration: InputDecoration(
                hintText: 'Nhập lý do giao không thành công...',
                hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Color(0xFFDC2626), width: 2)),
                contentPadding: const EdgeInsets.all(12),
              ),
            ),
            if (_error != null)
              Padding(padding: const EdgeInsets.only(top: 6),
                child: Text(_error!, style: const TextStyle(color: Color(0xFFDC2626), fontSize: 12))),

            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity, height: 52,
              child: FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFFDC2626),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                onPressed: _loading ? null : _submit,
                icon: _loading
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.undo_rounded, size: 20),
                label: Text(_loading ? 'Đang xử lý...' : 'Xác nhận — trả về Chờ xử lý',
                    style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
