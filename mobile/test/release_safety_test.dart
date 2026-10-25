import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nexodocs_mobile/screens/scan/scan_document_page.dart';

void main() {
  group('Manifiestos Android', () {
    test('el manifiesto principal (release) no permite tráfico sin cifrar', () {
      final main = File('android/app/src/main/AndroidManifest.xml').readAsStringSync();
      expect(main.contains('usesCleartextTraffic'), isFalse);
    });

    test('el manifiesto debug conserva http para servidores de desarrollo', () {
      final debug = File('android/app/src/debug/AndroidManifest.xml').readAsStringSync();
      expect(debug, contains('android:usesCleartextTraffic="true"'));
    });

    test('el manifiesto profile no permite tráfico sin cifrar', () {
      final profile = File('android/app/src/profile/AndroidManifest.xml').readAsStringSync();
      expect(profile.contains('usesCleartextTraffic'), isFalse);
    });
  });

  group('scanPickErrorMessage', () {
    test('permiso de cámara denegado explica cómo habilitarlo', () {
      final message = scanPickErrorMessage(PlatformException(code: 'camera_access_denied'));
      expect(message, contains('permiso de la cámara'));
      expect(message, contains('Ajustes'));
    });

    test('permiso de galería denegado explica cómo habilitarlo', () {
      final message = scanPickErrorMessage(PlatformException(code: 'photo_access_denied'));
      expect(message, contains('galería'));
    });

    test('otros errores no filtran detalles internos', () {
      final message = scanPickErrorMessage(Exception('stack interno'));
      expect(message, isNot(contains('stack interno')));
      expect(message, contains('No se pudo'));
    });
  });
}
