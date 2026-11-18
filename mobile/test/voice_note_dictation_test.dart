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
import 'package:nexodocs_mobile/core/theme/app_theme.dart';
import 'package:nexodocs_mobile/core/voice/voice_recorder.dart';
import 'package:nexodocs_mobile/screens/patients/patients_tab.dart';
import 'package:nexodocs_mobile/screens/patients/voice_note_sheet.dart';

/// Servidor simulado (mismo contrato que el de las demás pruebas): cada ruta responde con un handler.
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

  /// Peticiones a una ruta, en orden.
  List<http.Request> call(String key) => requests.where((r) => '${r.method} ${r.url.path.replaceFirst('/api/v1', '')}' == key).toList();

  static http.Response json(Object body, [int status = 200]) =>
      http.Response.bytes(utf8.encode(jsonEncode(body)), status, headers: {'content-type': 'application/json'});
}

Map<String, dynamic> page(List<Map<String, dynamic>> items) => {'content': items, 'totalElements': items.length, 'number': 0, 'size': 30};

/// Grabador simulado: no toca el micrófono y devuelve un archivo temporal real.
class FakeVoiceRecorder implements VoiceRecorder {
  FakeVoiceRecorder({this.granted = true, required this.audioPath});

  final bool granted;
  final String audioPath;
  int starts = 0;
  int cancels = 0;

  @override
  Future<bool> requestPermission() async => granted;

  @override
  Future<void> start() async => starts++;

  @override
  Future<String?> stop() async => audioPath;

  @override
  Future<void> cancel() async {
    cancels++;
    deleteTemporaryAudio(audioPath);
  }

  @override
  Future<void> dispose() async {}
}

late Directory tempDir;

String newAudioFile() {
  final file = File('${tempDir.path}${Platform.pathSeparator}voice_${DateTime.now().microsecondsSinceEpoch}.m4a')
    ..writeAsBytesSync([0, 1, 2, 3, 4, 5]);
  return file.path;
}

Map<String, dynamic> draftJson({String noteType = 'PRESCRIPTION'}) => {
      'transcript': 'Paciente alérgico a la penicilina, continúa con metformina.',
      'noteType': noteType,
      'subjective': 'Refiere mejoría.',
      'objective': '',
      'assessment': 'Diabetes controlada.',
      'plan': 'Mantener metformina.',
      'warnings': [
        {'type': 'ALLERGY', 'term': 'Penicilina'},
        {'type': 'MEDICATION', 'term': 'Metformina'},
      ],
    };

void usePhoneScreen(WidgetTester tester) {
  tester.view.physicalSize = const Size(800, 1600);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
}

Widget hostSheet(VoiceNoteSheet sheet) => MaterialApp(
      theme: AppTheme.lightTheme,
      home: Scaffold(body: Builder(builder: (context) {
        return Center(
          child: FilledButton(
            key: const Key('open'),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => sheet)),
            child: const Text('abrir'),
          ),
        );
      })),
    );

