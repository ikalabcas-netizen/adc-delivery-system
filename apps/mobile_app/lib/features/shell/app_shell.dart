import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Bottom navigation shell — Đơn hàng | Chuyến đi | Ca làm việc
/// Profile moved to top-right hamburger menu.
class AppShell extends StatelessWidget {
  final Widget child;
  const AppShell({super.key, required this.child});

  static const _tabs = ['/orders', '/trips', '/shift'];

  int _tabIndex(BuildContext context) {
    final loc = GoRouterState.of(context).matchedLocation;
    if (loc.startsWith('/trips'))  return 1;
    if (loc.startsWith('/shift'))  return 2;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final tabIndex = _tabIndex(context);
    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: tabIndex,
        onDestinationSelected: (i) {
          switch (i) {
            case 0: context.go('/orders'); break;
            case 1: context.go('/trips');  break;
            case 2: context.go('/shift');  break;
          }
        },
        destinations: const [
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
            icon: Icon(Icons.access_time_outlined),
            selectedIcon: Icon(Icons.access_time_filled),
            label: 'Ca làm việc',
          ),
        ],
      ),
    );
  }
}

/// Hamburger menu button — shown in AppBar top-right.
/// Wraps profile, feedback, logout.
class HamburgerMenu extends StatelessWidget {
  const HamburgerMenu({super.key});

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<String>(
      icon: Container(
        width: 36, height: 36,
        decoration: BoxDecoration(
          color: const Color(0xFF0A3444).withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(10),
        ),
        child: const Icon(Icons.menu_rounded, size: 20, color: Color(0xFF0A3444)),
      ),
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
            // TODO: open feedback form
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Chức năng góp ý sẽ sớm ra mắt')));
          case 'logout':
            await Supabase.instance.client.auth.signOut();
            if (context.mounted) context.go('/login');
        }
      },
    );
  }

  Widget _menuItem(IconData icon, String label, {Color? color}) => Row(children: [
    Icon(icon, size: 18, color: color ?? const Color(0xFF475569)),
    const SizedBox(width: 10),
    Text(label, style: TextStyle(fontSize: 14, color: color ?? const Color(0xFF0f172a))),
  ]);
}
