import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nexodocs_mobile/main.dart';

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
}
