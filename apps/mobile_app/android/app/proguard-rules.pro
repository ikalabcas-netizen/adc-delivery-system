# Flutter specific ProGuard rules
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }
-dontwarn io.flutter.embedding.**

# Keep Supabase / GoTrue related classes
-keep class io.supabase.** { *; }

# Keep annotations
-keepattributes *Annotation*
