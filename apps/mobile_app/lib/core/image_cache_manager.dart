import 'package:flutter_cache_manager/flutter_cache_manager.dart';

/// Custom image cache manager with 7-day stalePeriod.
/// Images cached on device are automatically cleaned after 7 days.
class AppImageCacheManager extends CacheManager with ImageCacheManager {
  static const key = 'adc_image_cache';
  static final instance = AppImageCacheManager._();

  AppImageCacheManager._()
      : super(Config(
          key,
          stalePeriod: const Duration(days: 7), // auto-delete after 1 week
          maxNrOfCacheObjects: 200, // max 200 images cached
        ));
}
