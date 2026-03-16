import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

/// DailyReviewPopup — shown on app start when driver has an unread review.
/// Call [DailyReviewPopup.checkAndShow] after app shell loads.
class DailyReviewPopup {
  static Future<void> checkAndShow(BuildContext context) async {
    final uid = Supabase.instance.client.auth.currentUser?.id;
    if (uid == null) return;

    try {
      final res = await Supabase.instance.client
          .from('driver_daily_reviews')
          .select()
          .eq('driver_id', uid)
          .eq('is_read', false)
          .order('review_date', ascending: false)
          .limit(1);

      if (res.isEmpty) return;
      final review = Map<String, dynamic>.from(res.first);

      // Mark as read immediately so we don't show again
      await Supabase.instance.client
          .from('driver_daily_reviews')
          .update({'is_read': true}).eq('id', review['id']);

      if (context.mounted) {
        await showDialog(
          context: context,
          barrierDismissible: false,
          builder: (_) => _DailyReviewDialog(review: review),
        );
      }
    } catch (_) {
      // Silent — popup is non-critical
    }
  }
}

class _DailyReviewDialog extends StatelessWidget {
  final Map<String, dynamic> review;
  const _DailyReviewDialog({required this.review});

  @override
  Widget build(BuildContext context) {
    final date = (review['review_date'] as String?) ?? '';
    final delivered = review['delivered'] as int? ?? 0;
    final total = review['total_orders'] as int? ?? 0;
    final rate = review['success_rate'] as num? ?? 0;
    final km = review['km_driven'] as int? ?? 0;
    final message = review['ai_message'] as String? ?? '';
    final tip = review['ai_tip'] as String? ?? '';
    final greeting = review['greeting'] as String? ?? 'Chúc một ngày làm việc tốt lành!';

    final rateColor = rate >= 90 ? const Color(0xFF059669) : rate >= 75 ? const Color(0xFFD97706) : const Color(0xFFDC2626);
    final emoji = rate >= 90 ? '🌟' : rate >= 75 ? '💪' : '📈';

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      backgroundColor: Colors.white,
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Header
              Container(
                width: 64, height: 64,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF0891B2), Color(0xFF0E7490)],
                    begin: Alignment.topLeft, end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(18),
                ),
                child: const Icon(Icons.insights_rounded, size: 32, color: Colors.white),
              ),
              const SizedBox(height: 14),
              Text('Hiệu suất ngày', style: GoogleFonts.outfit(fontSize: 11, color: const Color(0xFF94A3B8))),
              Text(date, style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w700, color: const Color(0xFF0F172A))),
              const SizedBox(height: 16),

              // Stats row
              Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: [
                _stat('$delivered/$total', 'Đơn hoàn thành', const Color(0xFF059669)),
                _statDivider(),
                _stat('${rate.toStringAsFixed(0)}%', 'Tỷ lệ', rateColor),
                _statDivider(),
                _stat('$km km', 'Quãng đường', const Color(0xFF0891B2)),
              ]),
              const SizedBox(height: 16),

              // AI message
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFF0F9FF),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFBAE6FD)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('$emoji Nhận xét AI', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF0891B2))),
                    const SizedBox(height: 6),
                    if (message.isNotEmpty) Text(message, style: const TextStyle(fontSize: 13, color: Color(0xFF0F172A), height: 1.5)),
                    if (tip.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(color: const Color(0xFFFEF9C3), borderRadius: BorderRadius.circular(8)),
                        child: Text('💡 $tip', style: const TextStyle(fontSize: 11, color: Color(0xFF92400E), height: 1.4)),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 14),

              // Greeting
              Text(greeting, textAlign: TextAlign.center,
                  style: GoogleFonts.outfit(fontSize: 13, fontStyle: FontStyle.italic, color: const Color(0xFF475569), height: 1.4)),
              const SizedBox(height: 20),

              // CTA
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () => Navigator.of(context).pop(),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF0891B2),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: Text('Bắt đầu ngày mới! 🚀', style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _stat(String value, String label, Color color) => Column(children: [
    Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: color)),
    const SizedBox(height: 2),
    Text(label, style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
  ]);

  Widget _statDivider() => Container(width: 1, height: 36, color: const Color(0xFFE2E8F0));
}
