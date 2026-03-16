import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_fonts/google_fonts.dart';

/// Result returned from [OdometerCaptureScreen].
class OdometerResult {
  final File photo;
  final int kmValue;
  final double? lat;
  final double? lng;

  OdometerResult({required this.photo, required this.kmValue, this.lat, this.lng});
}

/// Screen for capturing odometer reading:
/// 1. Camera-only photo (no gallery)
/// 2. Km value input (validated positive integer)
/// 3. Returns OdometerResult or null if cancelled
class OdometerCaptureScreen extends StatefulWidget {
  final bool isCheckIn; // true = vào ca, false = ra ca
  final int? previousKm; // km_in when checking out, for validation hint

  const OdometerCaptureScreen({
    super.key,
    required this.isCheckIn,
    this.previousKm,
  });

  @override
  State<OdometerCaptureScreen> createState() => _OdometerCaptureScreenState();
}

class _OdometerCaptureScreenState extends State<OdometerCaptureScreen> {
  File? _photo;
  final _kmCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _locating = false;
  bool _uploading = false;
  double? _lat;
  double? _lng;

  @override
  void dispose() {
    _kmCtrl.dispose();
    super.dispose();
  }

  Future<void> _takePhoto() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(
      source: ImageSource.camera,
      imageQuality: 75,
      maxWidth: 1280,
    );
    if (picked == null) return;
    setState(() => _photo = File(picked.path));
    // Get location right after photo
    await _getLocation();
  }

  Future<void> _getLocation() async {
    setState(() => _locating = true);
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) { setState(() => _locating = false); return; }

      LocationPermission perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.deniedForever) { setState(() => _locating = false); return; }

      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
      setState(() { _lat = pos.latitude; _lng = pos.longitude; });
    } catch (_) {
      // GPS optional — continue without it
    } finally {
      setState(() => _locating = false);
    }
  }

  void _confirm() {
    if (!_formKey.currentState!.validate()) return;
    if (_photo == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng chụp ảnh đồng hồ km')),
      );
      return;
    }
    final km = int.tryParse(_kmCtrl.text.trim());
    if (km == null) return;

    Navigator.of(context).pop(OdometerResult(
      photo: _photo!,
      kmValue: km,
      lat: _lat,
      lng: _lng,
    ));
  }

  @override
  Widget build(BuildContext context) {
    final title = widget.isCheckIn ? 'Vào Ca — Đồng hồ km' : 'Ra Ca — Đồng hồ km';
    final hint  = widget.isCheckIn
        ? 'Chỉ số km hiện tại'
        : 'Chỉ số km khi kết thúc ca';
    final prevHint = widget.previousKm != null
        ? ' (vào ca: ${widget.previousKm} km)'
        : '';

    return Scaffold(
      backgroundColor: const Color(0xFFEFF6FF),
      appBar: AppBar(
        title: Text(title, style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
        backgroundColor: const Color(0xFF0891B2),
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── Instructions ─────────────────────────────────
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFECFEFF),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFF67E8F9)),
                ),
                child: Row(children: [
                  const Icon(Icons.info_outline_rounded, color: Color(0xFF0891B2), size: 20),
                  const SizedBox(width: 10),
                  Expanded(child: Text(
                    widget.isCheckIn
                        ? 'Chụp ảnh đồng hồ tốc độ (odometer) xe máy và nhập chỉ số km hiện tại.'
                        : 'Chụp ảnh đồng hồ ra ca và nhập chỉ số km. Phải lớn hơn km vào ca$prevHint.',
                    style: const TextStyle(fontSize: 12, color: Color(0xFF0E7490)),
                  )),
                ]),
              ),
              const SizedBox(height: 20),

              // ── Photo capture ─────────────────────────────────
              GestureDetector(
                onTap: _takePhoto,
                child: Container(
                  height: 220,
                  decoration: BoxDecoration(
                    color: _photo == null ? const Color(0xFFF1F5F9) : null,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: _photo == null ? const Color(0xFFCBD5E1) : const Color(0xFF0891B2),
                      width: _photo == null ? 1.5 : 2,
                    ),
                    image: _photo != null ? DecorationImage(
                      image: FileImage(_photo!),
                      fit: BoxFit.cover,
                    ) : null,
                  ),
                  child: _photo == null
                      ? Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                          const Icon(Icons.camera_alt_rounded, size: 52, color: Color(0xFF94A3B8)),
                          const SizedBox(height: 10),
                          Text('Bấm để chụp ảnh đồng hồ km',
                              style: GoogleFonts.outfit(color: const Color(0xFF94A3B8), fontSize: 14)),
                          const SizedBox(height: 4),
                          Text('Chỉ dùng camera, không chọn từ thư viện',
                              style: const TextStyle(color: Color(0xFFCBD5E1), fontSize: 11)),
                        ])
                      : Stack(children: [
                          Positioned.fill(child: ClipRRect(
                            borderRadius: BorderRadius.circular(14),
                            child: Image.file(_photo!, fit: BoxFit.cover),
                          )),
                          // GPS stamp overlay
                          Positioned(
                            bottom: 8, left: 8, right: 8,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: Colors.black54,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: _locating
                                  ? const Row(mainAxisSize: MainAxisSize.min, children: [
                                      SizedBox(width: 10, height: 10, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)),
                                      SizedBox(width: 6),
                                      Text('Đang lấy vị trí...', style: TextStyle(color: Colors.white70, fontSize: 10)),
                                    ])
                                  : Text(
                                      _lat != null
                                          ? '📍 ${_lat!.toStringAsFixed(5)}, ${_lng!.toStringAsFixed(5)}  •  ${DateTime.now().toLocal().toString().substring(0, 16)}'
                                          : '📍 GPS không khả dụng  •  ${DateTime.now().toLocal().toString().substring(0, 16)}',
                                      style: const TextStyle(color: Colors.white, fontSize: 9),
                                    ),
                            ),
                          ),
                          // Re-take button
                          Positioned(
                            top: 8, right: 8,
                            child: GestureDetector(
                              onTap: _takePhoto,
                              child: Container(
                                padding: const EdgeInsets.all(6),
                                decoration: BoxDecoration(
                                  color: Colors.black54, borderRadius: BorderRadius.circular(8),
                                ),
                                child: const Icon(Icons.camera_alt_rounded, color: Colors.white, size: 18),
                              ),
                            ),
                          ),
                        ]),
                ),
              ),
              const SizedBox(height: 20),

              // ── Km input ──────────────────────────────────────
              TextFormField(
                controller: _kmCtrl,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.w700, color: const Color(0xFF0F172A)),
                decoration: InputDecoration(
                  labelText: hint,
                  labelStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 14),
                  suffixText: 'km',
                  suffixStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 15),
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: Color(0xFF0891B2), width: 2),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                  ),
                ),
                validator: (val) {
                  if (val == null || val.isEmpty) return 'Vui lòng nhập chỉ số km';
                  final km = int.tryParse(val);
                  if (km == null || km <= 0) return 'Chỉ số km phải là số dương';
                  if (!widget.isCheckIn && widget.previousKm != null && km <= widget.previousKm!) {
                    return 'Km ra ca phải > km vào ca (${widget.previousKm} km)';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 28),

              // ── Confirm button ────────────────────────────────
              FilledButton.icon(
                onPressed: _uploading ? null : _confirm,
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF0891B2),
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                icon: _uploading
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.check_circle_rounded, size: 20),
                label: Text(
                  widget.isCheckIn ? 'Xác nhận & Bắt đầu ca' : 'Xác nhận & Kết thúc ca',
                  style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
