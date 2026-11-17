import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nexodocs_mobile/core/api/api_client.dart';
import 'package:nexodocs_mobile/core/api/auth_api.dart';
import 'package:nexodocs_mobile/core/api/clinical_api.dart';
import 'package:nexodocs_mobile/core/auth/user_permissions.dart';
import 'package:nexodocs_mobile/core/models/patient_model.dart';
import 'package:nexodocs_mobile/core/models/radicacion_receipt_model.dart';
import 'package:nexodocs_mobile/core/theme/app_theme.dart';
import 'package:nexodocs_mobile/screens/expedients/public_radicacion_page.dart';
import 'package:nexodocs_mobile/screens/expedients/radicacion_receipt_sheet.dart';
import 'package:nexodocs_mobile/screens/patients/patient_clinical_history_sheet.dart';
import 'package:nexodocs_mobile/screens/patients/patients_tab.dart';

class FakeServer {
  FakeServer(this.routes);

  final Map<String, http.Response Function(http.Request request)> routes;
  final requests = <http.Request>[];

  late final client = MockClient((request) async {
    requests.add(request);
    final path = request.url.path.replaceFirst('/api/v1', '');
    final handler = routes['${request.method} $path'];
    return handler?.call(request) ?? http.Response('{"message":"Ruta no simulada: $path"}', 404);
  });

  static http.Response json(Object body, [int status = 200]) =>
      http.Response.bytes(utf8.encode(jsonEncode(body)), status, headers: {'content-type': 'application/json'});

  static http.Response error(int status, String message) =>
      http.Response.bytes(utf8.encode(jsonEncode({'message': message})), status, headers: {'content-type': 'application/json'});
}

Map<String, dynamic> page(List<Map<String, dynamic>> items) =>
    {'content': items, 'totalElements': items.length, 'number': 0, 'size': 30};

