import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nexodocs_mobile/core/api/api_client.dart';
import 'package:nexodocs_mobile/core/api/auth_api.dart';
import 'package:nexodocs_mobile/core/auth/user_permissions.dart';
import 'package:nexodocs_mobile/core/i18n/app_language.dart';
import 'package:nexodocs_mobile/core/i18n/translations_en.dart';
import 'package:nexodocs_mobile/core/theme/app_theme.dart';
import 'package:nexodocs_mobile/screens/documents/create_document_page.dart';
import 'package:nexodocs_mobile/screens/documents/repository_tab.dart';
import 'package:nexodocs_mobile/screens/documents/upload_version_sheet.dart';
import 'package:nexodocs_mobile/screens/expedients/expedients_view.dart';
import 'package:nexodocs_mobile/screens/patients/clinical_labels.dart';
import 'package:nexodocs_mobile/screens/patients/patient_detail_page.dart';
import 'package:nexodocs_mobile/screens/shell/main_shell_page.dart';

/// Servidor simulado: responde según "MÉTODO /ruta" y registra las peticiones.
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

  Iterable<http.Request> called(String method, String path) =>
      requests.where((r) => r.method == method && r.url.path.replaceFirst('/api/v1', '') == path);

  static http.Response json(Object body, [int status = 200]) =>
      http.Response.bytes(utf8.encode(jsonEncode(body)), status, headers: {'content-type': 'application/json'});
}

Map<String, dynamic> page(List<Map<String, dynamic>> items) => {'content': items, 'totalElements': items.length, 'number': 0, 'size': 30};

void signedIn() => FlutterSecureStorage.setMockInitialValues({ApiClient.accessTokenKey: 't', ApiClient.refreshTokenKey: 'r'});

AuthApi apiWith(FakeServer server, List<String> permissions) =>
    AuthApi(client: server.client)..permissions.value = UserPermissions(permissions.toSet());

Map<String, dynamic> bodyOf(http.Request request) => jsonDecode(request.body) as Map<String, dynamic>;

/// Abre [page] desde un botón para poder comprobar lo que devuelve al cerrarse.
class Launcher extends StatefulWidget {
  const Launcher(this.page, {super.key});

  final Widget page;

  @override
  State<Launcher> createState() => LauncherState();
}

class LauncherState extends State<Launcher> {
  Object? result;

  @override
  Widget build(BuildContext context) => Scaffold(
    body: Center(
      child: ElevatedButton(
        key: const Key('launch'),
        onPressed: () async {
          final value = await Navigator.of(context).push<Object?>(MaterialPageRoute(builder: (_) => widget.page));
          setState(() => result = value);
        },
        child: const Text('abrir'),
      ),
    ),
  );
}

/// Desplaza el formulario (ListView perezoso) hasta construir y mostrar [finder].
Future<void> reveal(WidgetTester tester, Finder finder, {bool up = false}) async {
  await tester.dragUntilVisible(finder, find.byType(ListView).first, Offset(0, up ? 250 : -250));
  await tester.pumpAndSettle();
}