void main() {
  setUp(() {
    FlutterSecureStorage.setMockInitialValues({ApiClient.accessTokenKey: 't', ApiClient.refreshTokenKey: 'r'});
    tempDir = Directory.systemTemp.createTempSync('nexodocs_voice_test');
  });

  tearDown(() {
    voiceRecorderFactory = () => DeviceVoiceRecorder();
    if (tempDir.existsSync()) tempDir.deleteSync(recursive: true);
  });

  group('hoja de grabación del dictado', () {
    testWidgets('si se niega el micrófono muestra cómo activarlo en Ajustes y no graba', (tester) async {
      usePhoneScreen(tester);
      final server = FakeServer({});
      final api = AuthApi(client: server.client)..permissions.value = UserPermissions({'medical_note:create'});
      final recorder = FakeVoiceRecorder(granted: false, audioPath: newAudioFile());

      await tester.pumpWidget(hostSheet(VoiceNoteSheet(
        api: api,
        historyId: 'history-1',
        recorderFactory: () => recorder,
        maxDuration: voiceNoteMaxDuration,
      )));
      await tester.tap(find.byKey(const Key('open')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('voice-permission-denied')), findsOneWidget);
      expect(find.textContaining('Ajustes del teléfono'), findsOneWidget);
      expect(recorder.starts, 0);
    });

    testWidgets('graba con contador, se detiene por botón y el borrador se devuelve', (tester) async {
      usePhoneScreen(tester);
      final audio = newAudioFile();
      final server = FakeServer({
        'POST /medical-notes/ai-draft': (_) => FakeServer.json(draftJson()),
      });
      final api = AuthApi(client: server.client)..permissions.value = UserPermissions({'medical_note:create'});
      final recorder = FakeVoiceRecorder(audioPath: audio);
      VoiceNoteResult? result;

      await tester.pumpWidget(MaterialApp(
        theme: AppTheme.lightTheme,
        home: Scaffold(body: Builder(builder: (context) => FilledButton(
          key: const Key('open'),
          onPressed: () async {
            result = await showVoiceNoteSheet(context, api, 'history-1', recorder: () => recorder);
          },
          child: const Text('abrir'),
        ))),
      ));
      await tester.tap(find.byKey(const Key('open')));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      expect(recorder.starts, 1);
      expect(find.byKey(const Key('voice-timer')), findsOneWidget);
      expect(find.byKey(const Key('voice-stop')), findsOneWidget);
      expect(find.byKey(const Key('voice-cancel')), findsOneWidget);
      expect(find.text('00:00'), findsOneWidget);

      await tester.pump(const Duration(seconds: 3));
      expect(find.text('00:03'), findsOneWidget);

      await tester.tap(find.byKey(const Key('voice-stop')));
      await tester.pumpAndSettle();

      final requests = server.call('POST /medical-notes/ai-draft');
      expect(requests, hasLength(1));
      // Multipart: campo clinicalHistoryId y parte "audio" enviada con el mismo historial.
      expect(requests.single.body, contains('name="clinicalHistoryId"'));
      expect(requests.single.body, contains('history-1'));
      expect(requests.single.body, contains('name="audio"'));
      // Formato WAV: el MIME enviado debe ser audio/wav (Gemini AI Studio lo admite).
      expect(requests.single.body, contains('audio/wav'));
      expect(requests.single.body, isNot(contains('audio/m4a')));
      expect(result?.draft?['noteType'], 'PRESCRIPTION');
      expect(result?.manual, isFalse);
      // El archivo temporal se borra tras el envío exitoso.
      expect(File(audio).existsSync(), isFalse);
    });

    testWidgets('el límite de 5 minutos detiene la grabación automáticamente', (tester) async {
      usePhoneScreen(tester);
      final server = FakeServer({
        'POST /medical-notes/ai-draft': (_) => FakeServer.json(draftJson()),
      });
      final api = AuthApi(client: server.client)..permissions.value = UserPermissions({'medical_note:create'});
      final recorder = FakeVoiceRecorder(audioPath: newAudioFile());

      await tester.pumpWidget(hostSheet(VoiceNoteSheet(
        api: api,
        historyId: 'history-1',
        recorderFactory: () => recorder,
        maxDuration: const Duration(seconds: 2),
      )));
      await tester.tap(find.byKey(const Key('open')));
      await tester.pump();
      await tester.pump(const Duration(seconds: 2));
      await tester.pumpAndSettle();

      expect(server.call('POST /medical-notes/ai-draft'), hasLength(1));
    });

    testWidgets('error de IA conserva el audio y permite reintentar', (tester) async {
      usePhoneScreen(tester);
      final audio = newAudioFile();
      var attempts = 0;
      final server = FakeServer({
        'POST /medical-notes/ai-draft': (_) {
          attempts++;
          if (attempts == 1) return FakeServer.json({'message': 'La IA no pudo procesar el audio.'}, 502);
          return FakeServer.json(draftJson());
        },
      });
      final api = AuthApi(client: server.client)..permissions.value = UserPermissions({'medical_note:create'});
      final recorder = FakeVoiceRecorder(audioPath: audio);

      await tester.pumpWidget(hostSheet(VoiceNoteSheet(
        api: api,
        historyId: 'history-1',
        recorderFactory: () => recorder,
        maxDuration: voiceNoteMaxDuration,
      )));
      await tester.tap(find.byKey(const Key('open')));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      await tester.tap(find.byKey(const Key('voice-stop')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('voice-error')), findsOneWidget);
      expect(find.text('La IA no pudo procesar el audio.'), findsOneWidget);
      expect(find.byKey(const Key('voice-manual')), findsOneWidget);
      // El audio no se pierde mientras el usuario decide.
      expect(File(audio).existsSync(), isTrue);

      await tester.tap(find.byKey(const Key('voice-retry')));
      await tester.pumpAndSettle();

      expect(attempts, 2);
      expect(File(audio).existsSync(), isFalse);
    });

    testWidgets('escribir a mano tras el error borra el audio y no envía nada más', (tester) async {
      usePhoneScreen(tester);
      final audio = newAudioFile();
      final server = FakeServer({
        'POST /medical-notes/ai-draft': (_) => FakeServer.json({'message': 'Sin conexión'}, 503),
      });
      final api = AuthApi(client: server.client)..permissions.value = UserPermissions({'medical_note:create'});
      final recorder = FakeVoiceRecorder(audioPath: audio);

      await tester.pumpWidget(hostSheet(VoiceNoteSheet(
        api: api,
        historyId: 'history-1',
        recorderFactory: () => recorder,
        maxDuration: voiceNoteMaxDuration,
      )));
      await tester.tap(find.byKey(const Key('open')));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      await tester.tap(find.byKey(const Key('voice-stop')));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('voice-manual')));
      await tester.pumpAndSettle();

      expect(File(audio).existsSync(), isFalse);
      expect(server.call('POST /medical-notes/ai-draft'), hasLength(1));
    });

    testWidgets('cancelar durante la grabación borra el archivo y no llama a la IA', (tester) async {
      usePhoneScreen(tester);
      final audio = newAudioFile();
      final server = FakeServer({});
      final api = AuthApi(client: server.client)..permissions.value = UserPermissions({'medical_note:create'});
      final recorder = FakeVoiceRecorder(audioPath: audio);

      await tester.pumpWidget(hostSheet(VoiceNoteSheet(
        api: api,
        historyId: 'history-1',
        recorderFactory: () => recorder,
        maxDuration: voiceNoteMaxDuration,
      )));
      await tester.tap(find.byKey(const Key('open')));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      await tester.tap(find.byKey(const Key('voice-cancel')));
      await tester.pumpAndSettle();

      expect(recorder.cancels, 1);
      expect(File(audio).existsSync(), isFalse);
      expect(server.call('POST /medical-notes/ai-draft'), isEmpty);
    });
  });

  group('dictado desde la ficha clínica', () {
    testWidgets('flujo completo: dicta, precarga la nota con avisos y guarda el borrador', (tester) async {
      usePhoneScreen(tester);
      final audio = newAudioFile();
      voiceRecorderFactory = () => FakeVoiceRecorder(audioPath: audio);

      final server = FakeServer({
        'GET /patients': (_) => FakeServer.json(page([
              {'id': 'pat-100', 'name': 'Beatriz Morales', 'documentId': '43210987', 'bloodType': 'A+'},
            ])),
        'GET /clinical-histories': (_) => FakeServer.json(page([
              {
                'id': 'history-100',
                'code': 'HC-00100',
                'patientId': 'pat-100',
                'patientLabel': 'Beatriz Morales',
                'bloodType': 'A+',
                'allergies': [
                  {'allergen': 'Penicilina', 'severity': 'ALTA', 'reaction': 'urticaria'},
                ],
                'currentMedications': [
                  {'name': 'Metformina', 'dose': '850 mg', 'frequency': 'cada 12 h'},
                ],
                'baseDiagnoses': [],
              }
            ])),
        'GET /medical-notes': (_) => FakeServer.json(page([])),
        'POST /medical-notes/ai-draft': (_) => FakeServer.json(draftJson()),
        'POST /medical-notes': (_) => FakeServer.json({'id': 'note-1', 'status': 'DRAFT'}, 201),
      });

      final authApi = AuthApi(client: server.client)
        ..permissions.value = UserPermissions({'patient:read', 'medical_note:create', 'medical_note:read'});

      await tester.pumpWidget(MaterialApp(
        theme: AppTheme.lightTheme,
        home: Scaffold(body: PatientsTab(api: authApi)),
      ));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('patient-history-pat-100')));
      await tester.pumpAndSettle();
      // Los botones de nota viven en la pestaña Evolución.
      await tester.tap(find.text('Evolución'));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('clinical-dictate-note')));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      expect(find.byKey(const Key('voice-timer')), findsOneWidget);

      await tester.tap(find.byKey(const Key('voice-stop')));
      await tester.pumpAndSettle();

      // Formulario precargado con el borrador y avisos destacados.
      expect(find.byKey(const Key('note-warnings')), findsOneWidget);
      expect(find.byKey(const Key('note-warning-ALLERGY-Penicilina')), findsOneWidget);
      expect(find.text('Posible alergia registrada: Penicilina'), findsOneWidget);
      expect(find.text('Posible medicamento actual: Metformina'), findsOneWidget);
      expect(find.byKey(const Key('note-ai-hint')), findsOneWidget);
      final content = tester.widget<TextField>(find.byKey(const Key('note-content')));
      expect(content.controller?.text, contains('Subjetivo:\nRefiere mejoría.'));
      expect(content.controller?.text, contains('Plan:\nMantener metformina.'));
      expect(content.controller?.text, isNot(contains('Objetivo:')));
      // Nada se guarda sin confirmación del médico.
      expect(server.call('POST /medical-notes'), isEmpty);
      expect(File(audio).existsSync(), isFalse);

      await tester.tap(find.byKey(const Key('note-save')));
      await tester.pumpAndSettle();

      final saved = server.call('POST /medical-notes');
      expect(saved, hasLength(1));
      final body = jsonDecode(saved.single.body) as Map<String, dynamic>;
      expect(body['clinicalHistoryId'], 'history-100');
      expect(body['noteType'], 'PRESCRIPTION');
      expect(body['status'], 'DRAFT');
      expect(body['content'], contains('Subjetivo'));
      expect(body['content'], contains('Refiere mejoría.'));
    });

    testWidgets('firmar y emitir crea en borrador y emite con PATCH, como exige el backend', (tester) async {
      usePhoneScreen(tester);
      final server = FakeServer({
        'GET /patients': (_) => FakeServer.json(page([
              {'id': 'pat-100', 'name': 'Beatriz Morales', 'documentId': '43210987'},
            ])),
        'GET /clinical-histories': (_) => FakeServer.json(page([
              {'id': 'history-100', 'code': 'HC-00100', 'patientId': 'pat-100', 'patientLabel': 'Beatriz Morales', 'allergies': [], 'currentMedications': [], 'baseDiagnoses': []},
            ])),
        'GET /medical-notes': (_) => FakeServer.json(page([])),
        // El backend rechaza crear una nota que no sea BORRADOR (MedicalNoteService.create).
        'POST /medical-notes': (request) {
          final body = jsonDecode(request.body) as Map<String, dynamic>;
          if (body['status'] != 'DRAFT') {
            return FakeServer.json({'message': 'Toda nota médica debe crearse como BORRADOR'}, 400);
          }
          return FakeServer.json({'id': 'n-new', 'clinicalHistoryId': 'history-100', 'noteType': 'EVOLUTION', 'status': 'DRAFT', 'content': body['content']}, 201);
        },
        'PATCH /medical-notes/n-new/status': (_) => FakeServer.json({'id': 'n-new', 'status': 'APPROVED'}),
      });
      final authApi = AuthApi(client: server.client)
        ..permissions.value = UserPermissions({'patient:read', 'medical_note:read', 'medical_note:create', 'medical_note:update'});

      await tester.pumpWidget(MaterialApp(theme: AppTheme.lightTheme, home: Scaffold(body: PatientsTab(api: authApi))));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('patient-history-pat-100')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Evolución'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('clinical-new-note')));
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('note-content')), 'Paciente estable');
      await tester.ensureVisible(find.byKey(const Key('note-sign')));
      await tester.tap(find.byKey(const Key('note-sign')));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byKey(const Key('note-save')));
      await tester.tap(find.byKey(const Key('note-save')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('note-approve-confirm')));
      await tester.pumpAndSettle();

      final created = server.call('POST /medical-notes');
      expect(created, hasLength(1));
      expect((jsonDecode(created.single.body) as Map<String, dynamic>)['status'], 'DRAFT');
      final emitted = server.call('PATCH /medical-notes/n-new/status');
      expect(emitted, hasLength(1));
      expect(jsonDecode(emitted.single.body), {'status': 'APPROVED'});
      expect(find.byKey(const Key('note-error')), findsNothing);
    });

    testWidgets('el botón de dictado no aparece sin medical_note:create', (tester) async {
      usePhoneScreen(tester);
      final server = FakeServer({
        'GET /patients': (_) => FakeServer.json(page([
              {'id': 'pat-100', 'name': 'Beatriz Morales', 'documentId': '43210987', 'bloodType': 'A+'},
            ])),
        'GET /clinical-histories': (_) => FakeServer.json(page([
              {'id': 'history-100', 'code': 'HC-00100', 'patientId': 'pat-100', 'patientLabel': 'Beatriz Morales', 'bloodType': 'A+', 'allergies': [], 'currentMedications': [], 'baseDiagnoses': []},
            ])),
        'GET /medical-notes': (_) => FakeServer.json(page([])),
      });
      final authApi = AuthApi(client: server.client)..permissions.value = UserPermissions({'patient:read', 'medical_note:read'});

      await tester.pumpWidget(MaterialApp(
        theme: AppTheme.lightTheme,
        home: Scaffold(body: PatientsTab(api: authApi)),
      ));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('patient-history-pat-100')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Evolución'));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('clinical-new-note')), findsNothing);
      expect(find.byKey(const Key('clinical-dictate-note')), findsNothing);
    });

    testWidgets('con medical_note:create se muestran Dictar nota y Nueva nota médica', (tester) async {
      usePhoneScreen(tester);
      final server = FakeServer({
        'GET /patients': (_) => FakeServer.json(page([
              {'id': 'pat-100', 'name': 'Beatriz Morales', 'documentId': '43210987', 'bloodType': 'A+'},
            ])),
        'GET /clinical-histories': (_) => FakeServer.json(page([
              {'id': 'history-100', 'code': 'HC-00100', 'patientId': 'pat-100', 'patientLabel': 'Beatriz Morales', 'bloodType': 'A+', 'allergies': [], 'currentMedications': [], 'baseDiagnoses': []},
            ])),
        'GET /medical-notes': (_) => FakeServer.json(page([])),
      });
      final authApi = AuthApi(client: server.client)..permissions.value = UserPermissions({'patient:read', 'medical_note:create'});

      await tester.pumpWidget(MaterialApp(
        theme: AppTheme.lightTheme,
        home: Scaffold(body: PatientsTab(api: authApi)),
      ));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('patient-history-pat-100')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Evolución'));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('clinical-new-note')), findsOneWidget);
      expect(find.byKey(const Key('clinical-dictate-note')), findsOneWidget);
    });

    testWidgets('la historia muestra severidad, tipo y estado de nota en español, no los códigos', (tester) async {
      usePhoneScreen(tester);
      final server = FakeServer({
        'GET /patients': (_) => FakeServer.json(page([
              {'id': 'pat-100', 'name': 'Beatriz Morales', 'documentId': '43210987'},
            ])),
        'GET /clinical-histories': (_) => FakeServer.json(page([
              {
                'id': 'history-100', 'code': 'HC-00100', 'patientId': 'pat-100', 'patientLabel': 'Beatriz Morales',
                'allergies': [
                  {'allergen': 'Penicilina', 'severity': 'HIGH', 'reaction': ''},
                ],
                'currentMedications': [], 'baseDiagnoses': [],
              },
            ])),
        'GET /medical-notes': (_) => FakeServer.json(page([
              {
                'id': 'n1', 'clinicalHistoryId': 'history-100', 'noteType': 'EVOLUTION', 'status': 'DRAFT',
                'content': '<p>Paciente estable</p>', 'createdAt': '2026-11-17T23:42:00Z',
              },
            ])),
      });
      final authApi = AuthApi(client: server.client)..permissions.value = UserPermissions({'patient:read', 'medical_note:read'});

      await tester.pumpWidget(MaterialApp(theme: AppTheme.lightTheme, home: Scaffold(body: PatientsTab(api: authApi))));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('patient-history-pat-100')));
      await tester.pumpAndSettle();

      expect(find.text('Penicilina (Alta (grave))'), findsOneWidget);
      expect(find.text('Penicilina (HIGH)'), findsNothing);
      // HIGH es grave: el chip se pinta en rojo, como las alergias graves de la web.
      final chip = tester.widget<Chip>(find.ancestor(of: find.text('Penicilina (Alta (grave))'), matching: find.byType(Chip)));
      expect(chip.backgroundColor, Colors.red.shade50);

      await tester.tap(find.text('Evolución'));
      await tester.pumpAndSettle();
      expect(find.text('Nota de evolución'), findsOneWidget);
      expect(find.text('Borrador'), findsOneWidget);
      expect(find.text('EVOLUTION'), findsNothing);
    });
  });
}
