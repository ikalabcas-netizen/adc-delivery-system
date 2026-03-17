import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../core/image_cache_manager.dart';
import '../shell/app_shell.dart';

final _supabase = Supabase.instance.client;
final _fmt = NumberFormat('#,###', 'vi_VN');

// ─── Main Screen ──────────────────────────────────────
class CostsScreen extends StatefulWidget {
  const CostsScreen({super.key});
  @override
  State<CostsScreen> createState() => _CostsScreenState();
}

class _CostsScreenState extends State<CostsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _outerTab;
  RealtimeChannel? _channel;

  @override
  void initState() {
    super.initState();
    _outerTab = TabController(length: 2, vsync: this);
    _subscribeRealtime();
  }

  @override
  void dispose() {
    _outerTab.dispose();
    _channel?.unsubscribe();
    super.dispose();
  }

  void _subscribeRealtime() {
    final uid = _supabase.auth.currentUser?.id;
    if (uid == null) return;
    _channel = _supabase
        .channel('costs_realtime_$uid')
        .onPostgresChanges(
          event: PostgresChangeEvent.update,
          schema: 'public',
          table: 'payment_vouchers',
          callback: (payload) {
            // Only refresh if it's this driver's voucher
            final newRow = payload.newRecord;
            if (newRow['driver_id'] == uid && mounted) {
              setState(() {});
            }
          },
        )
        .subscribe();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFEFF6FF),
      appBar: AppBar(
        title: Text('Chi phí & Thanh toán', style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
        // backgroundColor inherited from theme (Cyan #0891B2)
        actions: [const HamburgerMenu()],
        bottom: TabBar(
          controller: _outerTab,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white60,
          indicatorColor: Colors.white,
          indicatorWeight: 3,
          dividerColor: Colors.transparent,
          labelStyle: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w700),
          tabs: const [
            Tab(text: 'Phụ phí đơn hàng'),
            Tab(text: 'Chứng từ chi trả'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _outerTab,
        children: const [
          _ExtraFeesTab(),
          _VouchersTab(),
        ],
      ),
    );
  }
}

// ─── Tab 1: Phụ phí ───────────────────────────────────
class _ExtraFeesTab extends StatefulWidget {
  const _ExtraFeesTab();
  @override
  State<_ExtraFeesTab> createState() => _ExtraFeesTabState();
}