void usePhoneScreen(WidgetTester tester) {
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
}

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  // Cada prueba que cambie el idioma vuelve a dejar el español.
  tearDown(() => AppLanguageController());

  group('crear documentos desde cero', () {
    FakeServer server({Map<String, dynamic> fieldStates = const {}, List<String> allowedTypes = const []}) => FakeServer({
      'GET /auth/me': (_) => FakeServer.json({
        'firstName': 'Ana',
        'permissions': ['document:read', 'document:create', 'document:update'],
        'customization': {'allowedDocumentTypeIds': allowedTypes},
      }),
      'GET /component-permissions/me': (_) => FakeServer.json(fieldStates),
      'GET /document-types': (_) => FakeServer.json(page([
        {'id': 't1', 'name': 'Acta', 'code': 'ACT'},
        {'id': 't2', 'name': 'Contrato', 'code': 'CON'},
      ])),
      'GET /departments': (_) => FakeServer.json(page([])),
      'GET /documents/specialties': (_) => FakeServer.json([]),
      'GET /documents/processes': (_) => FakeServer.json([]),
      'POST /documents': (request) => FakeServer.json({...bodyOf(request), 'id': 'doc-9', 'code': bodyOf(request)['code'] ?? 'AUTO-1', 'status': 'DRAFT'}, 201),
      'GET /documents/doc-9': (_) => http.Response.bytes(
        utf8.encode(jsonEncode({'id': 'doc-9', 'name': 'Acta de reunión', 'status': 'DRAFT'})), 200,
        headers: {'content-type': 'application/json', 'etag': '"0"'},
      ),
      'POST /documents/doc-9/versions': (_) => FakeServer.json({'id': 'v1', 'versionNumber': 1}, 201),
    });

    testWidgets('solo ofrece los tipos permitidos, crea el documento y sube el archivo inicial como v1', (tester) async {
      usePhoneScreen(tester);
      signedIn();
      final fake = server(allowedTypes: ['t1']);
      final api = AuthApi(client: fake.client);
      final file = File('${Directory.systemTemp.createTempSync('nexodocs').path}/acta.pdf')..writeAsBytesSync(utf8.encode('%PDF-1.4'));
      Future<PickedUpload?> picker(UploadOrigin origin) async => PickedUpload(path: file.path, name: 'acta.pdf', sizeBytes: file.lengthSync());

      await tester.pumpWidget(MaterialApp(theme: AppTheme.lightTheme, home: Launcher(CreateDocumentPage(api: api, picker: picker))));
      await tester.tap(find.byKey(const Key('launch')));
      await tester.pumpAndSettle();

      // Con un único tipo permitido queda seleccionado; el otro no se ofrece.
      expect(find.text('Acta · ACT'), findsOneWidget);
      expect(find.text('Contrato · CON'), findsNothing);

      await tester.enterText(find.byKey(const Key('doc-name')), 'Acta de reunión');
      await tester.enterText(find.byKey(const Key('doc-code')), 'DOC-77');
      await reveal(tester, find.byKey(const Key('doc-origin-file')));
      await tester.tap(find.byKey(const Key('doc-origin-file')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('doc-initial-file')), findsOneWidget);

      await reveal(tester, find.byKey(const Key('doc-create-submit')));
      await tester.tap(find.byKey(const Key('doc-create-submit')));
      await tester.pumpAndSettle();

      final create = fake.called('POST', '/documents').single;
      expect(bodyOf(create), {'documentTypeId': 't1', 'name': 'Acta de reunión', 'code': 'DOC-77'});
      final upload = fake.called('POST', '/documents/doc-9/versions').single;
      expect(upload.headers['content-type'], startsWith('multipart/form-data'));
      expect(utf8.decode(upload.bodyBytes, allowMalformed: true), contains(CreateDocumentPage.initialVersionReason));

      final launcher = tester.state<LauncherState>(find.byType(Launcher));
      expect((launcher.result as Map)['id'], 'doc-9');
      expect(find.text('Documento DOC-77 y versión inicial v1 almacenados con éxito.'), findsOneWidget);
    });

    testWidgets('exige nombre y código y respeta los campos de solo lectura u ocultos', (tester) async {
      usePhoneScreen(tester);
      signedIn();
      final fake = server(fieldStates: {'codigo': 'VISIBLE_READONLY', 'descripcion': 'HIDDEN'});
      final api = AuthApi(client: fake.client);
      await tester.pumpWidget(MaterialApp(theme: AppTheme.lightTheme, home: Launcher(CreateDocumentPage(api: api))));
      await tester.tap(find.byKey(const Key('launch')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('doc-description')), findsNothing);
      expect(find.text('Código institucional (lo asigna el sistema)'), findsOneWidget);

      await reveal(tester, find.byKey(const Key('doc-create-submit')));
      await tester.tap(find.byKey(const Key('doc-create-submit')));
      await tester.pumpAndSettle();
      expect(fake.called('POST', '/documents'), isEmpty);

      await reveal(tester, find.byKey(const Key('doc-name')), up: true);
      await tester.enterText(find.byKey(const Key('doc-name')), 'Informe');
      await tester.tap(find.byKey(const Key('doc-type')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Contrato · CON').last);
      await tester.pumpAndSettle();
      await reveal(tester, find.byKey(const Key('doc-create-submit')));
      await tester.tap(find.byKey(const Key('doc-create-submit')));
      await tester.pumpAndSettle();

      // El código no se envía: lo asigna el servidor.
      expect(bodyOf(fake.called('POST', '/documents').single), {'documentTypeId': 't2', 'name': 'Informe'});
    });
  });

  group('expedientes', () {
    testWidgets('lista, abre la ficha con sus documentos y cierra el expediente', (tester) async {
      usePhoneScreen(tester);
      signedIn();
      var status = 'ACTIVE';
      Map<String, dynamic> expedient() => {'id': 'e1', 'code': 'EXP-1', 'name': 'Contratos 2026', 'status': status, 'createdAt': '2026-11-01T10:00:00Z'};
      final fake = FakeServer({
        'GET /expedients': (_) => FakeServer.json(page([expedient()])),
        'GET /expedients/e1': (_) => FakeServer.json(expedient()),
        'GET /documents': (_) => FakeServer.json(page([
          {'id': 'd1', 'name': 'Contrato marco', 'code': 'DOC-1', 'status': 'APPROVED', 'expedientId': 'e1'},
          {'id': 'd2', 'name': 'Otro documento', 'code': 'DOC-2', 'status': 'DRAFT', 'expedientId': 'e2'},
        ])),
        'PATCH /expedients/e1/close': (_) {
          status = 'CLOSED';
          return FakeServer.json(expedient());
        },
      });
      final api = apiWith(fake, ['expedient:read', 'expedient:update', 'document:read']);
      await tester.pumpWidget(MaterialApp(theme: AppTheme.lightTheme, home: Scaffold(body: ExpedientsView(api: api))));
      await tester.pumpAndSettle();

      expect(find.text('Contratos 2026'), findsOneWidget);
      expect(find.byKey(const Key('expedient-create')), findsNothing, reason: 'sin expedient:create');
      await tester.tap(find.byKey(const Key('expedient-e1')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('expedient-doc-d1')), findsOneWidget);
      expect(find.byKey(const Key('expedient-doc-d2')), findsNothing);
      expect(find.text('Documentos del expediente (1)'), findsOneWidget);

      await tester.tap(find.byKey(const Key('expedient-close')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Confirmar'));
      await tester.pumpAndSettle();

      expect(fake.called('PATCH', '/expedients/e1/close'), hasLength(1));
      expect(find.byKey(const Key('expedient-archive')), findsOneWidget);
      expect(find.byKey(const Key('expedient-reopen')), findsOneWidget);
    });

    testWidgets('con documentos y expedientes la pestaña ofrece ambas secciones', (tester) async {
      signedIn();
      final fake = FakeServer({
        'GET /documents': (_) => FakeServer.json(page([])),
        'GET /expedients': (_) => FakeServer.json(page([])),
      });
      final api = apiWith(fake, ['document:read', 'expedient:read']);
      await tester.pumpWidget(MaterialApp(theme: AppTheme.lightTheme, home: Scaffold(body: RepositoryTab(api: api))));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('repository-sections')), findsOneWidget);
      expect(fake.called('GET', '/expedients'), isEmpty);
      await tester.tap(find.text('Expedientes'));
      await tester.pumpAndSettle();
      expect(fake.called('GET', '/expedients'), hasLength(1));
      expect(find.text('No se encontraron expedientes.'), findsOneWidget);
    });
  });

  group('módulo clínico', () {
    testWidgets('abre la historia clínica, registra alergias y emite una nota en borrador', (tester) async {
      usePhoneScreen(tester);
      signedIn();
      Map<String, dynamic>? history;
      var noteStatus = 'DRAFT';
      final fake = FakeServer({
        'GET /patients/p1': (_) => FakeServer.json({'id': 'p1', 'firstName': 'Ana', 'lastName': 'Pérez', 'documentType': 'CI', 'documentNumber': '123', 'status': 'ACTIVE'}),
        'GET /patients/p1/quick-summary': (_) => FakeServer.json({'patientName': 'Ana Pérez', 'allergies': [], 'baseDiagnoses': [], 'recentNotes': []}),
        'GET /clinical-histories': (_) => FakeServer.json(page([?history])),
        'POST /clinical-histories': (request) {
          history = {...bodyOf(request), 'id': 'h1', 'code': 'HC-0001'};
          return FakeServer.json(history!, 201);
        },
        'GET /clinical-histories/h1/documents': (_) => FakeServer.json([]),
        'GET /clinical-histories/h1/timeline': (_) => FakeServer.json([]),
        'GET /medical-notes': (_) => FakeServer.json(page([
          {'id': 'n1', 'clinicalHistoryId': 'h1', 'noteType': 'EVOLUTION', 'content': '<p>Paciente estable</p>', 'status': noteStatus, 'createdAt': '2026-11-10T09:00:00Z'},
        ])),
        'PATCH /medical-notes/n1/status': (request) {
          noteStatus = bodyOf(request)['status'] as String;
          return FakeServer.json({'id': 'n1', 'status': noteStatus});
        },
      });
      final api = apiWith(fake, ['patient:read', 'patient:create', 'patient:update', 'medical_note:read', 'medical_note:update']);
      await tester.pumpWidget(MaterialApp(theme: AppTheme.lightTheme, home: PatientDetailPage(api: api, patientId: 'p1')));
      await tester.pumpAndSettle();

      expect(find.text('Ana Pérez'), findsWidgets);
      await tester.tap(find.text('Historia'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('history-open')));
      await tester.pumpAndSettle();

      await reveal(tester, find.byKey(const Key('history-pathological')));
      await tester.enterText(find.byKey(const Key('history-pathological')), 'Hipertensión');
      await reveal(tester, find.byKey(const Key('allergy-add')));
      await tester.tap(find.byKey(const Key('allergy-add')));
      await tester.pumpAndSettle();
      await tester.enterText(find.widgetWithText(TextFormField, 'Alérgeno *'), 'Penicilina');
      await reveal(tester, find.byKey(const Key('history-save')));
      await tester.tap(find.byKey(const Key('history-save')));
      await tester.pumpAndSettle();

      final created = bodyOf(fake.called('POST', '/clinical-histories').single);
      expect(created['patientId'], 'p1');
      expect(created['pathologicalAntecedents'], 'Hipertensión');
      expect(created['allergies'], [
        {'allergen': 'Penicilina', 'severity': 'LOW', 'reaction': ''},
      ]);

      await tester.tap(find.text('Notas'));
      await tester.pumpAndSettle();
      expect(find.text('Paciente estable'), findsOneWidget);
      await tester.tap(find.byKey(const Key('note-approve-n1')));
      await tester.pumpAndSettle();

      // Emitir firma la nota y no se puede deshacer: primero pide confirmación.
      expect(find.text('Emitir nota médica'), findsOneWidget);
      expect(fake.called('PATCH', '/medical-notes/n1/status'), isEmpty);
      await tester.tap(find.byKey(const Key('note-approve-confirm')));
      await tester.pumpAndSettle();

      expect(bodyOf(fake.called('PATCH', '/medical-notes/n1/status').single), {'status': 'APPROVED'});
      expect(find.byKey(const Key('note-approve-n1')), findsNothing);
    });

    test('las notas se envían como HTML seguro y se muestran como texto', () {
      expect(toNoteHtml('Dolor <leve>\nsin fiebre\n\nPlan: reposo'), '<p>Dolor &lt;leve&gt;<br>sin fiebre</p><p>Plan: reposo</p>');
      expect(plainText('<p><strong>[PLAN]</strong></p>Reposo &amp; control'), '[PLAN]\nReposo & control');
    });
  });

  group('idiomas es/en', () {
    test('cada texto traducible de la app tiene su versión en inglés', () {
      final literal = RegExp(r"\btr\(\s*'((?:[^'\\]|\\.)*)'");
      final missing = <String>{};
      for (final file in Directory('lib').listSync(recursive: true).whereType<File>().where((f) => f.path.endsWith('.dart'))) {
        for (final match in literal.allMatches(file.readAsStringSync())) {
          final key = match.group(1)!.replaceAll(r"\'", "'");
          if (!englishTranslations.containsKey(key)) missing.add(key);
        }
      }
      expect(missing, isEmpty);
    });

    test('ningún Text, labelText, hintText o tooltip de lib/screens muestra texto en español sin tr()', () {
      // Se permiten literales sin letras (separadores, datos), códigos en mayúsculas (ACTIVE, CC) y nombres de marca.
      final visible = RegExp(
        r"""(?:\bText\(\s*(?:const\s+)?|\b(?:labelText|hintText|tooltip|helperText|errorText)\s*:\s*(?:const\s+)?)'((?:[^'\\\n]|\\.)*)'""",
      );
      final letters = RegExp(r'[A-Za-zÁÉÍÓÚáéíóúñÑ]{2,}');
      final offenders = <String>[];
      for (final file in Directory('lib/screens').listSync(recursive: true).whereType<File>().where((f) => f.path.endsWith('.dart'))) {
        final lines = file.readAsStringSync().split('\n');
        for (var i = 0; i < lines.length; i++) {
          for (final match in visible.allMatches(lines[i])) {
            final text = match.group(1)!;
            final words = text.replaceAll(RegExp(r'\$\{[^}]*\}|\$\w+'), '').trim();
            if (text.contains('tr(') || RegExp(r'\$\{[^}]*$').hasMatch(text)) continue; // ya traducido o con llaves anidadas
            if (!letters.hasMatch(words) || words == 'NexoDocs' || words == 'FinoCode') continue;
            if (RegExp(r'^[A-Z0-9_\-]+$').hasMatch(words)) continue;
            offenders.add('${file.path}:${i + 1}: $text');
          }
        }
      }
      expect(offenders, isEmpty, reason: 'Textos visibles sin tr():\n${offenders.join('\n')}');
    });

    test('traduce con parámetros y conserva el español si falta la clave', () {
      expect(translate('Documentos', AppLanguage.en), 'Documents');
      expect(translate('Versiones ({count})', AppLanguage.en, {'count': 3}), 'Versions (3)');
      expect(translate('Versiones ({count})', AppLanguage.es, {'count': 3}), 'Versiones (3)');
      expect(translate('Texto sin traducir', AppLanguage.en), 'Texto sin traducir');
    });

    testWidgets('en inglés el shell muestra las pestañas traducidas', (tester) async {
      signedIn();
      final fake = FakeServer({
        'GET /auth/me': (_) => FakeServer.json({'firstName': 'Ana', 'permissions': ['document:read']}),
        'GET /documents': (_) => FakeServer.json(page([])),
      });
      final language = AppLanguageController(AppLanguage.en);
      await tester.pumpWidget(AppLanguageScope(
        controller: language,
        child: MaterialApp(theme: AppTheme.lightTheme, home: MainShellPage(api: AuthApi(client: fake.client))),
      ));
      await tester.pumpAndSettle();

      for (final label in ['Home', 'Documents', 'Profile']) {
        expect(find.text(label), findsWidgets);
      }
      expect(find.text('Inicio'), findsNothing);
    });

    test('el idioma se envía al servidor en Accept-Language', () async {
      signedIn();
      final fake = FakeServer({'GET /documents': (_) => FakeServer.json(page([]))});
      final api = AuthApi(client: fake.client);
      AppLanguageController(AppLanguage.en);
      await api.documents.list();
      expect(fake.requests.single.headers['Accept-Language'], 'en');
    });
  });
}
