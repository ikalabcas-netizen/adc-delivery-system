import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme.dart';

class TripDetailScreen extends StatefulWidget {
  final String tripId;
  const TripDetailScreen({super.key, required this.tripId});

  @override
  State<TripDetailScreen> createState() => _TripDetailScreenState();
}

class _TripDetailScreenState extends State<TripDetailScreen> {
  final _supabase = Supabase.instance.client;
  Map<String, dynamic>? _trip;
  List<Map<String, dynamic>> _orders = [];
  List<LatLng> _waypoints = [];
  bool _loading = true;
  bool _updating = false;

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  Future<void> _fetch() async {
    setState(() => _loading = true);
    try {
      final trip = await _supabase
          .from('trips')
          .select('*')
          .eq('id', widget.tripId)
          .single();

      final orders = await _supabase
          .from('orders')
          .select('''
            id, code, status, note,
            pickup_location:locations!orders_pickup_location_id_fkey(id, name, address, lat, lng),
            delivery_location:locations!orders_delivery_location_id_fkey(id, name, address, lat, lng)
          ''')
          .eq('trip_id', widget.tripId)
          .order('created_at');

      // Build waypoints from optimized_route
      final route = trip['optimized_route'] as Map<String, dynamic>?;
      final rawWaypoints = route?['waypoints'] as List<dynamic>? ?? [];
      final latlngs = rawWaypoints
          .where((w) => w['lat'] != null && w['lng'] != null)
          .map((w) => LatLng(
                (w['lat'] as num).toDouble(),
                (w['lng'] as num).toDouble(),
              ))
          .toList();

      if (mounted) {
        setState(() {
          _trip = trip;
          _orders = List<Map<String, dynamic>>.from(orders);
          _waypoints = latlngs;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Lỗi: $e')),
        );
      }
    }
  }

  Future<void> _updateStatus(String newStatus) async {
    setState(() => _updating = true);
    try {
      await _supabase
          .from('trips')
          .update({
            'status': newStatus,
            if (newStatus == 'active') 'started_at': DateTime.now().toIso8601String(),
            if (newStatus == 'completed') 'completed_at': DateTime.now().toIso8601String(),
          })
          .eq('id', widget.tripId);
      await _fetch();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Lỗi: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _updating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final status = _trip?['status'] as String? ?? 'planned';
    final centerLat = _waypoints.isNotEmpty
        ? _waypoints.map((p) => p.latitude).reduce((a, b) => a + b) / _waypoints.length
        : 10.7769;
    final centerLng = _waypoints.isNotEmpty
        ? _waypoints.map((p) => p.longitude).reduce((a, b) => a + b) / _waypoints.length
        : 106.7009;

    return Scaffold(
      appBar: AppBar(
        title: Text('Chuyến đi — ${_orders.length} điểm'),
        leading: BackButton(onPressed: () => Navigator.of(context).pop()),
      ),
      body: Column(
        children: [
          // Map
          Expanded(
            flex: 3,
            child: _waypoints.isEmpty
                ? _noMapPlaceholder()
                : FlutterMap(
                    options: MapOptions(
                      initialCenter: LatLng(centerLat, centerLng),
                      initialZoom: 13,
                    ),
                    children: [
                      TileLayer(
                        urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                        userAgentPackageName: 'com.adc.delivery',
                      ),
                      PolylineLayer(
                        polylines: [
                          if (_waypoints.length > 1)
                            Polyline(
                              points: _waypoints,
                              color: const Color(0xFF0891B2),
                              strokeWidth: 4,
                            ),
                        ],
                      ),
                      MarkerLayer(
                        markers: _waypoints.asMap().entries.map((e) {
                          final idx = e.key;
                          final pt = e.value;
                          return Marker(
                            point: pt,
                            width: 32,
                            height: 32,
                            child: Container(
                              decoration: BoxDecoration(
                                color: idx == 0
                                    ? const Color(0xFF059669)   // start = green
                                    : const Color(0xFF0891B2),  // rest = cyan
                                shape: BoxShape.circle,
                                border: Border.all(color: Colors.white, width: 2),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.2),
                                    blurRadius: 4,
                                  ),
                                ],
                              ),
                              child: Center(
                                child: Text(
                                  '${idx + 1}',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                    ],
                  ),
          ),

          // Order list
          Expanded(
            flex: 2,
            child: Column(
              children: [
                // Action buttons
                if (status != 'completed')
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                    child: SizedBox(
                      width: double.infinity,
                      child: _updating
                          ? const Center(child: CircularProgressIndicator())
                          : status == 'planned'
                              ? FilledButton.icon(
                                  onPressed: () => _updateStatus('active'),
                                  icon: const Icon(Icons.play_arrow_rounded),
                                  label: const Text('Bắt đầu Chuyến'),
                                )
                              : FilledButton.icon(
                                  style: FilledButton.styleFrom(
                                    backgroundColor: const Color(0xFF059669),
                                  ),
                                  onPressed: () => _updateStatus('completed'),
                                  icon: const Icon(Icons.check_circle_rounded),
                                  label: const Text('Hoàn thành Chuyến'),
                                ),
                    ),
                  ),

                // Stop list
                Expanded(
                  child: ListView.separated(
                    padding: const EdgeInsets.all(12),
                    itemCount: _orders.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (_, i) {
                      final o = _orders[i];
                      final delivery = o['delivery_location'] as Map<String, dynamic>?;
                      return ListTile(
                        leading: CircleAvatar(
                          backgroundColor: const Color(0xFF0A3444),
                          radius: 16,
                          child: Text(
                            '${i + 1}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        title: Text(
                          delivery?['name'] ?? '—',
                          style: GoogleFonts.outfit(
                              fontSize: 14, fontWeight: FontWeight.w600),
                        ),
                        subtitle: Text(
                          o['code']?.toString() ?? '—',
                          style: const TextStyle(fontSize: 12),
                        ),
                        dense: true,
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _noMapPlaceholder() {
    return Container(
      color: Colors.grey[100],
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.map_outlined, size: 48, color: Colors.grey[300]),
            const SizedBox(height: 8),
            Text(
              'Các điểm giao chưa có tọa độ',
              style: TextStyle(color: Colors.grey[500]),
            ),
          ],
        ),
      ),
    );
  }
}
