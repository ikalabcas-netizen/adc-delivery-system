import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

final _supabase = Supabase.instance.client;

class TripService {
  /// Tạo chuyến tự động từ danh sách đơn in_transit
  static Future<String> createAutoTrip(
      List<Map<String, dynamic>> orders) async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) throw Exception('Chưa đăng nhập');

    // Build waypoints từ delivery_location của mỗi đơn
    final waypoints = orders
        .where((o) => o['delivery_location'] != null)
        .map((o) {
          final loc = o['delivery_location'] as Map<String, dynamic>;
          return {
            'order_id': o['id'],
            'lat': (loc['lat'] as num?)?.toDouble() ?? 0.0,
            'lng': (loc['lng'] as num?)?.toDouble() ?? 0.0,
            'name': loc['name'] ?? '—',
          };
        })
        .toList();

    if (waypoints.isEmpty) throw Exception('Các đơn chưa có tọa độ giao hàng');

    // Gọi Edge Function để tối ưu tuyến đường
    List<Map<String, dynamic>> optimizedWaypoints;
    try {
      final res = await _supabase.functions.invoke(
        'optimize-route',
        body: {'waypoints': waypoints},
      );
      if (res.data != null && res.data['optimized'] != null) {
        optimizedWaypoints = List<Map<String, dynamic>>.from(
            res.data['optimized']);
      } else {
        optimizedWaypoints = waypoints;
      }
    } catch (e) {
      debugPrint('optimize-route error (fallback to NN): $e');
      optimizedWaypoints = _nearestNeighbor(waypoints);
    }

    // Tạo trip record
    final trip = await _supabase
        .from('trips')
        .insert({
          'driver_id': userId,
          'status': 'planned',
          'optimized_route': {'waypoints': optimizedWaypoints},
        })
        .select()
        .single();

    final tripId = trip['id'] as String;

    // Gán trip_id cho tất cả đơn
    final orderIds = orders.map((o) => o['id'] as String).toList();
    await _supabase
        .from('orders')
        .update({'trip_id': tripId})
        .inFilter('id', orderIds);

    return tripId;
  }

  /// Nearest-neighbor fallback (client-side)
  static List<Map<String, dynamic>> _nearestNeighbor(
      List<Map<String, dynamic>> points) {
    if (points.length <= 1) return points;
    final result = <Map<String, dynamic>>[];
    final remaining = [...points];
    var current = remaining.removeAt(0);
    result.add(current);
    while (remaining.isNotEmpty) {
      var minDist = double.infinity;
      var minIdx = 0;
      for (var i = 0; i < remaining.length; i++) {
        final dx = (remaining[i]['lat'] as double) - (current['lat'] as double);
        final dy = (remaining[i]['lng'] as double) - (current['lng'] as double);
        final d = dx * dx + dy * dy;
        if (d < minDist) {
          minDist = d;
          minIdx = i;
        }
      }
      current = remaining.removeAt(minIdx);
      result.add(current);
    }
    return result;
  }
}