class _ExtraFeesTabState extends State<_ExtraFeesTab>
    with SingleTickerProviderStateMixin {
  late TabController _filterTab;
  List<Map<String, dynamic>> _orders = [];
  bool _loading = true;
  bool _loadingMore = false;
  bool _hasMore = true;
  static const _pageSize = 30;
  final ScrollController _scrollCtrl = ScrollController();

  static const _statuses = ['pending', 'approved', 'rejected'];

  @override
  void initState() {
    super.initState();
    _filterTab = TabController(length: 3, vsync: this);
    _fetch();
    _scrollCtrl.addListener(_onScroll);
  }

  @override
  void dispose() {
    _filterTab.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollCtrl.position.pixels >= _scrollCtrl.position.maxScrollExtent - 200) {
      _loadMore();
    }
  }

  Future<void> _fetch() async {
    setState(() => _loading = true);
    final uid = _supabase.auth.currentUser?.id;
    if (uid == null) { setState(() => _loading = false); return; }
    try {
      final res = await _supabase
          .from('orders')
          .select('''
            id, code, extra_fee, extra_fee_note, extra_fee_status,
            extra_fee_rejected_reason, delivered_at, delivery_proof_url,
            delivery_location:locations!orders_delivery_location_id_fkey(id, name),
            voucher_items:payment_voucher_items(
              id,
              voucher:payment_vouchers(id, voucher_code, status)
            )
          ''')
          .eq('assigned_to', uid)
          .gt('extra_fee', 0)
          .order('delivered_at', ascending: false)
          .limit(_pageSize);

      if (mounted) {
        setState(() {
          _orders = List<Map<String, dynamic>>.from(res);
          _loading = false;
          _hasMore = res.length >= _pageSize;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadMore() async {
    if (_loadingMore || !_hasMore) return;
    _loadingMore = true;
    final uid = _supabase.auth.currentUser?.id;
    if (uid == null) { _loadingMore = false; return; }
    try {
      final res = await _supabase
          .from('orders')
          .select('''
            id, code, extra_fee, extra_fee_note, extra_fee_status,
            extra_fee_rejected_reason, delivered_at, delivery_proof_url,
            delivery_location:locations!orders_delivery_location_id_fkey(id, name),
            voucher_items:payment_voucher_items(
              id,
              voucher:payment_vouchers(id, voucher_code, status)
            )
          ''')
          .eq('assigned_to', uid)
          .gt('extra_fee', 0)
          .order('delivered_at', ascending: false)
          .range(_orders.length, _orders.length + _pageSize - 1);

      if (mounted) {
        setState(() {
          _orders.addAll(List<Map<String, dynamic>>.from(res));
          _hasMore = res.length >= _pageSize;
        });
      }
    } catch (_) {}
    _loadingMore = false;
  }

  // 5 payment states: pending | approved | approved_vouchered | approved_paid | rejected
  static String _paymentStatus(Map<String, dynamic> o) {
    final base = o['extra_fee_status'] as String? ?? 'pending';
    if (base == 'rejected') return 'rejected';
    if (base != 'approved') return base;
    final items = o['voucher_items'] as List? ?? [];
    if (items.isEmpty) return 'approved';
    final voucher = (items.first as Map?)?['voucher'] as Map?;
    if (voucher == null) return 'approved';
    final vs = voucher['status'] as String? ?? '';
    if (vs == 'paid' || vs == 'confirmed') return 'approved_paid';
    return 'approved_vouchered';
  }

  List<Map<String, dynamic>> _filtered(String status) {
    switch (status) {
      case 'approved':
        // Show all approved sub-states in the approved tab
        return _orders.where((o) {
          final ps = _paymentStatus(o);
          return ps == 'approved' || ps == 'approved_vouchered' || ps == 'approved_paid';
        }).toList();
      default:
        return _orders.where((o) => o['extra_fee_status'] == status).toList();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());

    final counts = {
      'pending':  _orders.where((o) => o['extra_fee_status'] == 'pending').length,
      'approved': _orders.where((o) {
        final ps = _paymentStatus(o);
        return ps == 'approved' || ps == 'approved_vouchered' || ps == 'approved_paid';
      }).length,
      'rejected': _orders.where((o) => o['extra_fee_status'] == 'rejected').length,
    };

    return Column(
      children: [
        // Inner filter tabs
        Container(
          color: Colors.white,
          child: TabBar(
            controller: _filterTab,
            isScrollable: false,
            labelColor: const Color(0xFF0891B2),
            unselectedLabelColor: const Color(0xFF94A3B8),
            indicatorColor: const Color(0xFF0891B2),
            indicatorWeight: 2.5,
            labelStyle: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w700),
            tabs: [
              Tab(text: '⏳ Chờ duyệt (${counts['pending']})'),
              Tab(text: '✅ Đã duyệt (${counts['approved']})'),
              Tab(text: '❌ Từ chối (${counts['rejected']})'),
            ],
          ),
        ),
        Expanded(
          child: TabBarView(
            controller: _filterTab,
            children: _statuses.map((s) {
              final items = _filtered(s);
              if (items.isEmpty) {
                return Center(
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Icon(Icons.receipt_long_rounded, size: 52, color: const Color(0xFFCBD5E1)),
                    const SizedBox(height: 10),
                    Text('Không có phụ phí ${_statusLabel(s).toLowerCase()}',
                        style: GoogleFonts.outfit(fontSize: 14, color: const Color(0xFF94A3B8))),
                  ]),
                );
              }
              return RefreshIndicator(
                onRefresh: _fetch,
                child: ListView.builder(
                  controller: _scrollCtrl,
                  padding: const EdgeInsets.all(14),
                  itemCount: items.length + (_hasMore ? 1 : 0),
                  itemBuilder: (_, i) {
                    if (i >= items.length) {
                      return const Padding(
                        padding: EdgeInsets.all(16),
                        child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
                      );
                    }
                    return _FeeCard(
                      order: items[i],
                      status: s,
                      onRefresh: _fetch,
                    );
                  },
                ),
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  String _statusLabel(String s) {
    switch (s) {
      case 'pending':  return 'Chờ duyệt';
      case 'approved': return 'Đã duyệt';
      case 'rejected': return 'Từ chối';
      default:         return s;
    }
  }
}

// ─── Fee Card ─────────────────────────────────────────
class _FeeCard extends StatelessWidget {
  final Map<String, dynamic> order;
  final String status;
  final VoidCallback onRefresh;

  const _FeeCard({required this.order, required this.status, required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    final fee       = order['extra_fee'] as int? ?? 0;
    final note      = order['extra_fee_note'] as String?;
    final rejected  = order['extra_fee_rejected_reason'] as String?;
    final loc       = (order['delivery_location'] as Map?)  ?? {};
    final proofUrl  = order['delivery_proof_url'] as String?;
    final delivAt   = order['delivered_at'] as String?;
    final payStatus = _ExtraFeesTabState._paymentStatus(order);
    final items = order['voucher_items'] as List? ?? [];
    final voucherCode = items.isNotEmpty ? (items.first as Map?)?['voucher']?['voucher_code'] as String? : null;

    Color amountColor;
    Color cardBorder;
    Widget statusBadge;

    switch (payStatus) {
      case 'approved':
        amountColor = const Color(0xFF059669);
        cardBorder  = const Color(0xFF86EFAC);
        statusBadge = _statusChip('✅ Đã duyệt', const Color(0xFFDCFCE7), const Color(0xFF166534));
      case 'approved_vouchered':
        amountColor = const Color(0xFF0369A1);
        cardBorder  = const Color(0xFFBAE6FD);
        statusBadge = _statusChip('📋 Trong chứng từ', const Color(0xFFE0F2FE), const Color(0xFF0369A1));
      case 'approved_paid':
        amountColor = const Color(0xFF15803D);
        cardBorder  = const Color(0xFF4ADE80);
        statusBadge = _statusChip('💵 Đã chi trả', const Color(0xFFF0FDF4), const Color(0xFF15803D));
      case 'rejected':
        amountColor = const Color(0xFF9CA3AF);
        cardBorder  = const Color(0xFFFCA5A5);
        statusBadge = _statusChip('❌ Từ chối', const Color(0xFFFEE2E2), const Color(0xFF991B1B));
      default: // pending
        amountColor = const Color(0xFFD97706);
        cardBorder  = const Color(0xFFFDE68A);
        statusBadge = _statusChip('⏳ Chờ duyệt', const Color(0xFFFEF9C3), const Color(0xFF92400E));
    }


    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: cardBorder),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 4, offset: const Offset(0, 2))],
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header row
            Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(order['code'] as String? ?? '—',
                      style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w700, color: const Color(0xFF0F172A))),
                  if (loc['name'] != null)
                    Text(loc['name'] as String, style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
                  if (delivAt != null)
                    Text(DateFormat('dd/MM/yyyy').format(DateTime.parse(delivAt).toLocal()),
                        style: const TextStyle(fontSize: 11, color: Color(0xFFCBD5E1))),
                ]),
              ),
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                // Amount — strikethrough if rejected
                Text('${_fmt.format(fee)} ₫',
                    style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w800,
                        color: amountColor,
                        decoration: payStatus == 'rejected' ? TextDecoration.lineThrough : null)),
                const SizedBox(height: 4),
                statusBadge,
                if (voucherCode != null) ...[
                  const SizedBox(height: 3),
                  Text(voucherCode, style: GoogleFonts.outfit(fontSize: 10, color: const Color(0xFF0369A1))),
                ],
              ]),
            ]),

            // Fee note
            if (note != null && note.isNotEmpty) ...[
              const SizedBox(height: 8),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(color: const Color(0xFFFFF7ED), borderRadius: BorderRadius.circular(8)),
                child: Text('"$note"', style: const TextStyle(fontSize: 12, color: Color(0xFF92400E), fontStyle: FontStyle.italic)),
              ),
            ],

            // Rejected reason
            if (payStatus == 'rejected' && rejected != null && rejected.isNotEmpty) ...[
              const SizedBox(height: 8),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(8)),
                child: Row(children: [
                  const Icon(Icons.info_outline_rounded, size: 14, color: Color(0xFF991B1B)),
                  const SizedBox(width: 6),
                  Expanded(child: Text('Lý do: $rejected',
                      style: const TextStyle(fontSize: 12, color: Color(0xFF991B1B)))),
                ]),
              ),
            ],

            // Proof photo thumbnail
            if (proofUrl != null) ...[
              const SizedBox(height: 10),
              GestureDetector(
                onTap: () => _showProofPhoto(context, proofUrl),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: Stack(
                    children: [
                      CachedNetworkImage(
                        imageUrl: proofUrl,
                        cacheManager: AppImageCacheManager.instance,
                        height: 120, width: double.infinity, fit: BoxFit.cover,
                        placeholder: (_, __) => Container(height: 120, color: const Color(0xFFF1F5F9), child: const Center(child: CircularProgressIndicator(strokeWidth: 2))),
                        errorWidget: (_, __, ___) => const SizedBox.shrink(),
                      ),
                      Positioned(bottom: 6, right: 6, child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(6)),
                        child: const Text('Xem ảnh', style: TextStyle(color: Colors.white, fontSize: 11)),
                      )),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _statusChip(String label, Color bg, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
    child: Text(label, style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.w700, color: color)),
  );

  void _showProofPhoto(BuildContext context, String url) {
    // Push a full screen page instead of Dialog to avoid UI freeze
    Navigator.of(context).push(MaterialPageRoute(
      fullscreenDialog: true,
      builder: (_) => _ProofPhotoPage(url: url),
    ));
  }
}

