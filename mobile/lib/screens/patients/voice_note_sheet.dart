import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api/auth_api.dart';
import '../../core/errors/api_exception.dart';
import '../../core/i18n/app_language.dart';
import '../../core/theme/app_theme.dart';
import '../../core/voice/voice_recorder.dart';

/// Duración máxima del dictado (criterio de aceptación de HU de dictado por voz).
const voiceNoteMaxDuration = Duration(minutes: 5);

/// Resultado de la hoja de dictado: un borrador de IA, o la decisión de escribir la nota a mano.
/// `null` (sin resultado) significa cancelado.
class VoiceNoteResult {
  const VoiceNoteResult.draft(Map<String, dynamic> this.draft) : manual = false;
  const VoiceNoteResult.manual() : draft = null, manual = true;

  final Map<String, dynamic>? draft;
  final bool manual;
}

/// Fábrica del grabador que usa la app. Las pruebas la sustituyen para no tocar el micrófono real.
VoiceRecorderFactory voiceRecorderFactory = () => DeviceVoiceRecorder();

/// Abre la hoja de grabación del dictado. Empieza a grabar al abrirse (tras el permiso de micrófono),
/// envía el audio a `POST /medical-notes/ai-draft` al detener y devuelve el borrador.
Future<VoiceNoteResult?> showVoiceNoteSheet(
  BuildContext context,
  AuthApi api,
  String historyId, {
  VoiceRecorderFactory? recorder,
  Duration maxDuration = voiceNoteMaxDuration,
}) =>
    showModalBottomSheet<VoiceNoteResult>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => VoiceNoteSheet(
        api: api,
        historyId: historyId,
        recorderFactory: recorder ?? voiceRecorderFactory,
        maxDuration: maxDuration,
      ),
    );

enum _VoicePhase { requesting, recording, analyzing, permissionDenied, error }

class VoiceNoteSheet extends StatefulWidget {
  const VoiceNoteSheet({
    super.key,
    required this.api,
    required this.historyId,
    required this.recorderFactory,
    required this.maxDuration,
  });

  final AuthApi api;
  final String historyId;
  final VoiceRecorderFactory recorderFactory;
  final Duration maxDuration;

  @override
  State<VoiceNoteSheet> createState() => _VoiceNoteSheetState();
}

class _VoiceNoteSheetState extends State<VoiceNoteSheet> {
  late final VoiceRecorder _recorder = widget.recorderFactory();
  _VoicePhase _phase = _VoicePhase.requesting;
  Timer? _ticker;
  int _seconds = 0;
  String? _audioPath;
  String? _error;
  /// La hoja ya se cerró por una decisión explícita (cancelar, escribir a mano o éxito).
  bool _closed = false;

  @override
  void initState() {
    super.initState();
    _begin();
  }

  @override
  void dispose() {
    _ticker?.cancel();
    // Si el usuario cierra la hoja arrastrándola mientras graba, no se conserva nada grabado.
    if (!_closed && _phase == _VoicePhase.recording) {
      unawaited(_recorder.cancel());
    }
    deleteTemporaryAudio(_audioPath);
    _audioPath = null;
    unawaited(_recorder.dispose());
    super.dispose();
  }

