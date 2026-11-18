import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:path_provider_platform_interface/path_provider_platform_interface.dart';
import 'package:plugin_platform_interface/plugin_platform_interface.dart';

import 'package:nexodocs_mobile/core/api/api_client.dart';
import 'package:nexodocs_mobile/core/api/auth_api.dart';
import 'package:nexodocs_mobile/core/auth/biometric_service.dart';
import 'package:nexodocs_mobile/core/auth/user_permissions.dart';
import 'package:nexodocs_mobile/core/models/patient_model.dart';
import 'package:nexodocs_mobile/core/models/radicacion_receipt_model.dart';
import 'package:nexodocs_mobile/core/theme/app_theme.dart';
import 'package:nexodocs_mobile/core/utils/ocr_field_extractor.dart';
import 'package:nexodocs_mobile/core/widgets/signature_pad_widget.dart';
import 'package:nexodocs_mobile/screens/audit/audit_log_page.dart';
import 'package:nexodocs_mobile/screens/documents/document_detail_sheet.dart';
import 'package:nexodocs_mobile/screens/expedients/radicacion_receipt_sheet.dart';
import 'package:nexodocs_mobile/screens/patients/patient_appointments_sheet.dart';
import 'package:nexodocs_mobile/screens/scan/scan_document_page.dart';
import 'package:nexodocs_mobile/screens/tasks/tasks_tab.dart';

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
}

class FakePathProviderPlatform extends Fake with MockPlatformInterfaceMixin implements PathProviderPlatform {
  @override
  Future<String?> getTemporaryPath() async => Directory.systemTemp.path;

  @override
  Future<String?> getApplicationDocumentsPath() async => Directory.systemTemp.path;
}

class FakeBiometricService extends BiometricService {
  FakeBiometricService({this.enabled = true, this.authResult = true});

  final bool enabled;
  final bool authResult;
  int authCalls = 0;

  @override
  Future<bool> isAvailable() async => true;

  @override
  Future<bool> isEnabled() async => enabled;

  @override
  Future<bool> authenticate({String? reason = 'Confirma tu identidad'}) async {
    authCalls++;
    return authResult;
  }
}

Map<String, dynamic> page(List<Map<String, dynamic>> items) =>
    {'content': items, 'totalElements': items.length, 'number': 0, 'size': 25};

void usePhoneScreen(WidgetTester tester) {
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 2.5;
  addTearDown(tester.view.reset);
}

