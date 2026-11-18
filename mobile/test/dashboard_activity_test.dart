import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nexodocs_mobile/core/api/api_client.dart';
import 'package:nexodocs_mobile/core/api/auth_api.dart';
import 'package:nexodocs_mobile/core/auth/user_permissions.dart';
import 'package:nexodocs_mobile/core/models/clinical_history_model.dart';
import 'package:nexodocs_mobile/core/theme/app_theme.dart';
import 'package:nexodocs_mobile/screens/dashboard/dashboard_tab.dart';

http.Response json(Object body) =>
    http.Response.bytes(utf8.encode(jsonEncode(body)), 200, headers: {'content-type': 'application/json'});

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({
        ApiClient.accessTokenKey: 'test-token',
        ApiClient.refreshTokenKey: 'test-refresh',
      }));

  testWidgets('la actividad reciente usa action, actorName y occurredAt de DashboardActivityResponse', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.75;
    addTearDown(tester.view.reset);
    final client = MockClient((request) async {
      final path = request.url.path.replaceFirst('/api/v1', '');
      if (path == '/dashboard') {
        return json({
          'currentUser': {'firstName': 'Laura', 'lastName': 'Martínez', 'tenantName': 'FinoCode'},
          'recentDocuments': [],
          'recentActivity': [
            {
              'id': 1, 'actorName': 'Laura Martínez', 'action': 'DOCUMENT_CREATE', 'entityType': 'DOCUMENTS',
              'occurredAt': '2026-11-17T23:42:00Z', 'result': 'SUCCESS',
            },
          ],
        });
      }
      return json({'content': [], 'totalElements': 0});
    });
    final api = AuthApi(client: client)..permissions.value = const UserPermissions({'document:read', 'task:read'});

    await tester.pumpWidget(MaterialApp(
      theme: AppTheme.lightTheme,
      home: Scaffold(body: DashboardTab(api: api, onNavigateToTab: (_) {})),
    ));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Creación de documento'), 300);

    expect(find.text('Creación de documento'), findsOneWidget);
    expect(find.text('Actividad registrada'), findsNothing);
    expect(find.textContaining('Laura Martínez'), findsWidgets);
  });

  test('la dosis del medicamento se lee de dose (MedicationEntry del backend)', () {
    final medication = ClinicalMedicationModel.fromJson({'name': 'Metformina', 'dose': '850 mg', 'frequency': 'cada 12 h'});
    expect(medication.dosage, '850 mg');
  });
}