  Future<void> _begin() async {
    setState(() {
      _phase = _VoicePhase.requesting;
      _error = null;
    });
    final bool granted;
    try {
      granted = await _recorder.requestPermission();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _phase = _VoicePhase.error;
        _error = tr('No se pudo usar el micrófono.');
      });
      return;
    }
    if (!mounted) return;
    if (!granted) {
      setState(() => _phase = _VoicePhase.permissionDenied);
      return;
    }
    try {
      await _recorder.start();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _phase = _VoicePhase.error;
        _error = tr('No se pudo iniciar la grabación. Revisa el micrófono e inténtalo de nuevo.');
      });
      return;
    }
    if (!mounted) return;
    _seconds = 0;
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      _seconds++;
      if (_seconds >= widget.maxDuration.inSeconds) {
        unawaited(_stopAndAnalyze());
      } else {
        setState(() {});
      }
    });
    setState(() => _phase = _VoicePhase.recording);
  }

  /// Detiene la grabación (botón o límite de tiempo) y pide el borrador a la IA.
  Future<void> _stopAndAnalyze() async {
    if (_phase != _VoicePhase.recording) return;
    _ticker?.cancel();
    try {
      _audioPath = await _recorder.stop();
    } catch (_) {
      _audioPath = null;
    }
    if (!mounted) return;
    if (_audioPath == null) {
      setState(() {
        _phase = _VoicePhase.error;
        _error = tr('No se pudo guardar la grabación. Inténtalo de nuevo o escribe la nota a mano.');
      });
      return;
    }
    await _analyze();
  }

  /// Envía el audio conservado. Si falla, el archivo queda disponible para reintentar.
  Future<void> _analyze() async {
    setState(() {
      _phase = _VoicePhase.analyzing;
      _error = null;
    });
    try {
      final draft = await widget.api.clinical.aiDraft(
        historyId: widget.historyId,
        audioPath: _audioPath!,
        language: AppLanguageController.current.name,
      );
      deleteTemporaryAudio(_audioPath);
      _audioPath = null;
      _closed = true;
      if (!mounted) return;
      Navigator.of(context).pop(VoiceNoteResult.draft(draft));
    } on ApiException catch (exception) {
      if (!mounted) return;
      setState(() {
        _phase = _VoicePhase.error;
        _error = exception.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _phase = _VoicePhase.error;
        _error = tr('No hay conexión o la IA no respondió. Reintenta o escribe la nota a mano.');
      });
    }
  }

  Future<void> _cancel() async {
    _ticker?.cancel();
    _closed = true;
    if (_phase == _VoicePhase.recording) {
      try {
        await _recorder.cancel();
      } catch (_) {}
    }
    deleteTemporaryAudio(_audioPath);
    _audioPath = null;
    if (mounted) Navigator.of(context).pop();
  }

  void _writeManually() {
    _closed = true;
    deleteTemporaryAudio(_audioPath);
    _audioPath = null;
    Navigator.of(context).pop(const VoiceNoteResult.manual());
  }

  String _clock(int seconds) {
    final minutes = (seconds ~/ 60).toString().padLeft(2, '0');
    final rest = (seconds % 60).toString().padLeft(2, '0');
    return '$minutes:$rest';
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)))),
        const SizedBox(height: 16),
        Text(context.tr('Dictado de nota médica'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.ink)),
        const SizedBox(height: 24),
        ..._body(context),
      ],
    ),
  );

  List<Widget> _body(BuildContext context) => switch (_phase) {
    _VoicePhase.requesting => [
      const Center(child: CircularProgressIndicator()),
      const SizedBox(height: 12),
      Center(child: Text(context.tr('Solicitando permiso de micrófono…'))),
    ],
    _VoicePhase.recording => [
      Center(
        child: Text(
          _clock(_seconds),
          key: const Key('voice-timer'),
          style: const TextStyle(fontSize: 40, fontWeight: FontWeight.w600, color: AppTheme.ink, fontFeatures: [FontFeature.tabularFigures()]),
        ),
      ),
      const SizedBox(height: 4),
      Center(child: Text('${context.tr('Grabando dictado…')} · ${_clock(_seconds)} / ${_clock(widget.maxDuration.inSeconds)}', style: TextStyle(color: Colors.grey.shade700))),
      const SizedBox(height: 4),
      Center(child: Text(context.tr('Tiempo máximo de 5 minutos.'), style: TextStyle(fontSize: 12, color: Colors.grey.shade600))),
      const SizedBox(height: 24),
      Row(
        children: [
          Expanded(
            child: TextButton(
              key: const Key('voice-cancel'),
              onPressed: _cancel,
              child: Text(context.tr('Cancelar')),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: FilledButton.icon(
              key: const Key('voice-stop'),
              onPressed: _stopAndAnalyze,
              style: FilledButton.styleFrom(backgroundColor: AppTheme.teal, padding: const EdgeInsets.symmetric(vertical: 14)),
              icon: const Icon(Icons.stop_rounded),
              label: Text(context.tr('Detener')),
            ),
          ),
        ],
      ),
    ],
    _VoicePhase.analyzing => [
      const Center(child: CircularProgressIndicator(key: Key('voice-analyzing'))),
      const SizedBox(height: 12),
      Center(child: Text(context.tr('Analizando con IA…'), style: const TextStyle(fontWeight: FontWeight.w600))),
      const SizedBox(height: 4),
      Center(child: Text(context.tr('El audio se borra del teléfono al terminar.'), style: TextStyle(fontSize: 12, color: Colors.grey.shade600))),
    ],
    _VoicePhase.permissionDenied => [
      Text(
        context.tr('Permiso de micrófono denegado. Actívalo en Ajustes del teléfono para dictar la nota.'),
        key: const Key('voice-permission-denied'),
      ),
      const SizedBox(height: 16),
      Row(
        children: [
          Expanded(
            child: TextButton(
              key: const Key('voice-cancel'),
              onPressed: () => Navigator.of(context).pop(),
              child: Text(context.tr('Cerrar')),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: FilledButton(
              key: const Key('voice-retry'),
              onPressed: _begin,
              style: FilledButton.styleFrom(backgroundColor: AppTheme.teal),
              child: Text(context.tr('Reintentar')),
            ),
          ),
        ],
      ),
    ],
    _VoicePhase.error => [
      Text(_error ?? context.tr('No se pudo completar el dictado.'), key: const Key('voice-error'), style: TextStyle(color: Colors.red.shade700)),
      const SizedBox(height: 4),
      Text(
        context.tr('El audio no se ha perdido: puedes reintentar o escribir la nota a mano.'),
        style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
      ),
      const SizedBox(height: 16),
      FilledButton.icon(
        key: const Key('voice-retry'),
        onPressed: _audioPath != null ? _analyze : _begin,
        style: FilledButton.styleFrom(backgroundColor: AppTheme.teal, padding: const EdgeInsets.symmetric(vertical: 14)),
        icon: const Icon(Icons.refresh),
        label: Text(context.tr('Reintentar')),
      ),
      const SizedBox(height: 8),
      OutlinedButton.icon(
        key: const Key('voice-manual'),
        onPressed: _writeManually,
        icon: const Icon(Icons.edit_note),
        label: Text(context.tr('Escribir a mano')),
      ),
      TextButton(
        key: const Key('voice-cancel'),
        onPressed: _cancel,
        child: Text(context.tr('Cancelar')),
      ),
    ],
  };
}