// ─── Full-Screen Proof Photo Viewer ───────────────────
class _ProofPhotoPage extends StatelessWidget {
  final String url;
  const _ProofPhotoPage({required this.url});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: const Text('Ảnh chứng minh', style: TextStyle(color: Colors.white, fontSize: 14)),
        leading: IconButton(
          icon: const Icon(Icons.close_rounded, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: InteractiveViewer(
        minScale: 0.5,
        maxScale: 4.0,
        child: Center(
          child: CachedNetworkImage(
            imageUrl: url,
            cacheManager: AppImageCacheManager.instance,
            fit: BoxFit.contain,
            placeholder: (_, __) => const Center(child: CircularProgressIndicator(color: Colors.white)),
            errorWidget: (_, __, ___) => const Center(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Icon(Icons.broken_image_rounded, size: 48, color: Colors.white54),
                SizedBox(height: 12),
                Text('Không tải được ảnh', style: TextStyle(color: Colors.white54, fontSize: 13)),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}


// ─── Tab 2: Chứng từ chi trả ──────────────────────────
class _VouchersTab extends StatefulWidget {
  const _VouchersTab();
  @override
  State<_VouchersTab> createState() => _VouchersTabState();
}

class _VouchersTabState extends State<_VouchersTab> {
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

  Future<void> _confirmReceived(String voucherId, int amount) async {
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

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_vouchers.isEmpty) {
      return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.receipt_long_rounded, size: 60, color: Color(0xFFCBD5E1)),
        const SizedBox(height: 12),
        Text('Chưa có chứng từ chi trả',
            style: GoogleFonts.outfit(fontSize: 15, color: const Color(0xFF94A3B8))),
      ]));
    }
    return RefreshIndicator(
      onRefresh: _fetch,
      child: ListView.builder(
        padding: const EdgeInsets.all(14),
        itemCount: _vouchers.length,
        itemBuilder: (_, i) {
          final v = _vouchers[i];
          final isExpanded = _expandedId == v['id'];
          final items  = (v['items'] as List?) ?? [];
          final amount = v['total_amount'] as int? ?? 0;
          final status = v['status'] as String? ?? 'pending';
          final paidAt = v['paid_at'] as String?;

          final statusCfg = <String, Map<String, dynamic>>{
            'pending':   {'label': '⏳ Chờ chi trả',  'bg': const Color(0xFFFEF9C3), 'color': const Color(0xFF92400E)},
            'paid':      {'label': '💵 Đã chi',       'bg': const Color(0xFFDCFCE7), 'color': const Color(0xFF166534)},
            'confirmed': {'label': '✅ Đã xác nhận',  'bg': const Color(0xFFEFF6FF), 'color': const Color(0xFF1D4ED8)},
          };
          final cfg = statusCfg[status] ?? statusCfg['pending']!;

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
                GestureDetector(
                  onTap: () => setState(() => _expandedId = isExpanded ? null : v['id'] as String),
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Row(children: [
                      Container(
                        width: 44, height: 44,
                        decoration: BoxDecoration(
                          color: status == 'confirmed' ? const Color(0xFFDCFCE7) : const Color(0xFFF0FDF4),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(Icons.receipt_long_rounded, size: 22, color: Color(0xFF059669)),
                      ),
                      const SizedBox(width: 12),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          Text(v['voucher_code'] as String,
                              style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w700, color: const Color(0xFF0F172A))),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(color: cfg['bg'] as Color, borderRadius: BorderRadius.circular(20)),
                            child: Text(cfg['label'] as String,
                                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: cfg['color'] as Color)),
                          ),
                        ]),
                        const SizedBox(height: 3),
                        Text(
                          '${items.length} đơn  •  ${paidAt != null ? DateFormat('dd/MM/yyyy').format(DateTime.parse(paidAt).toLocal()) : '—'}',
                          style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                        ),
                      ])),
                      Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                        Text('${_fmt.format(amount)} ₫',
                            style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w800, color: const Color(0xFF059669))),
                        Icon(isExpanded ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded,
                            size: 18, color: const Color(0xFF94A3B8)),
                      ]),
                    ]),
                  ),
                ),

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
                        Expanded(child: Text(
                          '${order['code'] ?? '—'}  •  ${loc['name'] ?? '—'}',
                          style: const TextStyle(fontSize: 12, color: Color(0xFF475569)),
                        )),
                        Text('${_fmt.format(item['amount'] ?? 0)} ₫',
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
                      ]),
                    );
                  }),

                  if (status == 'paid') ...[
                    const Divider(height: 1, color: Color(0xFFF1F5F9)),
                    Padding(
                      padding: const EdgeInsets.all(14),
                      child: SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          onPressed: () => _confirmReceived(v['id'] as String, amount),
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
    );
  }
}
