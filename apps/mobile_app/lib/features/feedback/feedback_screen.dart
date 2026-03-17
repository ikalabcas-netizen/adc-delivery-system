import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:google_fonts/google_fonts.dart';

/// FeedbackScreen — Góp ý từ mobile giao nhận
/// Category options match the DB constraint on feedbacks.category
class FeedbackScreen extends StatefulWidget {
  const FeedbackScreen({super.key});

  @override
  State<FeedbackScreen> createState() => _FeedbackScreenState();
}

class _FeedbackScreenState extends State<FeedbackScreen> {
  final _formKey    = GlobalKey<FormState>();
  final _contentCtrl = TextEditingController();
  String _category  = 'general';
  File?  _photo;
  bool   _submitting = false;
  bool   _submitted  = false;

  static const _categories = [
    ('general',    'Chung',        Icons.chat_bubble_outline_rounded),
    ('delivery',   'Giao hàng',    Icons.local_shipping_outlined),
    ('system',     'Hệ thống',     Icons.settings_outlined),
    ('suggestion', 'Đề xuất',      Icons.lightbulb_outline_rounded),
    ('bug',        'Báo lỗi',      Icons.bug_report_outlined),
  ];

  @override
  void dispose() {
    _contentCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickPhoto() async {
    final picked = await ImagePicker().pickImage(
      source: ImageSource.camera,
      imageQuality: 55,
      maxWidth: 640,
    );
    if (picked != null) setState(() => _photo = File(picked.path));
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _submitting = true);

    try {
      final uid = Supabase.instance.client.auth.currentUser?.id;
      String? photoUrl;

      // Upload photo if provided
      if (_photo != null && uid != null) {
        final stamp = DateTime.now().millisecondsSinceEpoch;
        final path  = '$uid/feedback_$stamp.jpg';
        final bytes = await _photo!.readAsBytes();
        await Supabase.instance.client.storage
            .from('feedback-photos')
            .uploadBinary(path, bytes,
                fileOptions: const FileOptions(upsert: true, contentType: 'image/jpeg'));
        photoUrl = Supabase.instance.client.storage
            .from('feedback-photos')
            .getPublicUrl(path);
      }

      await Supabase.instance.client.from('feedbacks').insert({
        'user_id':   uid,
        'content':   _contentCtrl.text.trim(),
        'category':  _category,
        'photo_url': photoUrl,
        'source':    'mobile',
      });

      if (mounted) setState(() { _submitted = true; _submitting = false; });
    } catch (e) {
      if (mounted) {
        setState(() => _submitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Lỗi: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFEFF6FF),
      appBar: AppBar(
        title: Text('Góp ý', style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
        backgroundColor: const Color(0xFF0891B2),
        foregroundColor: Colors.white,
      ),
      body: _submitted ? _buildSuccess() : _buildForm(),
    );
  }

  Widget _buildSuccess() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72, height: 72,
              decoration: BoxDecoration(color: const Color(0xFFDCFCE7), borderRadius: BorderRadius.circular(20)),
              child: const Icon(Icons.check_circle_rounded, size: 40, color: Color(0xFF059669)),
            ),
            const SizedBox(height: 20),
            Text('Cảm ơn bạn!', style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.w700, color: const Color(0xFF0F172A))),
            const SizedBox(height: 8),
            const Text(
              'Góp ý của bạn đã được gửi đến quản lý.\nChúng tôi sẽ xem xét và cải thiện hệ thống.',
              style: TextStyle(fontSize: 13, color: Color(0xFF64748B), height: 1.5),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () => Navigator.of(context).pop(),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  side: const BorderSide(color: Color(0xFF0891B2)),
                ),
                child: Text('Quay lại', style: GoogleFonts.outfit(color: const Color(0xFF0891B2), fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildForm() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Category selector ─────────────────────────────
            Text('Danh mục', style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w700, color: const Color(0xFF94A3B8))),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8, runSpacing: 8,
              children: _categories.map((cat) {
                final (code, label, icon) = cat;
                final selected = _category == code;
                return GestureDetector(
                  onTap: () => setState(() => _category = code),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: selected ? const Color(0xFF0891B2) : Colors.white,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: selected ? const Color(0xFF0891B2) : const Color(0xFFE2E8F0)),
                    ),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      Icon(icon, size: 14, color: selected ? Colors.white : const Color(0xFF64748B)),
                      const SizedBox(width: 6),
                      Text(label, style: TextStyle(
                        fontSize: 12, fontWeight: FontWeight.w600,
                        color: selected ? Colors.white : const Color(0xFF64748B),
                      )),
                    ]),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 20),

            // ── Content textarea ──────────────────────────────
            Text('Nội dung góp ý', style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w700, color: const Color(0xFF94A3B8))),
            const SizedBox(height: 8),
            TextFormField(
              controller: _contentCtrl,
              maxLines: 5,
              minLines: 4,
              maxLength: 1000,
              decoration: InputDecoration(
                hintText: 'Nhập nội dung góp ý của bạn tại đây...',
                hintStyle: const TextStyle(color: Color(0xFFCBD5E1), fontSize: 13),
                filled: true,
                fillColor: Colors.white,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFF0891B2), width: 2)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
              ),
              validator: (val) {
                if (val == null || val.trim().isEmpty) return 'Vui lòng nhập nội dung góp ý';
                if (val.trim().length < 10) return 'Nội dung phải có ít nhất 10 ký tự';
                return null;
              },
            ),
            const SizedBox(height: 16),

            // ── Optional photo ────────────────────────────────
            Text('Ảnh đính kèm (không bắt buộc)', style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w700, color: const Color(0xFF94A3B8))),
            const SizedBox(height: 8),
            GestureDetector(
              onTap: _pickPhoto,
              child: Container(
                height: _photo == null ? 80 : 160,
                decoration: BoxDecoration(
                  color: _photo == null ? const Color(0xFFF8FAFC) : null,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                  image: _photo != null ? DecorationImage(image: FileImage(_photo!), fit: BoxFit.cover) : null,
                ),
                child: _photo == null
                    ? Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                        const Icon(Icons.add_a_photo_outlined, size: 20, color: Color(0xFF94A3B8)),
                        const SizedBox(width: 8),
                        Text('Chụp ảnh đính kèm', style: TextStyle(color: const Color(0xFF94A3B8), fontSize: 13)),
                      ])
                    : Align(
                        alignment: Alignment.topRight,
                        child: GestureDetector(
                          onTap: () => setState(() => _photo = null),
                          child: Container(margin: const EdgeInsets.all(8), padding: const EdgeInsets.all(4),
                            decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(6)),
                            child: const Icon(Icons.close, color: Colors.white, size: 16)),
                        ),
                      ),
              ),
            ),
            const SizedBox(height: 28),

            // ── Submit ────────────────────────────────────────
            FilledButton(
              onPressed: _submitting ? null : _submit,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF0891B2),
                padding: const EdgeInsets.symmetric(vertical: 15),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: _submitting
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Text('Gửi góp ý  →', style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w700)),
            ),
          ],
        ),
      ),
    );
  }
}
