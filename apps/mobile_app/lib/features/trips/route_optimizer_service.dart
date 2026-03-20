import 'dart:convert';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Result from the optimize-route Edge Function
class OptimizedRouteResult {
  final List<Map<String, dynamic>> optimizedRoute;
  final double totalDistanceKm;
  final int totalDurationMin;
  final bool fromCache;

  OptimizedRouteResult({
    required this.optimizedRoute,
    required this.totalDistanceKm,
    required this.totalDurationMin,
    required this.fromCache,
  });

  factory OptimizedRouteResult.fromJson(Map<String, dynamic> json) {
    final route = json['optimized_route'];
    return OptimizedRouteResult(
      optimizedRoute: route is List ? route.cast<Map<String, dynamic>>() : [],
      totalDistanceKm: (json['total_distance_km'] as num?)?.toDouble() ?? 0,
      totalDurationMin: (json['total_duration_min'] as num?)?.toInt() ?? 0,
      fromCache: json['fromCache'] == true,
    );
  }
}

/// Service that calls the Supabase Edge Function 'optimize-route'
/// to get ORS-optimized route for a trip's orders.
class RouteOptimizerService {
  static final _supabase = Supabase.instance.client;

  /// Optimize the route for a trip.
  /// The trip must already exist in DB with orders assigned.
  ///
  /// Returns [OptimizedRouteResult] with reordered stops, distance, duration.
  /// Throws on network/server errors.
  static Future<OptimizedRouteResult> optimize(String tripId) async {
    final response = await _supabase.functions.invoke(
      'optimize-route',
      body: {'tripId': tripId},
    );

    if (response.status != 200) {
      final errorMsg = response.data is Map
          ? (response.data['error'] ?? 'Route optimization failed')
          : 'Route optimization failed (${response.status})';
      throw Exception(errorMsg);
    }

    final data = response.data is String
        ? jsonDecode(response.data) as Map<String, dynamic>
        : response.data as Map<String, dynamic>;

    return OptimizedRouteResult.fromJson(data);
  }
}
