import 'dart:io';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

/// Grabador de dictado de voz detrás de una interfaz, para poder simularlo en pruebas
/// (mismo criterio que `UploadPicker` en las hojas de documentos).
abstract class VoiceRecorder {
  /// Pide el permiso de micrófono si aún no se concedió. `false` si el usuario lo negó.
  Future<bool> requestPermission();

  /// Empieza a grabar en un archivo temporal WAV (PCM 16 bits, 16 kHz, mono).
  Future<void> start();

  /// Detiene la grabación y devuelve la ruta del archivo temporal (o `null` si no había grabación).
  Future<String?> stop();

  /// Cancela la grabación y borra el archivo temporal.
  Future<void> cancel();

  Future<void> dispose();
}

typedef VoiceRecorderFactory = VoiceRecorder Function();

/// Implementación real con el paquete `record`. Graba WAV PCM 16 bits, 16 kHz, mono (`audio/wav`),
/// uno de los MIME que la API de Gemini (ai.google.dev) admite para audio. 5 minutos pesan ~9,6 MB.
class DeviceVoiceRecorder implements VoiceRecorder {
  final AudioRecorder _recorder = AudioRecorder();
  String? _path;

  @override
  Future<bool> requestPermission() => _recorder.hasPermission(request: true);

  @override
  Future<void> start() async {
    // En web no hay sistema de archivos: `record` ignora la ruta y devuelve una URL blob al detener.
    if (kIsWeb) {
      _path = 'voice_note_${DateTime.now().millisecondsSinceEpoch}.wav';
    } else {
      final dir = await getTemporaryDirectory();
      _path = '${dir.path}${Platform.pathSeparator}voice_note_${DateTime.now().millisecondsSinceEpoch}.wav';
    }
    await _recorder.start(
      const RecordConfig(encoder: AudioEncoder.wav, sampleRate: 16000, numChannels: 1),
      path: _path!,
    );
  }

  @override
  Future<String?> stop() async {
    final path = await _recorder.stop();
    return path ?? _path;
  }

  @override
  Future<void> cancel() async {
    await _recorder.cancel();
    deleteTemporaryAudio(_path);
    _path = null;
  }

  @override
  Future<void> dispose() => _recorder.dispose();
}

/// Borra un archivo temporal de audio. Silencioso si ya no existe.
void deleteTemporaryAudio(String? path) {
  // En web el audio es un blob en memoria del navegador: el recolector del navegador lo libera.
  if (path == null || kIsWeb) return;
  try {
    final file = File(path);
    if (file.existsSync()) file.deleteSync();
  } catch (_) {
    // Un fallo de borrado no debe romper el flujo; el archivo queda en la caché temporal del sistema.
  }
}
