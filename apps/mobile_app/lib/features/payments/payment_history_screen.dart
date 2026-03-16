import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

final _supabase = Supabase.instance.client;
final _fmt = NumberFormat('#,###', 'vi_VN');

class PaymentHistoryScreen extends StatefulWidget {
  const PaymentHistoryScreen({super.key});

  @override
  State<PaymentHistoryScreen> createState() => _PaymentHistoryScreenState();
}

class _PaymentHistoryScreenState extends State<PaymentHistoryScreen> {
  List<Map<String, dynamic>> _vouchers = [];
  bool _loading = true;
  String? _expandedId;

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  Future<void> _fetch() async {
    setState(() => _loading = true);
    try {
      final uid = _supabase.auth.currentUser?.id;
      if (uid == null) return;
      final res = await _supabase.from('payment_vouchers').select('''
        id, voucher_code, total_amount, status, note, paid_at, confirmed_at, created_at,
        items:payment_voucher_items(
          id, amount,
          order:orders(id, code, delivery_location:locations!orders_delivery_location_id_fkey(id, name))
        )
      ''').eq('driver_id', uid).order('created_at', ascending: false);
      if (mounted) setState(() { _vouchers = List<Map<String, dynamic>>.from(res); _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _confirmReceived(String voucherId) async {
    try {
      await _supabase.from('payment_vouchers').update({
        'status': 'confirmed',
        'confirmed_at': DateTime.now().toUtc().toIso8601String(),
      }).eq('id', voucherId);
      await _fetch();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('✓ Đã xác nhận nhận tiền'), backgroundColor: Color(0xFF059669)),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Lỗi: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  Widget _statusBadge(String status) {
    final cfg = <String, Map<String, dynamic>>{
      'pending':   {'label': '⏳ Chờ chi trả',  'bg': const Color(0xFFFEF9C3), 'color': const Color(0xFF92400E)},
      'paid':      {'label': '💵 Đã chi',       'bg': const Color(0xFFDCFCE7), 'color': const Color(0xFF166534)},
      'confirmed': {'label': '✅ Đã xác nhận',  'bg': const Color(0xFFEFF6FF), 'color': const Color(0xFF1D4ED8)},
    };
    final c = cfg[status] ?? cfg['pending']!;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: c['bg'] as Color, borderRadius: BorderRadius.circular(20)),
      child: Text(c['label'] as String, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: c['color'] as Color)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFEFF6FF),
      appBar: AppBar(
        title: Text('Lịch sử chi trả', style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
        backgroundColor: const Color(0xFF059669),
        foregroundColor: Colors.white,
        actions: [
          IconButton(onPressed: _fetch, icon: const Icon(Icons.refresh_rounded), tooltip: 'Tải lại'),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _vouchers.isEmpty
              ? Center(
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    const Icon(Icons.receipt_long_rounded, size: 60, color: Color(0xFFCBD5E1)),
                    const SizedBox(height: 12),
                    Text('Chưa có chứng từ chi trả',
                        style: GoogleFonts.outfit(fontSize: 15, color: const Color(0xFF94A3B8))),
                  ]),
                )
              : RefreshIndicator(
                  onRefresh: _fetch,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _vouchers.length,
                    itemBuilder: (_, i) {
                      final v = _vouchers[i];
                      final isExpanded = _expandedId == v['id'];
                      final items = (v['items'] as List?) ?? [];
                      final amount = v['total_amount'] as int? ?? 0;
                      final status = v['status'] as String? ?? 'pending';
                      final paidAt = v['paid_at'] as String?;

                      return Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 4, offset: const Offset(0, 2))],
                        ),
                        child: Column(
                          children: [
                            // Header
                            GestureDetector(
                              onTap: () => setState(() => _expandedId = isExpanded ? null : v['id'] as String),
                              child: Padding(
                                padding: const EdgeInsets.all(14),
                                child: Row(
                                  children: [
                                    // Amount circle
                                    Container(
                                      width: 44, height: 44,
                                      decoration: BoxDecoration(
                                        color: status == 'confirmed' ? const Color(0xFFDCFCE7) : const Color(0xFFF0FDF4),
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: const Icon(Icons.receipt_long_rounded, size: 22, color: Color(0xFF059669)),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Row(children: [
                                            Text(v['voucher_code'] as String, style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w700, color: const Color(0xFF0F172A))),
                                            const SizedBox(width: 8),
                                            _statusBadge(status),
                                          ]),
                                          const SizedBox(height: 3),
                                          Text(
                                            '${items.length} đơn  •  ${paidAt != null ? DateFormat('dd/MM/yyyy').format(DateTime.parse(paidAt).toLocal()) : '—'}',
                                            style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: [
                                        Text('${_fmt.format(amount)} ₫',
                                            style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w800, color: const Color(0xFF059669))),
                                        Icon(isExpanded ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded,
                                            size: 18, color: const Color(0xFF94A3B8)),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ),

                            // Items
                            if (isExpanded) ...[
                              const Divider(height: 1, color: Color(0xFFF1F5F9)),
                              ...items.map((item) {
                                final order = item['order'] as Map? ?? {};
                                final loc   = order['delivery_location'] as Map? ?? {};
                                return Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                                  child: Row(children: [
                                    const Icon(Icons.circle, size: 5, color: Color(0xFF94A3B8)),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Text(
                                        '${order['code'] ?? '—'}  •  ${loc['name'] ?? '—'}',
                                        style: const TextStyle(fontSize: 12, color: Color(0xFF475569)),
                                      ),
                                    ),
                                    Text('${_fmt.format(item['amount'] ?? 0)} ₫',
                                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
                                  ]),
                                );
                              }),

                              // Confirm button for paid vouchers
                              if (status == 'paid') ...[
                                const Divider(height: 1, color: Color(0xFFF1F5F9)),
                                Padding(
                                  padding: const EdgeInsets.all(14),
                                  child: SizedBox(
                                    width: double.infinity,
                                    child: FilledButton.icon(
                                      onPressed: () => _confirmReceived(v['id'] as String),
                                      style: FilledButton.styleFrom(
                                        backgroundColor: const Color(0xFF059669),
                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                        padding: const EdgeInsets.symmetric(vertical: 12),
                                      ),
                                      icon: const Icon(Icons.check_circle_rounded, size: 18),
                                      label: Text('Xác nhận đã nhận ${_fmt.format(amount)} ₫',
                                          style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ],
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}
