import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../features/auth/login_screen.dart';
import '../features/auth/pending_screen.dart';
import '../features/orders/orders_screen.dart';
import '../features/orders/order_detail_screen.dart';
import '../features/profile/profile_screen.dart';
import '../features/shell/app_shell.dart';
import '../features/trips/trips_screen.dart';
import '../features/trips/trip_orders_screen.dart';
import '../features/shifts/shift_screen.dart';
import '../features/feedback/feedback_screen.dart';
import '../features/payments/payment_history_screen.dart';

final supabase = Supabase.instance.client;

final router = GoRouter(
  initialLocation: '/shift',
  redirect: (context, state) {
    final session = supabase.auth.currentSession;
    final loc = state.matchedLocation;
    final isOnLogin = loc == '/login';
    final isOnCallback = loc == '/login-callback';

    if (isOnCallback) {
      return session != null ? '/shift' : '/login';
    }
    if (session == null) {
      return isOnLogin ? null : '/login';
    }
    if (isOnLogin) return '/shift';
    return null;
  },
  errorBuilder: (context, state) {
    final session = supabase.auth.currentSession;
    return session != null ? const ShiftScreen() : const LoginScreen();
  },
  routes: [
    GoRoute(
      path: '/login',
      builder: (_, __) => const LoginScreen(),
    ),
    GoRoute(
      path: '/pending',
      builder: (_, __) => const PendingScreen(),
    ),
    GoRoute(
      path: '/login-callback',
      builder: (_, __) => const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      ),
    ),
    // Main app shell with bottom nav
    ShellRoute(
      builder: (_, __, child) => AppShell(child: child),
      routes: [
        GoRoute(
          path: '/orders',
          builder: (_, __) => const OrdersScreen(),
          routes: [
            GoRoute(
              path: ':id',
              builder: (_, state) => OrderDetailScreen(
                orderId: state.pathParameters['id']!,
              ),
            ),
          ],
        ),
        GoRoute(
          path: '/trips',
          builder: (_, __) => const TripsScreen(),
          routes: [
            GoRoute(
              path: ':id',
              builder: (_, state) => TripOrdersScreen(
                tripId: state.pathParameters['id']!,
              ),
            ),
          ],
        ),
        GoRoute(
          path: '/shift',
          builder: (_, __) => const ShiftScreen(),
        ),
        GoRoute(
          path: '/profile',
          builder: (_, __) => const ProfileScreen(),
        ),
        GoRoute(
          path: '/feedback',
          builder: (_, __) => const FeedbackScreen(),
        ),
        GoRoute(
          path: '/payment-history',
          builder: (_, __) => const PaymentHistoryScreen(),
        ),
      ],
    ),
  ],
);

/// Temporary placeholder screen — replaced when full feature is built.
class _PlaceholderScreen extends StatelessWidget {
  final String title;
  final IconData icon;
  const _PlaceholderScreen({required this.title, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(title),
        backgroundColor: const Color(0xFF0891B2),
        foregroundColor: Colors.white,
      ),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 64, color: const Color(0xFFCBD5E1)),
            const SizedBox(height: 16),
            Text(title, style: const TextStyle(fontSize: 16, color: Color(0xFF94A3B8))),
            const SizedBox(height: 6),
            const Text(
              'Tính năng đang được phát triển',
              style: TextStyle(fontSize: 12, color: Color(0xFFCBD5E1)),
            ),
          ],
        ),
      ),
    );
  }
}
