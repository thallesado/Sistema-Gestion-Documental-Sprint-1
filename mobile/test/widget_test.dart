import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nexodocs_mobile/core/api/auth_api.dart';
import 'package:nexodocs_mobile/core/theme/app_theme.dart';
import 'package:nexodocs_mobile/main.dart';
import 'package:nexodocs_mobile/screens/shell/main_shell_page.dart';

void main() {
  testWidgets('login móvil exige organización, usuario y contraseña', (
    tester,
  ) async {
    await tester.pumpWidget(NexoDocsApp(authApi: AuthApi()));

    await tester.tap(find.byKey(const Key('login-submit')));
    await tester.pump();

    expect(find.text('Campo obligatorio'), findsNWidgets(3));
    expect(find.text('NexoDocs'), findsOneWidget);
  });

  testWidgets('shell móvil contiene las 5 pestañas de navegación', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        home: MainShellPage(api: AuthApi()),
      ),
    );
    await tester.pump();

    expect(find.text('Inicio'), findsOneWidget);
    expect(find.text('Documentos'), findsOneWidget);
    expect(find.text('Tareas'), findsOneWidget);
    expect(find.text('Clínico'), findsOneWidget);
    expect(find.text('Perfil'), findsOneWidget);
  });
}
