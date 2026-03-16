import 'package:supabase_flutter/supabase_flutter.dart';
import '../shifts/shift_service.dart';

final _supabase = Supabase.instance.client;

class TripService {
  /// Tạo chuyến đi và bắt đầu giao ngay.
  static Future<String> createAndStartTrip(List<String> orderIds) async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) throw Exception('Chưa đăng nhập');
    if (orderIds.isEmpty) throw Exception('Chưa chọn đơn nào');

    final trip = await _supabase
        .from('trips')
        .insert({
          'driver_id': userId,
          'status': 'active',
          'started_at': DateTime.now().toUtc().toIso8601String(),
        })
        .select()
        .single();

    final tripId = trip['id'] as String;

    await _supabase
        .from('orders')
        .update({'trip_id': tripId, 'status': 'in_transit'})
        .inFilter('id', orderIds);

    // Set driver status = delivering
    final shift = await ShiftService.getActiveShift();
    if (shift != null) {
      await ShiftService.setDriverStatus(shift['id'] as String, 'delivering');
    }

    return tripId;
  }

  /// Kiểm tra xem tất cả đơn trong chuyến đã xong chưa.
  /// Nếu không còn đơn nào ở in_transit → đánh dấu chuyến completed.
  static Future<bool> checkAndCompleteTrip(String tripId) async {
    final rows = await _supabase
        .from('orders')
        .select('status')
        .eq('trip_id', tripId);

    final allDone = (rows as List).every(
      (o) => (o['status'] as String) != 'in_transit',
    );

    if (allDone) {
      await _supabase.from('trips').update({
        'status': 'completed',
        'completed_at': DateTime.now().toUtc().toIso8601String(),
      }).eq('id', tripId);

      // Driver is now free
      final shift = await ShiftService.getActiveShift();
      if (shift != null) {
        await ShiftService.setDriverStatus(shift['id'] as String, 'free');
      }
    }

    return allDone;
  }
}
