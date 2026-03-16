import 'dart:io';
import 'package:supabase_flutter/supabase_flutter.dart';

final _db = Supabase.instance.client;

/// Manages driver work shifts and status tracking.
class ShiftService {
  // ── Start a new shift ──────────────────────────────────────────
  /// [kmIn]: Chỉ số km vào ca (bắt buộc)
  /// [photoInUrl]: URL ảnh đồng hồ km vào ca (bắt buộc)
  static Future<String> startShift({
    required int kmIn,
    required String photoInUrl,
  }) async {
    final uid = _db.auth.currentUser!.id;
    final now = DateTime.now().toUtc().toIso8601String();

    // Validate: km_in must be > last shift's km_out if any
    final lastShift = await _db.from('driver_shifts')
        .select('km_out')
        .eq('driver_id', uid)
        .not('km_out', 'is', null)
        .order('created_at', ascending: false)
        .limit(1);

    if (lastShift.isNotEmpty) {
      final lastKmOut = lastShift.first['km_out'] as int?;
      if (lastKmOut != null && kmIn < lastKmOut) {
        throw Exception(
            'Chỉ số km vào ca ($kmIn km) không hợp lệ. '
            'Phải lớn hơn chỉ số km ra ca trước ($lastKmOut km).');
      }
    }

    // Create shift record
    final res = await _db.from('driver_shifts').insert({
      'driver_id': uid,
      'status': 'active',
      'status_log': [{'status': 'free', 'ts': now}],
      'km_in': kmIn,
      'odometer_photo_in_url': photoInUrl,
    }).select('id').single();

    // Update profile cache
    await _db.from('profiles').update({
      'shift_status': 'on_shift',
      'driver_status': 'free',
    }).eq('id', uid);

    return res['id'] as String;
  }

  // ── End current shift ──────────────────────────────────────────
  /// [kmOut]: Chỉ số km ra ca (bắt buộc, phải > km_in)
  /// [photoOutUrl]: URL ảnh đồng hồ km ra ca (bắt buộc)
  static Future<void> endShift(
    String shiftId, {
    required int kmOut,
    required String photoOutUrl,
  }) async {
    final uid = _db.auth.currentUser!.id;
    final now = DateTime.now().toUtc().toIso8601String();

    // Fetch shift to validate kmOut > kmIn
    final shift = await _db.from('driver_shifts')
        .select('status_log, km_in').eq('id', shiftId).single();

    final kmIn = shift['km_in'] as int?;
    if (kmIn != null && kmOut <= kmIn) {
      throw Exception(
          'Chỉ số km ra ca ($kmOut km) phải lớn hơn km vào ca ($kmIn km).');
    }

    final log = List<Map<String, dynamic>>.from(shift['status_log'] as List);
    log.add({'status': 'off_shift', 'ts': now});

    await _db.from('driver_shifts').update({
      'status': 'ended',
      'ended_at': now,
      'status_log': log,
      'km_out': kmOut,
      'odometer_photo_out_url': photoOutUrl,
    }).eq('id', shiftId);

    await _db.from('profiles').update({
      'shift_status': 'off_shift',
      'driver_status': null,
    }).eq('id', uid);
  }

  // ── Upload odometer photo ──────────────────────────────────────
  /// Uploads an odometer image to Supabase Storage.
  /// Returns the public URL.
  static Future<String> uploadOdometerPhoto({
    required File photo,
    required String shiftId,
    required bool isCheckIn,
  }) async {
    final uid = _db.auth.currentUser!.id;
    final suffix = isCheckIn ? 'in' : 'out';
    final path = '$uid/$shiftId/$suffix.jpg';

    final bytes = await photo.readAsBytes();
    await _db.storage
        .from('odometer-photos')
        .uploadBinary(path, bytes,
            fileOptions: const FileOptions(upsert: true, contentType: 'image/jpeg'));

    return _db.storage.from('odometer-photos').getPublicUrl(path);
  }

  // ── Update driver_status during shift ─────────────────────────
  static Future<void> setDriverStatus(
    String shiftId,
    String status, // 'free' | 'delivering'
  ) async {
    final uid  = _db.auth.currentUser!.id;
    final now  = DateTime.now().toUtc().toIso8601String();

    final shift = await _db.from('driver_shifts')
        .select('status_log').eq('id', shiftId).single();
    final log = List<Map<String, dynamic>>.from(shift['status_log'] as List);
    log.add({'status': status, 'ts': now});

    await _db.from('driver_shifts').update({'status_log': log}).eq('id', shiftId);
    await _db.from('profiles').update({'driver_status': status}).eq('id', uid);
  }

  // ── Fetch active shift for current driver ──────────────────────
  static Future<Map<String, dynamic>?> getActiveShift() async {
    final uid = _db.auth.currentUser!.id;
    final res = await _db.from('driver_shifts')
        .select()
        .eq('driver_id', uid)
        .eq('status', 'active')
        .order('started_at', ascending: false)
        .limit(1);
    return res.isEmpty ? null : Map<String, dynamic>.from(res.first);
  }
}
