import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';

/// Main orders screen — 2 tabs: Đơn chờ nhận + Đơn của tôi
class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;
  List<Map<String, dynamic>> _available = [];
  List<Map<String, dynamic>> _myOrders = [];
  bool _loading = true;
  final _supabase = Supabase.instance.client;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
    _fetchOrders();
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetchOrders() async {
    setState(() => _loading = true);
    final userId = _supabase.auth.currentUser?.id;

    try {
      final selectQuery = '''
        *,
        pickup_location:locations!orders_pickup_location_id_fkey(id, name, address),
        delivery_location:locations!orders_delivery_location_id_fkey(id, name, address),
        assigned_driver:profiles!orders_assigned_to_fkey(id, full_name)
      ''';

      // Available orders (pending, no driver assigned)
      final availRes = await _supabase
          .from('orders')
          .select(selectQuery)
          .eq('status', 'pending')
          .order('created_at', ascending: false)
          .limit(50);

      // My orders (assigned to me)
      List<Map<String, dynamic>> myRes = [];
      if (userId != null) {
        myRes = await _supabase
            .from('orders')
            .select(selectQuery)
            .eq('assigned_to', userId)
            .order('created_at', ascending: false)
            .limit(50);
      }

      if (mounted) {
        setState(() {
          _available = List<Map<String, dynamic>>.from(availRes);
          _myOrders = List<Map<String, dynamic>>.from(myRes);
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Lỗi tải đơn: $e')),
        );
      }
    }
  }

  Future<void> _claimOrder(String orderId) async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return;

    try {
      await _supabase.from('orders').update({
        'assigned_to': userId,
        'status': 'assigned',
      }).eq('id', orderId);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('✓ Đã nhận đơn')),
        );
      }
      _fetchOrders();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Lỗi: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Đơn hàng', style: TextStyle(fontWeight: FontWeight.w700)),
        bottom: TabBar(
          controller: _tabCtrl,
          tabs: [
            Tab(text: 'Chờ nhận (${_available.length})'),
            Tab(text: 'Đơn của tôi (${_myOrders.length})'),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _fetchOrders,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabCtrl,
              children: [
                // Tab 1: Available orders
                _buildOrderList(_available, isAvailable: true),
                // Tab 2: My orders
                _buildOrderList(_myOrders, isAvailable: false),
              ],
            ),
    );
  }

  Widget _buildOrderList(List<Map<String, dynamic>> orders,
      {required bool isAvailable}) {
    if (orders.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              isAvailable ? Icons.inbox_rounded : Icons.checklist_rounded,
              size: 48,
              color: Colors.grey[300],
            ),
            const SizedBox(height: 12),
            Text(
              isAvailable ? 'Không có đơn chờ nhận' : 'Chưa có đơn nào',
              style: TextStyle(fontSize: 15, color: Colors.grey[500]),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _fetchOrders,
      child: ListView.builder(
        padding: const EdgeInsets.symmetric(vertical: 8),
        itemCount: orders.length,
        itemBuilder: (_, i) => _OrderCard(
          order: orders[i],
          isAvailable: isAvailable,
          onClaim: isAvailable ? () => _claimOrder(orders[i]['id']) : null,
          onTap: () => context.go('/orders/${orders[i]['id']}'),
        ),
      ),
    );
  }
}

// ─── Order Card Widget ────────────────────────────────────
class _OrderCard extends StatelessWidget {
  final Map<String, dynamic> order;
  final bool isAvailable;
  final VoidCallback? onClaim;
  final VoidCallback onTap;

  const _OrderCard({
    required this.order,
    required this.isAvailable,
    this.onClaim,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final status = order['status'] as String? ?? 'pending';
    final statusColor = AppTheme.statusColors[status] ?? Colors.grey;
    final statusLabel = AppTheme.statusLabels[status] ?? status;

    final pickup = order['pickup_location'] as Map<String, dynamic>?;
    final delivery = order['delivery_location'] as Map<String, dynamic>?;

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header: code + status
              Row(
                children: [
                  Text(
                    order['code']?.toString() ?? '—',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      fontFamily: 'monospace',
                    ),
                  ),
                  const SizedBox(width: 10),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      statusLabel,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: statusColor,
                      ),
                    ),
                  ),
                  const Spacer(),
                  Text(
                    _formatTime(order['created_at']),
                    style: TextStyle(fontSize: 11, color: Colors.grey[400]),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Route: pickup → delivery
              _routeRow(Icons.circle, const Color(0xFF06B6D4),
                  pickup?['name'] ?? '—'),
              Container(
                width: 1.5,
                height: 14,
                margin: const EdgeInsets.only(left: 5),
                color: Colors.grey[200],
              ),
              _routeRow(Icons.circle, const Color(0xFFD97706),
                  delivery?['name'] ?? '—'),

              // Note
              if (order['note'] != null && order['note'].toString().isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Text(
                    '📝 ${order['note']}',
                    style: TextStyle(
                      fontSize: 12,
                      fontStyle: FontStyle.italic,
                      color: Colors.grey[500],
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),

              // Claim button (available tab only)
              if (isAvailable && onClaim != null) ...[
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: onClaim,
                    icon: const Icon(Icons.add_task_rounded, size: 18),
                    label: const Text('Nhận đơn này'),
                  ),
                ),
              ],

              // Status action buttons (my orders tab)
              if (!isAvailable) ...[
                const SizedBox(height: 12),
                _StatusActions(status: status),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _routeRow(IconData icon, Color color, String text) {
    return Row(
      children: [
        Icon(icon, size: 10, color: color),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(fontSize: 13),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }

  String _formatTime(dynamic ts) {
    if (ts == null) return '';
    try {
      final dt = DateTime.parse(ts.toString()).toLocal();
      return '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return '';
    }
  }
}

// Status hint chips
class _StatusActions extends StatelessWidget {
  final String status;
  const _StatusActions({required this.status});

  @override
  Widget build(BuildContext context) {
    final label = switch (status) {
      'assigned' => '👆 Nhấn để xem chi tiết & bắt đầu giao',
      'in_transit' => '🚚 Đang giao — nhấn để xác nhận',
      'delivered' => '✅ Đã giao thành công',
      _ => '',
    };
    if (label.isEmpty) return const SizedBox.shrink();

    return Text(
      label,
      style: TextStyle(fontSize: 12, color: Colors.grey[500]),
    );
  }
}
