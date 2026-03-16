import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// ADC Theme — đồng bộ với Web App
/// Màu: Cyan #06b6d4 (primary), Navy #164e63 (dark), Navy-950 #0a3444 (AppBar)
/// Font: Outfit (giống web app)
class AppTheme {
  // Palette (matching web app CSS variables)
  static const _cyan500  = Color(0xFF06B6D4); // --adc-cyan
  static const _cyan600  = Color(0xFF0891B2); // --adc-dark
  static const _navy900  = Color(0xFF164E63); // --adc-navy
  static const _navy950  = Color(0xFF0A3444); // --adc-navy-950

  static ThemeData get light {
    final base = ColorScheme.fromSeed(
      seedColor: _cyan500,
      brightness: Brightness.light,
      primary: _cyan600,
      onPrimary: Colors.white,
      secondary: _navy900,
      onSecondary: Colors.white,
      surface: const Color(0xFFF8FAFC),     // --bg web app
      onSurface: const Color(0xFF1E293B),   // slate-900
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: base,
      textTheme: GoogleFonts.outfitTextTheme(),
      appBarTheme: AppBarTheme(
        centerTitle: true,
        elevation: 0,
        backgroundColor: _navy950,
        foregroundColor: Colors.white,
        titleTextStyle: GoogleFonts.outfit(
          fontSize: 18,
          fontWeight: FontWeight.w700,
          color: Colors.white,
        ),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      tabBarTheme: TabBarThemeData(
        labelColor: _cyan500,
        unselectedLabelColor: const Color(0xFF94A3B8),
        indicatorColor: _cyan500,
        indicatorSize: TabBarIndicatorSize.tab,
        labelStyle: GoogleFonts.outfit(fontWeight: FontWeight.w600, fontSize: 14),
        unselectedLabelStyle: GoogleFonts.outfit(fontWeight: FontWeight.w500, fontSize: 14),
      ),
      cardTheme: CardThemeData(
        elevation: 1,
        color: Colors.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
            side: const BorderSide(color: Color(0xFFE2E8F0), width: 1)),
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: _cyan600,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          textStyle: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w600),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: _cyan600,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          textStyle: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w600),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
        filled: true,
        fillColor: const Color(0xFFF1F5F9),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: Colors.white,
        selectedItemColor: _cyan600,
        unselectedItemColor: Color(0xFF94A3B8),
        elevation: 8,
      ),
    );
  }

  static ThemeData get dark {
    final base = ColorScheme.fromSeed(
      seedColor: _cyan500,
      brightness: Brightness.dark,
      primary: _cyan500,
      onPrimary: _navy950,
      secondary: _cyan600,
      surface: const Color(0xFF0F172A),     // slate-900
      onSurface: const Color(0xFFF1F5F9),   // slate-100
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: base,
      textTheme: GoogleFonts.outfitTextTheme(ThemeData.dark().textTheme),
      appBarTheme: AppBarTheme(
        centerTitle: true,
        elevation: 0,
        backgroundColor: _navy950,
        foregroundColor: Colors.white,
        titleTextStyle: GoogleFonts.outfit(
          fontSize: 18,
          fontWeight: FontWeight.w700,
          color: Colors.white,
        ),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      tabBarTheme: TabBarThemeData(
        labelColor: _cyan500,
        unselectedLabelColor: const Color(0xFF64748B),
        indicatorColor: _cyan500,
        indicatorSize: TabBarIndicatorSize.tab,
        labelStyle: GoogleFonts.outfit(fontWeight: FontWeight.w600, fontSize: 14),
        unselectedLabelStyle: GoogleFonts.outfit(fontWeight: FontWeight.w500, fontSize: 14),
      ),
      cardTheme: CardThemeData(
        elevation: 1,
        color: const Color(0xFF1E293B),
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
            side: const BorderSide(color: Color(0xFF334155), width: 1)),
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: _cyan500,
          foregroundColor: _navy950,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          textStyle: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w600),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: _cyan500,
          foregroundColor: _navy950,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          textStyle: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w600),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
        filled: true,
        fillColor: const Color(0xFF1E293B),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: Color(0xFF0F172A),
        selectedItemColor: _cyan500,
        unselectedItemColor: Color(0xFF64748B),
        elevation: 8,
      ),
    );
  }

  // Order status colors (matching web app badges)
  static const statusColors = {
    'pending':    Color(0xFFD97706), // amber-600
    'assigned':   Color(0xFF2563EB), // blue-600
    'staging':    Color(0xFF0891B2), // cyan-600
    'in_transit': Color(0xFF7C3AED), // violet-600
    'delivered':  Color(0xFF059669), // green-600
    'cancelled':  Color(0xFF94A3B8), // slate-400
    'failed':     Color(0xFFDC2626), // red-600
  };

  static const statusLabels = {
    'pending':    'Chờ xử lý',
    'assigned':   'Đã gán',
    'staging':    'Đang xếp chuyến',
    'in_transit': 'Đang giao',
    'delivered':  'Đã giao',
    'cancelled':  'Đã huỷ',
    'failed':     'Thất bại',
  };
}
