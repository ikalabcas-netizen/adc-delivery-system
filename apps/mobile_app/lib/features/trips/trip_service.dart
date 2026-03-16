import 'package:supabase_flutter/supabase_flutter.dart';

final _supabase = Supabase.instance.client;

class TripService {
  /// Tạo chuyến đi và bắt đầu giao ngay.
  /// 1. Tạo trip record (status = active)
  /// 2. Gán trip_id + chuyển status → in_transit cho tất cả đơn
  static Future<String> createAndStartTrip(List<String> orderIds) async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) throw Exception('Chưa đăng nhập');
    if (orderIds.isEmpty) throw Exception('Chưa chọn đơn nào');

    // 1. Tạo trip
    final trip = await _supabase
        .from('trips')
        .insert({
          'driver_id': userId,
          'status': 'active',
          'started_at': DateTime.now().toIso8601String(),
        })
        .select()
        .single();

    final tripId = trip['id'] as String;

    // 2. Gán orders vào trip + chuyển sang in_transit
    await _supabase
        .from('orders')
        .update({'trip_id': tripId, 'status': 'in_transit'})
        .inFilter('id', orderIds);

    return tripId;
  }
}
