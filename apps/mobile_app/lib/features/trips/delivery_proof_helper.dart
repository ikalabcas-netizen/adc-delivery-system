import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';

/// Tạo stamp trên ảnh và encode JPEG quality 50 (nhẹ, đủ để double-check).
Future<Uint8List> stampDeliveryProof(
  Uint8List sourceBytes, {
  required String orderCode,
  required String locationName,
  required DateTime capturedAt,
}) async {
  // 1. Decode source image
  final codec = await ui.instantiateImageCodec(sourceBytes);
  final frame = await codec.getNextFrame();
  final srcImage = frame.image;

  final W = srcImage.width.toDouble();
  final H = srcImage.height.toDouble();

  // Scale factor: stamp elements scale with image size
  final scale = W / 1080; // design baseline 1080px
  final stripH = 170 * scale;
  final pad    = 20 * scale;

  // Date/time string
  final ts = capturedAt;
  final timeStr =
      '${_p(ts.day)}/${_p(ts.month)}/${ts.year}  ${_p(ts.hour)}:${_p(ts.minute)}:${_p(ts.second)}';

  // 2. Paint onto recorder
  final recorder = ui.PictureRecorder();
  final canvas   = Canvas(recorder, Rect.fromLTWH(0, 0, W, H));

  // Draw original image
  canvas.drawImage(srcImage, Offset.zero, Paint());

  // Bottom dark gradient strip
  final stripRect = Rect.fromLTWH(0, H - stripH, W, stripH);
  final gradPaint = Paint()
    ..shader = ui.Gradient.linear(
      Offset(0, H - stripH),
      Offset(0, H),
      [const Color(0xCC000000), const Color(0xF0000000)],
    );
  canvas.drawRect(stripRect, gradPaint);

  // Top-right watermark "ADC Delivery"
  _drawParagraph(
    canvas,
    'ADC Delivery',
    Offset(W - 180 * scale, 16 * scale),
    fontSize: 22 * scale,
    color: const Color(0xAAFFFFFF),
    bold: false,
    maxWidth: 200 * scale,
  );

  // Order code (large white)
  _drawParagraph(
    canvas,
    '📦 $orderCode',
    Offset(pad, H - stripH + pad),
    fontSize: 36 * scale,
    color: Colors.white,
    bold: true,
    maxWidth: W - (pad * 2),
  );

  // Timestamp (amber)
  _drawParagraph(
    canvas,
    '🕐 $timeStr',
    Offset(pad, H - stripH + pad + 48 * scale),
    fontSize: 26 * scale,
    color: const Color(0xFFFFD700),
    bold: false,
    maxWidth: W - (pad * 2),
  );

  // Location (white-ish, truncate long names)
  _drawParagraph(
    canvas,
    '📍 $locationName',
    Offset(pad, H - stripH + pad + 90 * scale),
    fontSize: 24 * scale,
    color: const Color(0xCCFFFFFF),
    bold: false,
    maxWidth: W - (pad * 2),
  );

  // 3. Finalize picture → ui.Image → PNG bytes (needed as input for compressor)
  final picture    = recorder.endRecording();
  final stampedImg = await picture.toImage(srcImage.width, srcImage.height);
  final pngData    = await stampedImg.toByteData(format: ui.ImageByteFormat.png);
  final pngBytes   = pngData!.buffer.asUint8List();

  // 4. Re-compress PNG → JPEG quality 50 at max 800px (compressWithList needs encoded input)
  final jpegBytes = await FlutterImageCompress.compressWithList(
    pngBytes,
    minWidth: 800,
    minHeight: 600,
    quality: 50,
    format: CompressFormat.jpeg,
  );
  return jpegBytes ?? pngBytes; // fallback: return PNG if compress fails
}

/// Draw a paragraph onto canvas at given offset.
void _drawParagraph(
  Canvas canvas,
  String text,
  Offset offset, {
  required double fontSize,
  required Color color,
  required bool bold,
  required double maxWidth,
}) {
  final paraBuilder = ui.ParagraphBuilder(
    ui.ParagraphStyle(
      textAlign: TextAlign.left,
      fontWeight: bold ? FontWeight.bold : FontWeight.normal,
      fontSize: fontSize,
      maxLines: 1,
      ellipsis: '…',
    ),
  )
    ..pushStyle(ui.TextStyle(color: color, fontSize: fontSize, fontWeight: bold ? FontWeight.bold : FontWeight.normal))
    ..addText(text);
  final paragraph = paraBuilder.build()..layout(ui.ParagraphConstraints(width: maxWidth));
  canvas.drawParagraph(paragraph, offset);
}

String _p(int v) => v.toString().padLeft(2, '0');
