import 'package:flutter/material.dart';

/// Paleta compartida con la web (variables --teal, --mint, --canvas, --ink del shell).
class AppTheme {
  static const teal = Color(0xff087f7b);
  static const tealDark = Color(0xff0f4c47);
  static const mint = Color(0xffd4ece7);
  static const canvas = Color(0xfff4f8f7);
  static const ink = Color(0xff1f2937);
  static const line = Color(0xffe5e7eb);

  static ThemeData get lightTheme => ThemeData(
    colorScheme: ColorScheme.fromSeed(seedColor: teal),
    scaffoldBackgroundColor: canvas,
    inputDecorationTheme: const InputDecorationTheme(border: OutlineInputBorder()),
    useMaterial3: true,
  );
}
