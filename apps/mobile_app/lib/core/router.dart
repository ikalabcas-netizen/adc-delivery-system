import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../features/auth/login_screen.dart';
import '../features/auth/pending_screen.dart';
import '../features/orders/orders_screen.dart';
import '../features/orders/order_detail_screen.dart';
import '../features/profile/profile_screen.dart';
import '../features/shell/app_shell.dart';

final supabase = Supabase.instance.client;

final router = GoRouter(
  initialLocation: '/orders',
  redirect: (context, state) {
    final session = supabase.auth.currentSession;
    final isOnLogin = state.matchedLocation == '/login';
    final isOnPending = state.matchedLocation == '/pending';

    // Not logged in → go to login
    if (session == null) {
      return isOnLogin ? null : '/login';
    }

    // Logged in but on login page → go to orders
    if (isOnLogin) return '/orders';

    // Check if user is approved (we check profile)
    // pending screen is allowed even if approved
    return null;
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
          path: '/profile',
          builder: (_, __) => const ProfileScreen(),
        ),
      ],
    ),
  ],
);
