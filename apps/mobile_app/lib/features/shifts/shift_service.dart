import 'package:supabase_flutter/supabase_flutter.dart';

final _db = Supabase.instance.client;

/// Manages driver work shifts and status tracking.
class ShiftService {
  // ── Start a new shift ──────────────────────────────────────────
  static Future<String> startShift() async {
    final uid = _db.auth.currentUser!.id;
    final now = DateTime.now().toUtc().toIso8601String();

    // Create shift record
    final res = await _db.from('driver_shifts').insert({
      'driver_id': uid,
      'status': 'active',
      'status_log': [{'status': 'free', 'ts': now}],
    }).select('id').single();

    // Update profile cache
    await _db.from('profiles').update({
      'shift_status': 'on_shift',
      'driver_status': 'free',
    }).eq('id', uid);

    return res['id'] as String;
  }

  // ── End current shift ──────────────────────────────────────────
  static Future<void> endShift(String shiftId) async {
    final uid = _db.auth.currentUser!.id;
    final now = DateTime.now().toUtc().toIso8601String();

    // Fetch current log and append final entry
    final shift = await _db.from('driver_shifts')
        .select('status_log').eq('id', shiftId).single();
    final log = List<Map<String, dynamic>>.from(shift['status_log'] as List);
    log.add({'status': 'off_shift', 'ts': now});

    await _db.from('driver_shifts').update({
      'status': 'ended',
      'ended_at': now,
      'status_log': log,
    }).eq('id', shiftId);

    await _db.from('profiles').update({
      'shift_status': 'off_shift',
      'driver_status': null,
    }).eq('id', uid);
  }

  // ── Update driver_status during shift ─────────────────────────
  static Future<void> setDriverStatus(
    String shiftId,
    String status, // 'free' | 'delivering'
  ) async {
    final uid  = _db.auth.currentUser!.id;
    final now  = DateTime.now().toUtc().toIso8601String();

    // Append to log
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