const realChecksum = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    PathProviderPlatform.instance = FakePathProviderPlatform();
    FlutterSecureStorage.setMockInitialValues({
      ApiClient.accessTokenKey: 'test-token',
      ApiClient.refreshTokenKey: 'test-refresh',
    });
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      (MethodCall methodCall) async => null,
    );
  });

  group('1. Firma Digital Ciudadana, PDF Nativo y Código QR', () {
    testWidgets('SignaturePadWidget captura firma digital y calcula sello SHA-256', (tester) async {
      usePhoneScreen(tester);
      CitizenSignatureData? capturedSignature;

      await tester.pumpWidget(MaterialApp(
        theme: AppTheme.lightTheme,
        home: Scaffold(
          body: Padding(
            padding: const EdgeInsets.all(16),
            child: SignaturePadWidget(
              signerName: 'Carlos Mendoza',
              onSignatureChanged: (sig) => capturedSignature = sig,
            ),
          ),
        ),
      ));

      expect(find.text('Firma aquí con tu dedo o stylus'), findsOneWidget);
      await tester.tap(find.byKey(const Key('signature-quick-sign-button')));
      await tester.pumpAndSettle();

      expect(capturedSignature, isNotNull);
      expect(capturedSignature!.signatureHash.length, 64);
      expect(capturedSignature!.signerLabel, 'Carlos Mendoza');
      expect(find.text('Firma Digital Capturada'), findsOneWidget);
    });

    testWidgets('RadicacionReceiptSheet muestra QR de autenticidad y genera archivo PDF real', (tester) async {
      usePhoneScreen(tester);

      final receipt = RadicacionReceiptModel.fromParameters(
        code: 'RAD-2026-009911',
        tenantName: 'Hospital Universitario del Valle',
        radicacionType: 'PETICIÓN',
        subject: 'Entrega de copia de epicrisis',
        citizenName: 'Laura Gómez',
        citizenDocumentType: 'CC',
        citizenDocumentNumber: '1144009988',
        citizenEmail: 'laura@correo.co',
        timestamp: DateTime(2026, 11, 17, 9, 15),
        signatureHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
      );

      await tester.pumpWidget(MaterialApp(
        theme: AppTheme.lightTheme,
        home: Scaffold(
          body: Builder(
            builder: (ctx) => ElevatedButton(
              onPressed: () => showRadicacionReceiptSheet(ctx, receipt),
              child: const Text('Abrir Comprobante'),
            ),
          ),
        ),
      ));
      await tester.tap(find.text('Abrir Comprobante'));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('verification-qr-widget')), findsOneWidget);
      expect(find.text('QR de Autenticidad'), findsOneWidget);
      expect(find.byKey(const Key('download-receipt-pdf-button')), findsOneWidget);

      await tester.tap(find.byKey(const Key('download-receipt-pdf-button')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('pdf-saved-indicator')), findsOneWidget);
      expect(find.text('PDF Guardado'), findsOneWidget);

      final expectedFile = File('${Directory.systemTemp.path}${Platform.pathSeparator}Comprobante_RAD-2026-009911.pdf');
      expect(expectedFile.existsSync(), isTrue);
      final pdfHeader = utf8.decode(expectedFile.readAsBytesSync().take(8).toList(), allowMalformed: true);
      expect(pdfHeader, startsWith('%PDF-1.4'));
    });

    testWidgets('DocumentDetailSheet abre Certificado QR de Autenticidad y descarga PDF', (tester) async {
      usePhoneScreen(tester);

      final server = FakeServer({
        'GET /documents/doc-cert-1': (_) => FakeServer.json({
              'id': 'doc-cert-1',
              'code': 'RES-2026-088',
              'name': 'Resolución de Aprobación Presupuestal',
              'status': 'APPROVED',
              'authorName': 'Dirección Financiera',
              'updatedAt': '2026-11-17T10:00:00Z',
            }),
        'GET /documents/doc-cert-1/versions': (_) => FakeServer.json([
              {
                'id': 'ver-1',
                'versionNumber': 2,
                'fileName': 'resolucion_088.pdf',
                'fileSizeBytes': 12400,
                // Nombre real del campo en DocumentVersionResponse.
                'checksumSha256': realChecksum,
                'createdAt': '2026-11-17T10:00:00Z',
              }
            ]),
        'GET /workflows': (_) => FakeServer.json(page([])),
      });

      final api = AuthApi(client: server.client)..permissions.value = const UserPermissions({'document:read'});

      await tester.pumpWidget(MaterialApp(
        theme: AppTheme.lightTheme,
        home: Scaffold(body: DocumentDetailSheet(api: api, documentId: 'doc-cert-1')),
      ));
      await tester.pumpAndSettle();

      final certButton = find.byKey(const Key('document-qr-certificate-button'));
      expect(certButton, findsOneWidget);

      await tester.tap(certButton);
      await tester.pumpAndSettle();

      expect(find.text('Certificado QR de Autenticidad'), findsWidgets);
      expect(find.byKey(const Key('verification-qr-widget')), findsOneWidget);
      // La huella es la del archivo, no una calculada con el código y el nombre.
      expect(find.text(realChecksum), findsOneWidget);

      await tester.tap(find.byKey(const Key('download-doc-certificate-pdf-button')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('doc-certificate-pdf-saved')), findsOneWidget);
    });

    testWidgets('sin checksum de la versión no se inventa una huella ni se emite certificado', (tester) async {
      usePhoneScreen(tester);
      final server = FakeServer({
        'GET /documents/doc-cert-2': (_) => FakeServer.json({
              'id': 'doc-cert-2', 'code': 'DOC-002', 'name': 'Acta sin huella', 'status': 'APPROVED', 'updatedAt': '2026-11-17T10:00:00Z',
            }),
        'GET /documents/doc-cert-2/versions': (_) => FakeServer.json([
              {'id': 'ver-9', 'versionNumber': 1, 'fileName': 'acta.pdf', 'createdAt': '2026-11-17T10:00:00Z'}
            ]),
        'GET /workflows': (_) => FakeServer.json(page([])),
      });
      final api = AuthApi(client: server.client)..permissions.value = const UserPermissions({'document:read'});

      await tester.pumpWidget(MaterialApp(
        theme: AppTheme.lightTheme,
        home: Scaffold(body: DocumentDetailSheet(api: api, documentId: 'doc-cert-2')),
      ));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('document-qr-certificate-button')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('verification-qr-widget')), findsNothing);
      expect(find.byKey(const Key('doc-certificate-hash-missing')), findsOneWidget);
      final pdf = tester.widget<ButtonStyleButton>(find.byKey(const Key('download-doc-certificate-pdf-button')));
      expect(pdf.onPressed, isNull);
    });
  });

  group('2. Página de Citas Médicas (Agendamiento Ciudadano)', () {
    testWidgets('PatientAppointmentsSheet consulta citas y agenda una nueva cita médica', (tester) async {
      usePhoneScreen(tester);
      bool noteCreated = false;

      final server = FakeServer({
        'GET /clinical-histories': (_) => FakeServer.json(page([
              {'id': 'hc-pat-1', 'patientId': 'pat-1', 'code': 'HC-001'}
            ])),
        'GET /medical-notes': (_) => FakeServer.json(page([
              {
                'id': 'note-cita-1',
                'clinicalHistoryId': 'hc-pat-1',
                'noteType': 'CITA_PEDIATRIA',
                'content': 'Control de crecimiento y desarrollo',
                'status': 'APPROVED',
                'createdAt': '2026-11-15T09:00:00Z',
              }
            ])),
        'POST /medical-notes': (req) {
          noteCreated = true;
          final body = jsonDecode(req.body) as Map<String, dynamic>;
          expect(body['noteType'], 'CITA_CARDIOLOGÍA');
          // El backend solo acepta crear notas en BORRADOR.
          expect(body['status'], 'DRAFT');
          return FakeServer.json({
            'id': 'note-cita-new',
            'clinicalHistoryId': 'hc-pat-1',
            'noteType': body['noteType'],
            'content': body['content'],
            'status': 'APPROVED',
          }, 201);
        },
      });

      final api = AuthApi(client: server.client)..permissions.value = const UserPermissions({'patient:read'});
      const patient = PatientModel(id: 'pat-1', name: 'Sofía Vergara', documentId: '31998877');

      await tester.pumpWidget(MaterialApp(
        theme: AppTheme.lightTheme,
        home: Scaffold(
          body: PatientAppointmentsSheet(clinicalApi: api.clinical, patient: patient),
        ),
      ));
      await tester.pumpAndSettle();

      // Verifica cita existente en pestaña 1
      expect(find.text('PEDIATRIA'), findsOneWidget);
      expect(find.text('Control de crecimiento y desarrollo'), findsOneWidget);

      // Cambiar a pestaña "Agendar Cita"
      await tester.tap(find.text('Agendar Cita'));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('specialty-chip-Cardiología')));
      await tester.pumpAndSettle();

      await tester.enterText(
        find.byKey(const Key('appointment-reason-input')),
        'Valoración de electrocardiograma y chequeo preventivo',
      );
      await tester.tap(find.byKey(const Key('submit-appointment-button')));
      await tester.pumpAndSettle();

      expect(noteCreated, isTrue);
      expect(find.text('Cardiología'), findsOneWidget);
    });

    testWidgets('si el servidor rechaza la cita no se muestra como agendada y se informa el error', (tester) async {
      usePhoneScreen(tester);
      final server = FakeServer({
        'GET /clinical-histories': (_) => FakeServer.json(page([
              {'id': 'hc-pat-1', 'patientId': 'pat-1', 'code': 'HC-001'}
            ])),
        'GET /medical-notes': (_) => FakeServer.json(page([])),
        'POST /medical-notes': (_) => FakeServer.json({'message': 'Toda nota médica debe crearse como BORRADOR'}, 400),
      });
      final api = AuthApi(client: server.client)..permissions.value = const UserPermissions({'patient:read'});
      const patient = PatientModel(id: 'pat-1', name: 'Sofía Vergara', documentId: '31998877');

      await tester.pumpWidget(MaterialApp(
        theme: AppTheme.lightTheme,
        home: Scaffold(body: PatientAppointmentsSheet(clinicalApi: api.clinical, patient: patient)),
      ));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Agendar Cita'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('specialty-chip-Cardiología')));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('appointment-reason-input')), 'Chequeo preventivo anual');
      await tester.tap(find.byKey(const Key('submit-appointment-button')));
      await tester.pumpAndSettle();

      expect(find.text('Toda nota médica debe crearse como BORRADOR'), findsOneWidget);
      await tester.tap(find.text('Mis Citas'));
      await tester.pumpAndSettle();
      expect(find.text('Cardiología'), findsNothing);
    });
  });

  group('3. Bandeja de Aprobación Múltiple (Bulk Approve)', () {
    testWidgets('TasksTab permite seleccionar múltiples tareas y aprobarlas en bloque con 1 sola firma biométrica', (tester) async {
      usePhoneScreen(tester);
      final actedTaskIds = <String>[];

      final server = FakeServer({
        'GET /workflows/tasks': (_) => FakeServer.json(page([
              {
                'id': 'task-101',
                'title': 'Aprobar Orden de Compra #101',
                'status': 'PENDING',
                'stage_type': 'APPROVAL',
                'can_act': true,
                'priority': 2,
                'workflow_title': 'Compras',
                'workflow_code': 'WF-101',
              },
              {
                'id': 'task-102',
                'title': 'Aprobar Viáticos #102',
                'status': 'PENDING',
                'stage_type': 'APPROVAL',
                'can_act': true,
                'priority': 3,
                'workflow_title': 'Contabilidad',
                'workflow_code': 'WF-102',
              },
            ])),
        'POST /workflows/tasks/task-101/actions': (_) {
          actedTaskIds.add('task-101');
          return FakeServer.json({'status': 'COMPLETED'});
        },
        'POST /workflows/tasks/task-102/actions': (_) {
          actedTaskIds.add('task-102');
          return FakeServer.json({'status': 'COMPLETED'});
        },
      });

      final fakeBiometrics = FakeBiometricService(enabled: true, authResult: true);
      final api = AuthApi(client: server.client, biometrics: fakeBiometrics);

      await tester.pumpWidget(MaterialApp(
        theme: AppTheme.lightTheme,
        home: Scaffold(
          body: TasksTab(api: api, biometricService: fakeBiometrics),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('toggle-bulk-mode-button')), findsOneWidget);

      // Activar modo en bloque
      await tester.tap(find.byKey(const Key('toggle-bulk-mode-button')));
      await tester.pumpAndSettle();

      // Seleccionar todas las tareas
      await tester.tap(find.byKey(const Key('bulk-select-all-button')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('bulk-approve-bar')), findsOneWidget);
      expect(find.text('2 seleccionadas'), findsOneWidget);

      // Firmar y aprobar en bloque
      await tester.tap(find.byKey(const Key('bulk-approve-submit-button')));
      await tester.pumpAndSettle();

      expect(fakeBiometrics.authCalls, 1);
      expect(actedTaskIds, containsAll(['task-101', 'task-102']));
    });
  });

  group('4. Pistas de Auditoría y Trazabilidad en Tiempo Real (Audit Log)', () {
    testWidgets('AuditLogPage verifica cadena SHA-256, lista eventos y filtra sospechosos', (tester) async {
      usePhoneScreen(tester);

      final server = FakeServer({
        'GET /audit/verify': (_) => FakeServer.json({
              'valid': true,
              'totalVerified': 148,
              'verifiedAt': '2026-11-17T12:00:00Z',
            }),
        'GET /audit': (req) {
          final isFailureFilter = req.url.queryParameters['result'] == 'FAILURE';
          if (isFailureFilter) {
            return FakeServer.json(page([
              {
                'id': 502,
                'action': 'ACCESS_DENIED_DOCUMENT',
                'entityType': 'DOCUMENT',
                'occurredAt': '2026-11-17T11:45:00Z',
                'result': 'FAILURE',
                'ipAddress': '192.168.1.99',
                'chainSeq': 148,
                'recordHash': 'f9e8d7c6b5a4f9e8d7c6b5a4f9e8d7c6b5a4f9e8d7c6b5a4f9e8d7c6b5a4f9e8',
              }
            ]));
          }
          return FakeServer.json(page([
            {
              'id': 501,
              'action': 'VERSION_DOWNLOAD',
              'entityType': 'DOCUMENT_VERSION',
              'occurredAt': '2026-11-17T11:30:00Z',
              'result': 'SUCCESS',
              'ipAddress': '10.0.0.15',
              'chainSeq': 147,
              'recordHash': '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            },
            {
              'id': 502,
              'action': 'ACCESS_DENIED_DOCUMENT',
              'entityType': 'DOCUMENT',
              'occurredAt': '2026-11-17T11:45:00Z',
              'result': 'FAILURE',
              'ipAddress': '192.168.1.99',
              'chainSeq': 148,
              'recordHash': 'f9e8d7c6b5a4f9e8d7c6b5a4f9e8d7c6b5a4f9e8d7c6b5a4f9e8d7c6b5a4f9e8',
            }
          ]));
        },
      });

      final api = AuthApi(client: server.client)
        ..permissions.value = const UserPermissions({'audit:read_tenant'});

      await tester.pumpWidget(MaterialApp(
        theme: AppTheme.lightTheme,
        home: AuditLogPage(api: api),
      ));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('audit-chain-status-banner')), findsOneWidget);
      expect(find.textContaining('Cadena SHA-256 Íntegra (148 eventos)'), findsOneWidget);
      expect(find.text('Descarga de versión documental'), findsOneWidget);

      // Filtrar por sospechosos / fallos
      await tester.ensureVisible(find.byKey(const Key('audit-filter-suspicious')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('audit-filter-suspicious')));
      await tester.pumpAndSettle();

      expect(find.text('ACCESS DENIED DOCUMENT'), findsOneWidget);
    });
  });

  group('5. Digitalización OCR con Extracción Automática para Radicar sin Tecleo', () {
    testWidgets('ScanDocumentPage extrae metadatos y abre RadicacionWizardSheet autocompletado', (tester) async {
      usePhoneScreen(tester);

      final server = FakeServer({
        'GET /ocr/jobs': (_) => FakeServer.json([]),
        'GET /ocr/jobs/job-factura-1': (_) => FakeServer.json({
              'id': 'job-factura-1',
              'status': 'VALIDATED',
              'documentType': 'FACTURA',
              'confidence': 0.96,
              'patientName': 'Suministros Médicos S.A.S.',
              'patientDocumentNumber': '900123456-1',
              'issueDate': '2026-11-17',
              'extractedSummary': 'Factura electrónica FEV-9921 por valor de \$4.500.000 COP de insumos hospitalarios.',
            }),
        'GET /expedient-types': (_) => FakeServer.json(page([
              {'id': 'exp-t1', 'code': 'RAD', 'name': 'Radicación General'}
            ])),
      });

      final api = AuthApi(client: server.client)
        ..permissions.value = const UserPermissions({
          'ocr:read',
          'ocr:create',
          'expedient:create',
          'document:create',
        });

      final preFill = OcrFieldExtractor.extractFromJob({
        'documentType': 'FACTURA',
        'patientName': 'Suministros Médicos S.A.S.',
        'patientDocumentNumber': '900123456-1',
        'issueDate': '2026-11-17',
        'extractedSummary': 'Factura electrónica por \$4.500.000 COP NIT 900123456-1',
      });

      expect(preFill.detectedDocumentClass, 'Factura / Cuenta de Cobro');
      expect(preFill.citizenName, 'Suministros Médicos S.A.S.');
      expect(preFill.citizenDocNumber, '900123456-1');
      expect(preFill.amountOrReference, '\$4.500.000');

      await tester.pumpWidget(MaterialApp(
        theme: AppTheme.lightTheme,
        home: ScanDocumentPage(api: api, initialJobId: 'job-factura-1'),
      ));
      await tester.pumpAndSettle();

      final radicarBtn = find.byKey(const Key('ocr-radicar-prefilled-button'));
      await tester.ensureVisible(radicarBtn);
      await tester.pumpAndSettle();
      expect(radicarBtn, findsOneWidget);

      await tester.tap(radicarBtn);
      await tester.pumpAndSettle();

      // Verificar que el wizard se abrió autocompletado sin tecleo manual
      expect(find.byKey(const Key('radicacion-ocr-applied-banner')), findsOneWidget);
      expect(find.text('Suministros Médicos S.A.S.'), findsOneWidget);
      expect(find.text('900123456-1'), findsOneWidget);
    });
  });
}
