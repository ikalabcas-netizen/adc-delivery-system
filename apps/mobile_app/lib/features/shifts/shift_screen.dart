import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'shift_service.dart';
import 'odometer_capture_screen.dart';
import '../shell/app_shell.dart';

class ShiftScreen extends StatefulWidget {
  const ShiftScreen({super.key});
  @override
  State<ShiftScreen> createState() => _ShiftScreenState();
}

class _ShiftScreenState extends State<ShiftScreen> {
  Map<String, dynamic>? _activeShift;
  Map<String, dynamic>? _profile;
  bool _loading = true;
  bool _processing = false;
  Timer? _timer;
  Duration _elapsed = Duration.zero;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final uid = Supabase.instance.client.auth.currentUser?.id;
    if (uid == null) { setState(() => _loading = false); return; }

    final shift   = await ShiftService.getActiveShift();
    final profile = await Supabase.instance.client
        .from('profiles').select().eq('id', uid).single();

    setState(() {
      _activeShift = shift;
      _profile = Map<String, dynamic>.from(profile);
      _loading = false;
    });

    if (shift != null) _startTimer(shift['started_at'] as String);
  }

  void _startTimer(String startedAt) {
    _timer?.cancel();
    final startDt = DateTime.parse(startedAt).toLocal();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) {
        setState(() => _elapsed = DateTime.now().difference(startDt));
      }
    });
  }

  Future<void> _startShift() async {
    // Step 1: Odometer capture
    final result = await Navigator.of(context).push<OdometerResult>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => const OdometerCaptureScreen(isCheckIn: true),
      ),
    );
    if (result == null || !mounted) return;

    setState(() => _processing = true);
    try {
      // Step 2: Upload photo (need a temp shiftId — create shift first)
      // We upload after we have the shiftId from startShift
      // So we first start shift, then update with photo URL
      final shiftId = await ShiftService.startShift(
        kmIn: result.kmValue,
        photoInUrl: '', // placeholder, will update below
      );
      final photoUrl = await ShiftService.uploadOdometerPhoto(
        photo: result.photo,
        shiftId: shiftId,
        isCheckIn: true,
      );
      // Update shift record with real photo URL
      await Supabase.instance.client.from('driver_shifts')
          .update({'odometer_photo_in_url': photoUrl}).eq('id', shiftId);

      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('✓ Đã vào ca!'), backgroundColor: Color(0xFF059669)),
        );
      }
    } catch (e) {
      if (mounted) _showError('$e');
    } finally {
      if (mounted) setState(() => _processing = false);
    }
  }

  Future<void> _endShift() async {
    // Step 0: Check for unfinished trips
    final uid = Supabase.instance.client.auth.currentUser?.id;
    if (uid != null) {
      final activeTrips = await Supabase.instance.client
          .from('trips')
          .select('id')
          .eq('driver_id', uid)
          .eq('status', 'active')
          .limit(1);
      if (!mounted) return;
      if ((activeTrips as List).isNotEmpty) {
        final choice = await showDialog<String>(
          context: context,
          barrierDismissible: false,
          builder: (_) => AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            icon: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF3C7),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.warning_amber_rounded, color: Color(0xFFD97706), size: 32),
            ),
            title: const Text(
              'Còn chuyến đi chưa hoàn thành',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
            ),
            content: const Text(
              'Bạn đang có chuyến đi chưa hoàn thành. Nên hoàn thành chuyến trước khi ra ca.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, color: Color(0xFF64748B), height: 1.5),
            ),
            actionsAlignment: MainAxisAlignment.center,
            actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            actions: [
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () => Navigator.pop(_, 'go_trip'),
                  icon: const Icon(Icons.local_shipping_rounded),
                  label: const Text('Hoàn thành chuyến'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF0891B2),
                    side: const BorderSide(color: Color(0xFF0891B2)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: TextButton(
                  onPressed: () => Navigator.pop(_, 'continue'),
                  child: const Text(
                    'Vẫn tiếp tục ra ca',
                    style: TextStyle(color: Color(0xFF94A3B8), fontSize: 14),
                  ),
                ),
              ),
            ],
          ),
        );
        if (!mounted) return;
        if (choice == 'go_trip') {
          // Navigate to trips tab
          if (mounted) context.go('/trips');
          return;
        }
        // choice == 'continue' → proceed to end shift
      }
    }

    // Step 1: Odometer capture for check-out
    final kmIn = _activeShift?['km_in'] as int?;
    final result = await Navigator.of(context).push<OdometerResult>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => OdometerCaptureScreen(isCheckIn: false, previousKm: kmIn),
      ),
    );
    if (result == null || !mounted) return;

    // Step 2: Confirm dialog
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => _EndShiftDialog(shift: _activeShift!),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _processing = true);
    try {
      final shiftId = _activeShift!['id'] as String;
      final photoUrl = await ShiftService.uploadOdometerPhoto(
        photo: result.photo,
        shiftId: shiftId,
        isCheckIn: false,
      );
      await ShiftService.endShift(
        shiftId,
        kmOut: result.kmValue,
        photoOutUrl: photoUrl,
      );
      _timer?.cancel();
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Ca làm việc đã kết thúc'), backgroundColor: Color(0xFF0891B2)),
        );
      }
    } catch (e) {
      if (mounted) _showError('$e');
    } finally {
      if (mounted) setState(() => _processing = false);
    }
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Lỗi: $msg'), backgroundColor: Colors.red),
    );
  }

  // ── Helpers ───────────────────────────────────────────────────
  String _fmtElapsed(Duration d) {
    final h = d.inHours.toString().padLeft(2, '0');
    final m = (d.inMinutes % 60).toString().padLeft(2, '0');
    final s = (d.inSeconds % 60).toString().padLeft(2, '0');
    return '$h:$m:$s';
  }

  String _fmtTime(String iso) {
    final dt = DateTime.parse(iso).toLocal();
    return '${dt.hour.toString().padLeft(2,'0')}:${dt.minute.toString().padLeft(2,'0')}';
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));

    final isOnShift    = _activeShift != null;
    final driverStatus = _profile?['driver_status'] as String?;
    final isDelivering = driverStatus == 'delivering';

    return Scaffold(
      backgroundColor: const Color(0xFFEFF6FF),
      appBar: AppBar(
        title: const Text('Ca làm việc'),
        actions: const [HamburgerMenu(), SizedBox(width: 4)],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            // ── Status card ──────────────────────────────────
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: isOnShift
                      ? [const Color(0xFF0A3444), const Color(0xFF0C4A6E)]
                      : [const Color(0xFF334155), const Color(0xFF475569)],
                  begin: Alignment.topLeft, end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: (isOnShift ? const Color(0xFF0891B2) : Colors.black).withValues(alpha: 0.25),
                    blurRadius: 16, offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: Column(
                children: [
                  // Status icon
                  Container(
                    width: 72, height: 72,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Center(
                      child: Text(isOnShift ? (isDelivering ? '🚚' : '🟢') : '🔴',
                          style: const TextStyle(fontSize: 36)),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    isOnShift
                        ? (isDelivering ? 'Đang giao hàng' : 'Đang rảnh trong ca')
                        : 'Chưa vào ca',
                    style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.w700, color: Colors.white),
                  ),
                  if (isOnShift) ...[
                    const SizedBox(height: 6),
                    Text(
                      'Ca từ ${_fmtTime(_activeShift!['started_at'] as String)}  •  ${_fmtElapsed(_elapsed)}',
                      style: TextStyle(fontSize: 13, color: Colors.white.withValues(alpha: 0.7)),
                    ),
                    if (_activeShift!['km_in'] != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        '🛥 Km vào ca: ${_activeShift!['km_in']} km',
                        style: TextStyle(fontSize: 12, color: Colors.white.withValues(alpha: 0.6)),
                      ),
                    ],
                  ],
                ],
              ),
            ),
            const SizedBox(height: 24),

            // ── Status log if on shift ───────────────────────
            if (isOnShift) ...[
              _buildLogCard(_activeShift!['status_log'] as List),
              const SizedBox(height: 20),
            ],

            // ── Action button ────────────────────────────────
            SizedBox(
              width: double.infinity, height: 56,
              child: _processing
                  ? const Center(child: CircularProgressIndicator())
                  : isOnShift
                      ? FilledButton.icon(
                          style: FilledButton.styleFrom(
                            backgroundColor: const Color(0xFFDC2626),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          ),
                          onPressed: _endShift,
                          icon: const Icon(Icons.stop_circle_rounded, size: 20),
                          label: Text('Kết thúc ca làm việc',
                              style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w700)),
                        )
                      : FilledButton.icon(
                          style: FilledButton.styleFrom(
                            backgroundColor: const Color(0xFF059669),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          ),
                          onPressed: _startShift,
                          icon: const Icon(Icons.play_circle_rounded, size: 20),
                          label: Text('Bắt đầu ca làm việc',
                              style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w700)),
                        ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLogCard(List log) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Nhật ký trạng thái',
              style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w700,
                  color: const Color(0xFF94A3B8), letterSpacing: 0.5)),
          const SizedBox(height: 10),
          ...log.reversed.take(8).map((e) {
            final s  = e['status'] as String;
            final ts = DateTime.parse(e['ts'] as String).toLocal();
            final label = s == 'free' ? 'Đang rảnh' : s == 'delivering' ? 'Đang giao hàng' : 'Kết thúc ca';
            final color = s == 'delivering' ? const Color(0xFF7C3AED) : s == 'free' ? const Color(0xFF059669) : const Color(0xFF94A3B8);
            return Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(children: [
                Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
                const SizedBox(width: 8),
                Expanded(child: Text(label, style: TextStyle(fontSize: 12, color: color, fontWeight: FontWeight.w600))),
                Text('${ts.hour.toString().padLeft(2,'0')}:${ts.minute.toString().padLeft(2,'0')}',
                    style: const TextStyle(fontSize: 11, color: Color(0xFFCBD5E1))),
              ]),
            );
          }),
        ],
      ),
    );
  }
}

// ─── End Shift Confirm Dialog ────────────────────────────────
class _EndShiftDialog extends StatelessWidget {
  final Map<String, dynamic> shift;
  const _EndShiftDialog({required this.shift});

  @override
  Widget build(BuildContext context) {
    final startedAt = DateTime.parse(shift['started_at'] as String).toLocal();
    final duration  = DateTime.now().difference(startedAt);
    final h = duration.inHours;
    final m = duration.inMinutes % 60;

    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: const Text('Kết thúc ca?'),
      content: Text('Bạn đã làm việc $h giờ $m phút.\nNhật ký sẽ được lưu lại.'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Huỷ')),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
          onPressed: () => Navigator.pop(context, true),
          child: const Text('Kết thúc ca'),
        ),
      ],
    );
  }
}
