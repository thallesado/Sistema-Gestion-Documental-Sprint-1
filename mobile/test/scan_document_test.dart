import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nexodocs_mobile/core/api/api_client.dart';
import 'package:nexodocs_mobile/core/api/auth_api.dart';
import 'package:nexodocs_mobile/core/auth/user_permissions.dart';
import 'package:nexodocs_mobile/screens/scan/scan_document_page.dart';

class FakeServer {
  FakeServer(this.routes);

  final Map<String, http.Response Function(http.Request request)> routes;
  final requests = <http.BaseRequest>[];

  late final client = MockClient((request) async {
    requests.add(request);
    final path = request.url.path.replaceFirst('/api/v1', '');
    final key = '${request.method} $path';
    final handler = routes[key];
    if (handler != null) return handler(request);

    // Búsqueda por prefijo
    for (final entry in routes.entries) {
      final parts = entry.key.split(' ');
      if (parts[0] == request.method && path.startsWith(parts[1])) {
        return entry.value(request);
      }
    }

    return http.Response('{"message":"Ruta no simulada: $path"}', 404);
  });

  static http.Response json(Object body, [int status = 200]) => http.Response.bytes(
        utf8.encode(jsonEncode(body)),
        status,
        headers: {'content-type': 'application/json'},
      );
}

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({
        ApiClient.accessTokenKey: 'test-token',
        ApiClient.refreshTokenKey: 'test-refresh',
      }));

  group('OcrApi Client', () {
    test('recentJobs procesa la lista devuelta por /ocr/jobs', () async {
      final server = FakeServer({
        'GET /ocr/jobs': (_) => FakeServer.json([
              {
                'id': 'job-1',
                'status': 'REQUIRES_VALIDATION',
                'detectedType': 'FACTURA',
                'confidence': 0.88,
                'extractedData': {'total': 150.0},
              },
            ]),
      });

      final authApi = AuthApi(client: server.client);
      final jobs = await authApi.ocr.recentJobs();

      expect(jobs.length, 1);
      expect(jobs.first['id'], 'job-1');
      expect(jobs.first['status'], 'REQUIRES_VALIDATION');
      expect(jobs.first['confidence'], 0.88);
      expect(jobs.first['detectedType'], 'FACTURA');
    });

    test('validate, reject e index realizan llamadas REST correctas', () async {
      final server = FakeServer({
        'POST /ocr/jobs/job-1/validate': (_) => FakeServer.json({'id': 'job-1', 'status': 'VALIDATED'}),
        'POST /ocr/jobs/job-1/reject': (_) => FakeServer.json({'id': 'job-1', 'status': 'REJECTED'}),
        'POST /ocr/jobs/job-1/index': (_) => FakeServer.json({'id': 'job-1', 'status': 'INDEXED', 'documentId': 'doc-100'}),
      });

      final authApi = AuthApi(client: server.client);

      final validated = await authApi.ocr.validate('job-1');
      expect(validated['status'], 'VALIDATED');

      final rejected = await authApi.ocr.reject('job-1', reason: 'Texto ilegible');
      expect(rejected['status'], 'REJECTED');

      final indexed = await authApi.ocr.index('job-1', documentTypeId: 'dt-1', name: 'Factura Mayo');
      expect(indexed['status'], 'INDEXED');
      expect(indexed['documentId'], 'doc-100');
    });

    test('documentTypes obtiene los tipos de documento para el indexado', () async {
      final server = FakeServer({
        'GET /document-types': (_) => FakeServer.json({
              'content': [
                {'id': 'dt-1', 'name': 'Factura'},
                {'id': 'dt-2', 'name': 'Contrato'},
              ]
            }),
      });

      final authApi = AuthApi(client: server.client);
      final types = await authApi.ocr.documentTypes();

      expect(types.length, 2);
      expect(types.first['name'], 'Factura');
    });
  });

  group('ScanDocumentPage Widget', () {
    testWidgets('renderiza opciones de escaneo y permite alternar a historial', (tester) async {
      final server = FakeServer({
        'GET /ocr/jobs': (_) => FakeServer.json([
              {
                'id': 'job-hist-1',
                'status': 'REQUIRES_VALIDATION',
                'documentType': 'CONTRATO',
                'confidence': 0.72,
                'fileName': 'contrato.jpg',
                'createdAt': '2026-10-20T10:00:00Z',
              },
            ]),
        'GET /document-types': (_) => FakeServer.json({'content': []}),
      });

      final authApi = AuthApi(client: server.client)
        ..permissions.value = UserPermissions({
          Permissions.documentCreate,
          Permissions.ocrCreate,
          Permissions.ocrRead,
          Permissions.ocrUpdate,
        });

      await tester.pumpWidget(
        MaterialApp(
          home: ScanDocumentPage(api: authApi),
        ),
      );

      // Verificamos que se muestren los botones principales del prompt de escaneo
      expect(find.text('Digitalización con Cámara'), findsOneWidget);
      expect(find.text('Usar Cámara Nativa'), findsOneWidget);
      expect(find.text('Seleccionar de Galería'), findsOneWidget);
      expect(find.text('Historial Reciente'), findsOneWidget);

      // Cambiar a la pestaña de Historial
      await tester.tap(find.text('Historial Reciente'));
      await tester.pumpAndSettle();

      // Debería listar el trabajo del historial
      expect(find.text('CONTRATO'), findsOneWidget);
      expect(find.textContaining('contrato.jpg'), findsOneWidget);
    });

    testWidgets('muestra advertencia cuando la confianza es baja o tipo OTRO cargando job por id', (tester) async {
      final server = FakeServer({
        'GET /ocr/jobs/job-alert': (_) => FakeServer.json({
              'id': 'job-alert',
              'status': 'REQUIRES_VALIDATION',
              'documentType': 'OTRO',
              'confidence': 0.45,
              'fileName': 'doc_borroso.jpg',
              'extractedData': {
                'codigo': 'S/C',
                'observaciones': 'Baja resolución',
              },
            }),
        'GET /ocr/jobs': (_) => FakeServer.json([]),
        'GET /document-types': (_) => FakeServer.json({'content': []}),
      });

      final authApi = AuthApi(client: server.client)
        ..permissions.value = UserPermissions({
          Permissions.documentCreate,
          Permissions.ocrCreate,
          Permissions.ocrRead,
          Permissions.ocrUpdate,
        });

      await tester.pumpWidget(
        MaterialApp(
          home: ScanDocumentPage(
            api: authApi,
            initialJobId: 'job-alert',
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Debe mostrarse el banner de advertencia visual
      expect(find.text('Revisión humana requerida'), findsOneWidget);
      expect(find.textContaining('El tipo documental se identificó como "OTRO"'), findsOneWidget);
      expect(find.text('Validar'), findsOneWidget);
      expect(find.text('Rechazar'), findsOneWidget);
    });
  });
}
