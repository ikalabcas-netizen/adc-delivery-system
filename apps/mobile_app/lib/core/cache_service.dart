import 'dart:async';

/// Central in-memory cache with TTL support.
/// Use [getOrFetch] to read cached data or fetch fresh data from source.
class CacheService {
  static final instance = CacheService._();
  CacheService._();

  final _cache = <String, _CacheEntry>{};

  /// Get cached data if still fresh, otherwise call [fetcher] and cache result.
  Future<T> getOrFetch<T>(
    String key,
    Future<T> Function() fetcher, {
    Duration ttl = const Duration(minutes: 2),
  }) async {
    final entry = _cache[key];
    if (entry != null && !entry.isExpired) return entry.data as T;

    final data = await fetcher();
    _cache[key] = _CacheEntry(data: data, expiry: DateTime.now().add(ttl));
    return data;
  }

  /// Read cached value without fetching. Returns null if not cached or expired.
  T? peek<T>(String key) {
    final entry = _cache[key];
    if (entry == null || entry.isExpired) return null;
    return entry.data as T;
  }

  /// Store value directly into cache.
  void set<T>(String key, T data, {Duration ttl = const Duration(minutes: 2)}) {
    _cache[key] = _CacheEntry(data: data, expiry: DateTime.now().add(ttl));
  }

  /// Invalidate a specific cache key.
  void invalidate(String key) => _cache.remove(key);

  /// Invalidate all keys starting with [prefix].
  void invalidatePrefix(String prefix) {
    _cache.removeWhere((k, _) => k.startsWith(prefix));
  }

  /// Clear entire cache.
  void clear() => _cache.clear();
}

class _CacheEntry {
  final dynamic data;
  final DateTime expiry;
  _CacheEntry({required this.data, required this.expiry});

  bool get isExpired => DateTime.now().isAfter(expiry);
}
