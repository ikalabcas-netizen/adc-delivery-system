import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:go_router/go_router.dart';

/// Profile screen — driver info + sign out
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _supabase = Supabase.instance.client;
  Map<String, dynamic>? _profile;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _fetchProfile();
  }

  Future<void> _fetchProfile() async {
    setState(() => _loading = true);
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return;

    try {
      final res = await _supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
      if (mounted) setState(() { _profile = res; _loading = false; });
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final user = _supabase.auth.currentUser;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Hồ sơ', style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Avatar + Name
                Center(
                  child: Column(
                    children: [
                      CircleAvatar(
                        radius: 44,
                        backgroundColor: cs.primaryContainer,
                        backgroundImage: _profile?['avatar_url'] != null
                            ? NetworkImage(_profile!['avatar_url'])
                            : null,
                        child: _profile?['avatar_url'] == null
                            ? Icon(Icons.person_rounded, size: 40, color: cs.primary)
                            : null,
                      ),
                      const SizedBox(height: 14),
                      Text(
                        _profile?['full_name'] ?? user?.email ?? '—',
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 4),
                        decoration: BoxDecoration(
                          color: cs.primary.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          _roleLabel(_profile?['role'] ?? ''),
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: cs.primary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 28),

                // Info cards
                _infoTile(Icons.email_rounded, 'Email', user?.email ?? '—'),
                _infoTile(Icons.phone_rounded, 'SĐT',
                    _profile?['phone'] ?? 'Chưa cập nhật'),
                _infoTile(Icons.two_wheeler_rounded, 'Biển số xe',
                    _profile?['vehicle_plate'] ?? 'Chưa cập nhật'),
                _infoTile(Icons.home_rounded, 'Địa chỉ',
                    _profile?['home_address'] ?? 'Chưa cập nhật'),

                const SizedBox(height: 32),

                // Sign out
                FilledButton.icon(
                  onPressed: () async {
                    await _supabase.auth.signOut();
                    if (context.mounted) context.go('/login');
                  },
                  icon: const Icon(Icons.logout_rounded),
                  label: const Text('Đăng xuất'),
                  style: FilledButton.styleFrom(
                    backgroundColor: Colors.red[400],
                    foregroundColor: Colors.white,
                    minimumSize: const Size.fromHeight(50),
                  ),
                ),

                const SizedBox(height: 20),
                Center(
                  child: Text(
                    'ADC Delivery v1.0.0',
                    style: TextStyle(fontSize: 12, color: Colors.grey[400]),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _infoTile(IconData icon, String label, String value) {
    return ListTile(
      leading: Icon(icon, color: Theme.of(context).colorScheme.primary),
      title: Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
      subtitle: Text(value, style: const TextStyle(fontSize: 15)),
      contentPadding: EdgeInsets.zero,
    );
  }

  String _roleLabel(String role) => switch (role) {
        'delivery' => '🚚 Giao nhận',
        'coordinator' => '📋 Điều phối',
        'sales' => '💼 Kinh doanh',
        'super_admin' => '👑 Quản trị',
        _ => role,
      };
}
