import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../shifts/daily_review_popup.dart';


/// Bottom navigation shell
/// Tab order (bên trái → phải): Ca làm việc | Đơn hàng | Chuyến đi
/// Profile / Góp ý / Đăng xuất → hamburger menu (top-right).
class AppShell extends StatefulWidget {
  final Widget child;
  const AppShell({super.key, required this.child});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> with WidgetsBindingObserver {
  static const _tabs = ['/shift', '/orders', '/trips', '/costs'];
  String? _shiftStatus; // 'on_shift' | 'off_shift' | null
  StreamSubscription? _sub;
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadShiftStatus();
    _subscribeShiftStatus();
    // Poll every 120s as safety net (Realtime subscription handles instant updates)
    _pollTimer = Timer.periodic(const Duration(seconds: 120), (_) => _loadShiftStatus());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _sub?.cancel();
    _pollTimer?.cancel();
    super.dispose();
  }

  // Re-fetch when app comes back to foreground
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _loadShiftStatus();
    }
  }

  Future<void> _loadShiftStatus() async {
    final uid = Supabase.instance.client.auth.currentUser?.id;
    if (uid == null) return;
    final row = await Supabase.instance.client
        .from('profiles')
        .select('shift_status')
        .eq('id', uid)
        .maybeSingle();
    if (mounted) {
      setState(() => _shiftStatus = row?['shift_status'] as String?);
      // Check for unread daily review popup (1s delay so UI settles)
      Future.delayed(const Duration(seconds: 1), () {
        if (mounted) DailyReviewPopup.checkAndShow(context);
      });
    }
  }

  void _subscribeShiftStatus() {
    final uid = Supabase.instance.client.auth.currentUser?.id;
    if (uid == null) return;
    _sub = Supabase.instance.client
        .from('profiles')
        .stream(primaryKey: ['id'])
        .eq('id', uid)
        .listen((rows) {
          if (!mounted || rows.isEmpty) return;
          setState(() => _shiftStatus = rows.first['shift_status'] as String?);
        });
  }

  int _tabIndex(BuildContext context) {
    final loc = GoRouterState.of(context).matchedLocation;
    if (loc.startsWith('/shift'))  return 0;
    if (loc.startsWith('/orders')) return 1;
    if (loc.startsWith('/trips'))  return 2;
    if (loc.startsWith('/costs'))  return 3;
    return 0;
  }

  bool get _isOnShift => _shiftStatus == 'on_shift';

  @override
  Widget build(BuildContext context) {
    final tabIndex = _tabIndex(context);

    // If off-shift and accessing orders/trips → show gate overlay
    // Costs tab (index 3) is always accessible without a shift
    final bool locked = !_isOnShift && tabIndex != 0 && tabIndex != 3;

    return Scaffold(
      body: Stack(
        children: [
          widget.child,
          if (locked) ShiftGateOverlay(
            onGoToShift: () => context.go('/shift'),
          ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: tabIndex,
        backgroundColor: Theme.of(context).brightness == Brightness.dark
            ? const Color(0xFF0F172A)
            : Colors.white,
        surfaceTintColor: Colors.transparent,
        shadowColor: Colors.black26,
        elevation: 8,
        onDestinationSelected: (i) {
          context.go(_tabs[i]);
          // Re-fetch shift status every time user taps a tab
          _loadShiftStatus();
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.access_time_outlined),
            selectedIcon: Icon(Icons.access_time_filled),
            label: 'Ca làm việc',
          ),
          NavigationDestination(
            icon: Icon(Icons.inbox_outlined),
            selectedIcon: Icon(Icons.inbox),
            label: 'Đơn hàng',
          ),
          NavigationDestination(
            icon: Icon(Icons.local_shipping_outlined),
            selectedIcon: Icon(Icons.local_shipping),
            label: 'Chuyến đi',
          ),
          NavigationDestination(
            icon: Icon(Icons.receipt_long_outlined),
            selectedIcon: Icon(Icons.receipt_long),
            label: 'Chi phí',
          ),
        ],
      ),
    );
  }
}

/// Overlay shown when driver hasn't started their shift.
class ShiftGateOverlay extends StatelessWidget {
  final VoidCallback onGoToShift;
  const ShiftGateOverlay({super.key, required this.onGoToShift});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFF0F172A).withOpacity(0.72),
      child: Center(
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 32),
          padding: const EdgeInsets.all(28),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            boxShadow: [BoxShadow(color: Colors.black26, blurRadius: 24, offset: const Offset(0, 8))],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 64, height: 64, decoration: BoxDecoration(
                  color: const Color(0xFFECFEFF), borderRadius: BorderRadius.circular(16),
                ),
                child: const Icon(Icons.lock_clock_rounded, size: 32, color: Color(0xFF0891B2)),
              ),
              const SizedBox(height: 16),
              const Text(
                'Chưa vào ca làm việc',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              const Text(
                'Vui lòng vào ca để bắt đầu nhận\nvà giao đơn hàng.',
                style: TextStyle(fontSize: 13, color: Color(0xFF64748B), height: 1.5),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: onGoToShift,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0891B2),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: 0,
                  ),
                  child: const Text('Vào Ca Ngay  →', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Hamburger menu button — shown in AppBar top-right.
class HamburgerMenu extends StatelessWidget {
  const HamburgerMenu({super.key});

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<String>(
      icon: const Icon(Icons.menu_rounded, color: Colors.white),
      color: Colors.white,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      offset: const Offset(0, 44),
      itemBuilder: (_) => [
        PopupMenuItem(
          value: 'profile',
          child: _menuItem(Icons.person_outline_rounded, 'Hồ sơ'),
        ),
        PopupMenuItem(
          value: 'feedback',
          child: _menuItem(Icons.feedback_outlined, 'Góp ý'),
        ),
        PopupMenuItem(
          value: 'payment',
          child: _menuItem(Icons.receipt_long_outlined, 'Phụ phí & Chi trả'),
        ),
        const PopupMenuDivider(),
        PopupMenuItem(
          value: 'logout',
          child: _menuItem(Icons.logout_rounded, 'Đăng xuất', color: const Color(0xFFDC2626)),
        ),
      ],
      onSelected: (val) async {
        switch (val) {
          case 'profile':
            context.go('/profile');
          case 'feedback':
            context.go('/feedback');
          case 'payment':
            context.go('/costs');
          case 'logout':
            await Supabase.instance.client.auth.signOut();
            if (context.mounted) context.go('/login');
        }
      },
    );
  }

  Widget _menuItem(IconData icon, String label, {Color? color}) => Row(children: [
    Icon(icon, size: 18, color: color ?? const Color(0xFF0891B2)),
    const SizedBox(width: 10),
    Text(label, style: TextStyle(
      fontSize: 14, fontWeight: FontWeight.w500,
      color: color ?? const Color(0xFF1E293B),
    )),
  ]);
}
