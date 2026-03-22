import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../core/image_cache_manager.dart';
import '../shell/app_shell.dart';

class IssuesScreen extends StatefulWidget {
  const IssuesScreen({super.key});

  @override
  State<IssuesScreen> createState() => _IssuesScreenState();
}

class _IssuesScreenState extends State<IssuesScreen> with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;

  final _formKey    = GlobalKey<FormState>();
  final _descCtrl   = TextEditingController();
  final _orderIdCtrl = TextEditingController();
  String _category  = 'wrong_address';
  File?  _photo;
  bool   _submitting = false;
  bool   _submitted  = false;

  List<dynamic> _issuesList = [];
  bool _loadingHistory = false;

  static const _categories = [
    ('wrong_address', 'Sai địa chỉ', Icons.location_off_outlined),
    ('closed',        'Đóng cửa',    Icons.door_sliding_outlined),
    ('wrong_phone',   'Sai số ĐT',   Icons.phone_disabled_outlined),
    ('other',         'Lý do khác',  Icons.warning_amber_rounded),
  ];

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
    _tabCtrl.addListener(() {
      if (_tabCtrl.index == 1 && !_tabCtrl.indexIsChanging) {
        _fetchHistory();
      }
    });
  }

  @override
  void dispose() {
    _descCtrl.dispose();
    _orderIdCtrl.dispose();
    _tabCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetchHistory() async {
    setState(() => _loadingHistory = true);
    final uid = Supabase.instance.client.auth.currentUser?.id;
    if (uid == null) return;
    
    try {
      final res = await Supabase.instance.client
          .from('delivery_issues')
          .select()
          .eq('driver_id', uid)
          .order('created_at', ascending: false);
      setState(() => _issuesList = res);
    } catch (e) {
      debugPrint('Error fetching history: $e');
    } finally {
      setState(() => _loadingHistory = false);
    }
  }

  Future<void> _pickPhoto({bool fromGallery = false}) async {
    final picked = await ImagePicker().pickImage(
      source: fromGallery ? ImageSource.gallery : ImageSource.camera,
      imageQuality: 55,
      maxWidth: 640,
    );
    if (picked != null) setState(() => _photo = File(picked.path));
  }

  void _showPhotoOptions() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(width: 40, height: 4, decoration: BoxDecoration(color: const Color(0xFFCBD5E1), borderRadius: BorderRadius.circular(2))),
              const SizedBox(height: 16),
              ListTile(
                leading: const Icon(Icons.camera_alt_rounded, color: Color(0xFF0891B2)),
                title: Text('Chụp ảnh', style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
                onTap: () { Navigator.pop(context); _pickPhoto(); },
              ),
              ListTile(
                leading: const Icon(Icons.photo_library_rounded, color: Color(0xFF0891B2)),
                title: Text('Chọn từ thư viện', style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
                onTap: () { Navigator.pop(context); _pickPhoto(fromGallery: true); },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _submitting = true);

    try {
      final uid = Supabase.instance.client.auth.currentUser?.id;
      String? photoUrl;

      if (_photo != null && uid != null) {
        final stamp = DateTime.now().millisecondsSinceEpoch;
        final path  = '$uid/issue_$stamp.jpg';
        final bytes = await _photo!.readAsBytes();
        await Supabase.instance.client.storage
            .from('feedback-photos')
            .uploadBinary(path, bytes,
                fileOptions: const FileOptions(upsert: true, contentType: 'image/jpeg'));
        photoUrl = Supabase.instance.client.storage
            .from('feedback-photos')
            .getPublicUrl(path);
      }

      await Supabase.instance.client.from('delivery_issues').insert({
        'driver_id':   uid,
        'order_id':    _orderIdCtrl.text.trim().isEmpty ? null : _orderIdCtrl.text.trim(),
        'description': _descCtrl.text.trim(),
        'issue_category': _category,
        'photo_url':   photoUrl,
        'status':      'pending',
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
      backgroundColor: const Color(0xFFF1F5F9), // Slate 100
      appBar: AppBar(
        title: Text('Báo sự cố', style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
        backgroundColor: const Color(0xFF0891B2), // Cyan — nhất quán với CostsScreen
        foregroundColor: Colors.white,
        elevation: 0,
        actions: const [HamburgerMenu()],
        bottom: TabBar(
          controller: _tabCtrl,
          indicatorColor: const Color(0xFF10B981),
          indicatorWeight: 3,
          labelColor: Colors.white,
          unselectedLabelColor: const Color(0xFF94A3B8),
          labelStyle: GoogleFonts.outfit(fontWeight: FontWeight.w700, fontSize: 15),
          tabs: const [
            Tab(text: 'TẠO BÁO CÁO'),
            Tab(text: 'LỊCH SỬ XỬ LÝ'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabCtrl,
        children: [
          _submitted ? _buildSuccess() : _buildForm(),
          _buildHistory(),
        ],
      ),
    );
  }

  // --- FORM TAB ---

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
            Text('Gửi thành công!', style: GoogleFonts.outfit(fontSize: 22, fontWeight: FontWeight.w800, color: const Color(0xFF0F172A))),
            const SizedBox(height: 8),
            const Text(
              'Sự cố đã được báo về hệ thống.\nĐiều phối viên sẽ xem xét và phản hồi sớm nhất.',
              style: TextStyle(fontSize: 14, color: Color(0xFF64748B), height: 1.5),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () {
                  setState(() { _submitted = false; _descCtrl.clear(); _orderIdCtrl.clear(); _photo = null; });
                },
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF0F172A),
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                child: Text('Tạo báo cáo khác', style: GoogleFonts.outfit(fontWeight: FontWeight.w700, fontSize: 15)),
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
            Text('Loại sự cố *', style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w700, color: const Color(0xFF64748B))),
            const SizedBox(height: 10),
            ..._categories.map((cat) {
              final (code, label, icon) = cat;
              final selected = _category == code;
              return GestureDetector(
                onTap: () => setState(() => _category = code),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(
                    color: selected ? const Color(0xFFECFEFF) : Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: selected ? const Color(0xFF0891B2) : const Color(0xFFE2E8F0), width: selected ? 1.5 : 1),
                  ),
                  child: Row(
                    children: [
                      Icon(icon, size: 20, color: selected ? const Color(0xFF0891B2) : const Color(0xFF94A3B8)),
                      const SizedBox(width: 12),
                      Text(label, style: GoogleFonts.outfit(
                        fontSize: 15, fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                        color: selected ? const Color(0xFF0891B2) : const Color(0xFF334155),
                      )),
                    ],
                  ),
                ),
              );
            }),
            const SizedBox(height: 20),

            Text('Mã đơn hàng (Không bắt buộc)', style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w700, color: const Color(0xFF64748B))),
            const SizedBox(height: 8),
            TextFormField(
              controller: _orderIdCtrl,
              decoration: InputDecoration(
                hintText: 'VD: DH1234...',
                hintStyle: const TextStyle(color: Color(0xFFCBD5E1), fontSize: 14),
                filled: true, fillColor: Colors.white,
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFF0891B2), width: 2)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
              ),
            ),
            const SizedBox(height: 20),

            Text('Mô tả chi tiết *', style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w700, color: const Color(0xFF64748B))),
            const SizedBox(height: 8),
            TextFormField(
              controller: _descCtrl,
              maxLines: 4,
              minLines: 3,
              maxLength: 1000,
              decoration: InputDecoration(
                hintText: 'Ghi rõ tình trạng thực tế...',
                hintStyle: const TextStyle(color: Color(0xFFCBD5E1), fontSize: 14),
                filled: true, fillColor: Colors.white,
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFF0891B2), width: 2)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
              ),
              validator: (val) {
                if (val == null || val.trim().isEmpty) return 'Vui lòng nhập mô tả';
                if (val.trim().length < 5) return 'Mô tả quá ngắn';
                return null;
              },
            ),
            const SizedBox(height: 16),

            Text('Ảnh minh chứng (Cửa đóng, bảng tên...)', style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w700, color: const Color(0xFF64748B))),
            const SizedBox(height: 8),
            GestureDetector(
              onTap: _showPhotoOptions,
              child: Container(
                height: _photo == null ? 80 : 160,
                decoration: BoxDecoration(
                  color: _photo == null ? const Color(0xFFF8FAFC) : null,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                  image: _photo != null ? DecorationImage(image: FileImage(_photo!), fit: BoxFit.cover) : null,
                ),
                child: _photo == null
                    ? Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                        const Icon(Icons.add_a_photo_outlined, size: 20, color: Color(0xFF94A3B8)),
                        const SizedBox(width: 8),
                        Text('Chụp ảnh đính kèm (< 5MB)', style: TextStyle(color: const Color(0xFF94A3B8), fontSize: 13, fontWeight: FontWeight.w500)),
                      ])
                    : Align(
                        alignment: Alignment.topRight,
                        child: GestureDetector(
                          onTap: () => setState(() => _photo = null),
                          child: Container(margin: const EdgeInsets.all(8), padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(color: Colors.black54, shape: BoxShape.circle),
                            child: const Icon(Icons.close, color: Colors.white, size: 18)),
                        ),
                      ),
              ),
            ),
            const SizedBox(height: 32),

            FilledButton(
              onPressed: _submitting ? null : _submit,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF0F172A),
                padding: const EdgeInsets.symmetric(vertical: 18),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
              child: _submitting
                  ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Text('Gửi Báo Cáo Sự Cố', style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w800)),
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  // --- HISTORY TAB ---

  Widget _buildHistory() {
    if (_loadingHistory) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF0F172A)));
    }
    if (_issuesList.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.help_outline_rounded, size: 64, color: Color(0xFFCBD5E1)),
            const SizedBox(height: 16),
            Text('Bạn chưa có báo cáo nào.', style: GoogleFonts.outfit(color: const Color(0xFF64748B), fontSize: 15)),
          ],
        ),
      );
    }
    
    return RefreshIndicator(
      onRefresh: _fetchHistory,
      color: const Color(0xFF0F172A),
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _issuesList.length,
        separatorBuilder: (_, __) => const SizedBox(height: 16),
        itemBuilder: (context, i) {
          final issue = _issuesList[i];
          return _buildIssueCard(issue);
        },
      ),
    );
  }

  Widget _buildIssueCard(Map<String, dynamic> issue) {
    final catCode = issue['issue_category'];
    final catLabel = _categories.firstWhere((c) => c.$1 == catCode, orElse: () => _categories.last).$2;
    final status = issue['status'] as String;
    final date = DateTime.parse(issue['created_at']).toLocal();
    final timeStr = '${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')} - ${date.day}/${date.month}';

    Color statusColor;
    Color statusBg;
    String statusText;
    switch (status) {
      case 'pending': statusColor = const Color(0xFFB45309); statusBg = const Color(0xFFFEF3C7); statusText = 'Chờ xử lý'; break;
      case 'investigating': statusColor = const Color(0xFF4338CA); statusBg = const Color(0xFFE0E7FF); statusText = 'Đang kiểm tra'; break;
      case 'resolved': statusColor = const Color(0xFF059669); statusBg = const Color(0xFFDCFCE7); statusText = 'Đã xử lý'; break;
      case 'cancelled': statusColor = const Color(0xFFB91C1C); statusBg = const Color(0xFFFEE2E2); statusText = 'Hủy'; break;
      default: statusColor = const Color(0xFF64748B); statusBg = const Color(0xFFF1F5F9); statusText = status; break;
    }

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [BoxShadow(color: Color(0x0A000000), blurRadius: 4, offset: Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(catLabel, style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w800, color: const Color(0xFF0F172A))),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          const Icon(Icons.schedule, size: 12, color: Color(0xFF94A3B8)),
                          const SizedBox(width: 4),
                          Text(timeStr, style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                        ],
                      )
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: statusBg, borderRadius: BorderRadius.circular(8)),
                  child: Text(statusText, style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w700, color: statusColor)),
                )
              ],
            ),
          ),
          
          const Divider(height: 1, color: Color(0xFFF1F5F9)),
          
          // Body
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (issue['order_id'] != null) ...[
                  Text('Mã đơn: ${issue['order_id']}', style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w700, color: const Color(0xFF0891B2))),
                  const SizedBox(height: 8),
                ],
                Text(issue['description'] ?? '', style: const TextStyle(fontSize: 14, color: Color(0xFF334155), height: 1.4)),
                
                if (issue['photo_url'] != null) ...[
                   const SizedBox(height: 12),
                   ClipRRect(
                     borderRadius: BorderRadius.circular(10),
                     child: CachedNetworkImage(
                       imageUrl: issue['photo_url'],
                       cacheManager: AppImageCacheManager.instance,
                       width: double.infinity,
                       height: 140,
                       fit: BoxFit.cover,
                       placeholder: (_, __) => Container(height: 140, color: const Color(0xFFF1F5F9), child: const Center(child: CircularProgressIndicator(strokeWidth: 2))),
                       errorWidget: (_, __, ___) => Container(height: 60, color: const Color(0xFFF1F5F9), child: const Center(child: Icon(Icons.broken_image_outlined, color: Color(0xFFCBD5E1)))),
                     ),
                   ),
                 ]
              ],
            ),
          ),

          // Dispatcher Note
          if (issue['dispatcher_note'] != null && issue['dispatcher_note'].toString().trim().isNotEmpty)
            Container(
              margin: const EdgeInsets.only(left: 16, right: 16, bottom: 16),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(10),
                border: const Border(left: BorderSide(color: Color(0xFF0891B2), width: 4)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('PHẢN HỒI TỪ ĐIỀU PHỐI', style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w800, color: const Color(0xFF0891B2))),
                  const SizedBox(height: 4),
                  Text(issue['dispatcher_note'], style: const TextStyle(fontSize: 13, color: Color(0xFF334155), height: 1.4)),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