void usePhoneScreen(WidgetTester tester) {
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    FlutterSecureStorage.setMockInitialValues({
      ApiClient.accessTokenKey: 'test-token',
      ApiClient.refreshTokenKey: 'test-refresh',
    });
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      (MethodCall methodCall) async {
        if (methodCall.method == 'Clipboard.setData') {
          return null;
        }
        return null;
      },
    );
  });

  group('Consulta Pública de Radicación (Modo Invitado / Ciudadano)', () {
    testWidgets('permite buscar radicado por código y muestra estado, sello y cronología', (tester) async {
      usePhoneScreen(tester);

      final server = FakeServer({
        'GET /tenants/public': (_) => FakeServer.json([
              {'id': 'tenant-demo-1', 'name': 'Alcaldía de San Juan'}
            ]),
        'GET /public/radicaciones/RAD-2026-000123': (req) {
          return FakeServer.json({
            'code': 'RAD-2026-000123',
            'tenantId': 'tenant-demo-1',
            'tenantName': 'Alcaldía de San Juan',
            'subject': 'Solicitud arreglo luminaria parque central',
            'type': 'PETICION',
            'status': 'ACTIVE',
            'statusLabel': 'En Trámite',
            'citizenName': 'Juan Pérez',
            'createdAt': '2026-11-17T10:30:00Z',
            'verificationHash': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            'summary': 'La luminaria de la esquina norte no enciende hace 2 semanas.',
            'events': [
              {
                'stageName': 'Radicación Formal Recibida',
                'description': 'Solicitud radicada en ventanilla digital por Juan Pérez',
                'timestamp': '2026-11-17T10:30:00Z',
                'status': 'COMPLETED',
              },
              {
                'stageName': 'En Gestión por Dependencia Competente',
                'description': 'Asignado a Alumbrado Público',
                'timestamp': '2026-11-17T11:00:00Z',
                'status': 'IN_PROGRESS',
              }
            ]
          });
        },
      });

      await tester.pumpWidget(MaterialApp(
        theme: AppTheme.lightTheme,
        home: PublicRadicacionPage(client: ApiClient(client: server.client)),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Consulta de Trámites'), findsOneWidget);
      expect(find.text('Alcaldía de San Juan'), findsOneWidget);

      // Ingresar código de radicación
      await tester.enterText(find.byKey(const Key('public-radicacion-code-input')), 'RAD-2026-000123');
      await tester.tap(find.byKey(const Key('public-radicacion-search-button')));
      await tester.pumpAndSettle();

      // Verificar que se muestre el resultado
      expect(find.byKey(const Key('public-radicacion-result-card')), findsOneWidget);
      expect(find.text('RAD-2026-000123'), findsWidgets);
      expect(find.text('En Trámite'), findsOneWidget);
      expect(find.text('Solicitud arreglo luminaria parque central'), findsOneWidget);
      expect(find.text('Juan Pérez'), findsOneWidget);

      // Abrir comprobante oficial
      await tester.ensureVisible(find.byKey(const Key('public-radicacion-receipt-button')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('public-radicacion-receipt-button')));
      await tester.pumpAndSettle();

      expect(find.text('Comprobante de Radicación'), findsOneWidget);
      expect(find.text('VENTANILLA ÚNICA DE RADICACIÓN DIGITAL'), findsOneWidget);
      expect(find.byKey(const Key('copy-certificate-button')), findsOneWidget);

      // Cerrar comprobante
      await tester.tap(find.byKey(const Key('close-receipt-button')));
      await tester.pumpAndSettle();

      // Desplazar para ver la cronología
      await tester.ensureVisible(find.text('Radicación Formal Recibida'));
      await tester.pumpAndSettle();
      expect(find.text('Radicación Formal Recibida'), findsOneWidget);
      expect(find.text('En Gestión por Dependencia Competente'), findsOneWidget);
    });

    testWidgets('muestra mensaje amigable si el trámite no existe', (tester) async {
      usePhoneScreen(tester);

      final server = FakeServer({
        'GET /tenants/public': (_) => FakeServer.json([
              {'id': 'tenant-demo-1', 'name': 'Alcaldía de San Juan'}
            ]),
        'GET /public/radicaciones/RAD-9999-999999': (_) => FakeServer.error(404, 'No se encontró ningún trámite con ese código'),
      });

      await tester.pumpWidget(MaterialApp(
        theme: AppTheme.lightTheme,
        home: PublicRadicacionPage(client: ApiClient(client: server.client)),
      ));
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('public-radicacion-code-input')), 'RAD-9999-999999');
      await tester.tap(find.byKey(const Key('public-radicacion-search-button')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('public-radicacion-error')), findsOneWidget);
      expect(find.textContaining('No se encontró ningún trámite'), findsOneWidget);
    });
  });

  group('Comprobante Oficial de Radicación con Sello de Tiempo', () {
    testWidgets('radicacion_receipt_sheet muestra sello cronológico, hash SHA-256 y permite copiar', (tester) async {
      usePhoneScreen(tester);

      final receipt = RadicacionReceiptModel.fromParameters(
        code: 'RAD-2026-000456',
        tenantName: 'Gobernación del Valle',
        radicacionType: 'DERECHO DE PETICIÓN',
        subject: 'Copia certificada de acuerdo municipal',
        citizenName: 'María Rodríguez',
        citizenDocumentType: 'CC',
        citizenDocumentNumber: '52345678',
        citizenEmail: 'maria.rodriguez@example.com',
        timestamp: DateTime(2026, 11, 17, 14, 20),
        attachmentName: 'peticion_firmada.pdf',
      );

      expect(receipt.verificationHash.length, 64);
      final certText = receipt.toFormalCertificateText();
      expect(certText.contains('RAD-2026-000456'), isTrue);
      expect(certText.contains('María Rodríguez'), isTrue);
      expect(certText.contains(receipt.verificationHash), isTrue);

      await tester.pumpWidget(MaterialApp(
        theme: AppTheme.lightTheme,
        home: Scaffold(
          body: Builder(
            builder: (ctx) => ElevatedButton(
              onPressed: () => showRadicacionReceiptSheet(ctx, receipt),
              child: const Text('Abrir'),
            ),
          ),
        ),
      ));

      await tester.tap(find.text('Abrir'));
      await tester.pumpAndSettle();

      expect(find.text('RAD-2026-000456'), findsOneWidget);
      expect(find.text('GOBERNACIÓN DEL VALLE'), findsOneWidget);
      expect(find.text('María Rodríguez'), findsOneWidget);
      expect(find.text('peticion_firmada.pdf'), findsOneWidget);
      expect(find.text(receipt.verificationHash), findsOneWidget);
      expect(find.byKey(const Key('copy-certificate-button')), findsOneWidget);

      await tester.tap(find.byKey(const Key('copy-certificate-button')));
      await tester.pumpAndSettle();
      expect(find.text('Comprobante Copiado'), findsOneWidget);
    });
  });

  group('Historial Clínico / Antecedentes y Evolución Médica (Sector Salud)', () {
    testWidgets('PatientClinicalHistorySheet muestra antecedentes, alergias, diagnósticos y notas médicas', (tester) async {
      usePhoneScreen(tester);

      final server = FakeServer({
        'GET /clinical-histories': (req) => FakeServer.json(page([
              {
                'id': 'history-1',
                'code': 'HC-00452',
                'patientId': 'pat-1',
                'patientLabel': 'Andrés Gómez',
                'bloodType': 'O+',
                'pathologicalAntecedents': 'Hipertensión arterial diagnosticada en 2021.',
                'nonPathologicalAntecedents': 'No fuma, actividad física 3 veces por semana.',
                'familyAntecedents': 'Madre con diabetes mellitus tipo 2.',
                'chronicConditions': 'Hipertensión Arterial Grado 1',
                'allergies': [
                  {
                    'allergen': 'Penicilina',
                    'severity': 'SEVERE',
                    'reaction': 'Anafilaxia',
                  },
                  {
                    'allergen': 'Polvo / Ácaros',
                    'severity': 'MILD',
                    'reaction': 'Rinitis',
                  }
                ],
                'currentMedications': [
                  {
                    'medicationName': 'Losartán 50mg',
                    'dosage': '1 tableta',
                    'frequency': 'Cada 12 horas',
                  }
                ],
                'baseDiagnoses': [
                  {
                    'code': 'I10',
                    'description': 'Hipertensión esencial (primaria)',
                    'status': 'ACTIVE',
                  }
                ],
              }
            ])),
        'GET /medical-notes': (req) => FakeServer.json(page([
              {
                'id': 'note-1',
                'clinicalHistoryId': 'history-1',
                'noteType': 'EVOLUCIÓN',
                'content': 'Paciente asiste a control de tensión arterial. Cifras estables 120/80 mmHg.',
                'status': 'APPROVED',
                'createdAt': '2026-11-16T15:00:00Z',
              }
            ])),
      });

      final clinicalApi = ClinicalApi(ApiClient(client: server.client));
      const patient = PatientModel(
        id: 'pat-1',
        name: 'Andrés Gómez',
        documentId: '1098765432',
        bloodType: 'O+',
      );

      await tester.pumpWidget(MaterialApp(
        theme: AppTheme.lightTheme,
        home: Scaffold(
          body: Builder(
            builder: (ctx) => ElevatedButton(
              onPressed: () => showPatientClinicalHistorySheet(ctx, clinicalApi, patient),
              child: const Text('Ver HC'),
            ),
          ),
        ),
      ));

      await tester.tap(find.text('Ver HC'));
      await tester.pumpAndSettle();

      // Verificar cabecera
      expect(find.text('Andrés Gómez'), findsOneWidget);
      expect(find.text('CI 1098765432'), findsOneWidget);
      expect(find.text('O+'), findsOneWidget);

      // Verificar Tab 1: Antecedentes
      expect(find.byKey(const Key('clinical-antecedentes-list')), findsOneWidget);
      expect(find.textContaining('Penicilina (SEVERE)'), findsOneWidget);
      expect(find.textContaining('Hipertensión arterial diagnosticada en 2021'), findsOneWidget);
      expect(find.textContaining('Madre con diabetes mellitus'), findsOneWidget);

      // Cambiar a Tab 2: Diagnósticos
      await tester.tap(find.text('Diagnósticos'));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('clinical-diagnosticos-list')), findsOneWidget);
      expect(find.text('I10'), findsOneWidget);
      expect(find.text('Hipertensión esencial (primaria)'), findsOneWidget);
      expect(find.text('Losartán 50mg'), findsOneWidget);

      // Cambiar a Tab 3: Evolución
      await tester.tap(find.text('Evolución'));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('clinical-notes-list')), findsOneWidget);
      expect(find.text('EVOLUCIÓN'), findsOneWidget);
      expect(find.textContaining('Paciente asiste a control de tensión arterial'), findsOneWidget);
    });

    testWidgets('PatientsTab tiene botón para abrir historial clínico completo', (tester) async {
      usePhoneScreen(tester);

      final server = FakeServer({
        'GET /patients': (_) => FakeServer.json(page([
              {
                'id': 'pat-100',
                'name': 'Beatriz Morales',
                'documentId': '43210987',
                'bloodType': 'A+',
              }
            ])),
        'GET /clinical-histories': (_) => FakeServer.json(page([
              {
                'id': 'history-100',
                'code': 'HC-00100',
                'patientId': 'pat-100',
                'patientLabel': 'Beatriz Morales',
                'bloodType': 'A+',
                'allergies': [],
                'currentMedications': [],
                'baseDiagnoses': [],
              }
            ])),
        'GET /medical-notes': (_) => FakeServer.json(page([])),
      });

      final authApi = AuthApi(client: server.client)..permissions.value = UserPermissions({'patient:read'});

      await tester.pumpWidget(MaterialApp(
        theme: AppTheme.lightTheme,
        home: Scaffold(
          body: PatientsTab(api: authApi),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Beatriz Morales'), findsOneWidget);
      expect(find.byKey(const Key('patient-history-pat-100')), findsOneWidget);

      // Tocar botón de historial clínico
      await tester.tap(find.byKey(const Key('patient-history-pat-100')));
      await tester.pumpAndSettle();

      expect(find.text('Antecedentes'), findsOneWidget);
      expect(find.text('Beatriz Morales'), findsWidgets);
    });
  });
}
