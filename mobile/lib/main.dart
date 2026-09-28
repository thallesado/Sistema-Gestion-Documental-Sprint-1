import 'package:flutter/material.dart';
import 'core/api/auth_api.dart';
import 'core/theme/app_theme.dart';
import 'screens/auth/login_page.dart';

void main() => runApp(const NexoDocsApp());

class NexoDocsApp extends StatelessWidget {
  const NexoDocsApp({super.key, this.authApi});

  final AuthApi? authApi;

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'NexoDocs',
    debugShowCheckedModeBanner: false,
    theme: AppTheme.lightTheme,
    home: LoginPage(authApi: authApi ?? AuthApi()),
  );
}
