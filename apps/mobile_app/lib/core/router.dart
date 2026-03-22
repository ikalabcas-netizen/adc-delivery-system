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
import '../features/feedback/issues_screen.dart';
import '../features/payments/payment_history_screen.dart';
import '../features/costs/costs_screen.dart';

final supabase = Supabase.instance.client;

/// Notifier that refreshes GoRouter whenever auth state changes.
/// This ensures the router re-evaluates redirect() after OAuth callback sets session.
final _authNotifier = _SupabaseAuthNotifier();

class _SupabaseAuthNotifier extends ChangeNotifier {
  _SupabaseAuthNotifier() {
    supabase.auth.onAuthStateChange.listen((_) => notifyListeners());
  }
}

final router = GoRouter(
  initialLocation: '/shift',
  refreshListenable: _authNotifier,
  redirect: (context, state) {
    final session = supabase.auth.currentSession;
    final loc = state.matchedLocation;
    final isOnLogin    = loc == '/login';
    final isOnCallback = loc == '/login-callback';
    final isOnPending  = loc == '/pending';

    // While waiting at callback page, keep showing loading until session arrives
    if (isOnCallback) {
      return session != null ? '/shift' : null; // null = stay on loading screen
    }
    if (session == null) {
      return (isOnLogin || isOnPending) ? null : '/login';
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
          path: '/issues',
          builder: (_, __) => const IssuesScreen(),
        ),
        GoRoute(
          path: '/costs',
          builder: (_, __) => const CostsScreen(),
        ),
        GoRoute(
          path: '/payment-history',
          builder: (_, __) => const PaymentHistoryScreen(),
        ),
      ],
    ),
  ],
);
