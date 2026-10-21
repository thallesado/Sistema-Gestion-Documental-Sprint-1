import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:local_auth/local_auth.dart';

/// Servicio de autenticación biométrica (huella dactilar / reconocimiento facial)
/// como segunda capacidad nativa del dispositivo (requisito de justificación móvil).
class BiometricService {
  BiometricService({LocalAuthentication? auth, FlutterSecureStorage? storage})
      : _auth = auth ?? LocalAuthentication(),
        _storage = storage ?? const FlutterSecureStorage();

  final LocalAuthentication _auth;
  final FlutterSecureStorage _storage;

  static const _prefKey = 'biometrics_enabled';

  /// Comprueba si el dispositivo tiene hardware biométrico y datos registrados.
  Future<bool> isAvailable() async {
    try {
      final canCheck = await _auth.canCheckBiometrics;
      final isSupported = await _auth.isDeviceSupported();
      return canCheck && isSupported;
    } on PlatformException catch (e) {
      debugPrint('Biometric check failed: $e');
      return false;
    }
  }

  /// Lista los tipos de biometría disponibles (huella, rostro, etc.).
  Future<List<BiometricType>> getAvailableBiometrics() async {
    try {
      return await _auth.getAvailableBiometrics();
    } on PlatformException catch (e) {
      debugPrint('Biometrics query failed: $e');
      return const [];
    }
  }

  /// Consulta si el usuario activó el desbloqueo biométrico en sus ajustes locales.
  Future<bool> isEnabled() async {
    final value = await _storage.read(key: _prefKey);
    return value == 'true';
  }

  /// Activa o desactiva el uso de biometría en el dispositivo.
  Future<void> setEnabled(bool enabled) async {
    await _storage.write(key: _prefKey, value: enabled ? 'true' : 'false');
  }

  /// Solicita autenticación biométrica al usuario con el diálogo nativo del sistema.
  Future<bool> authenticate({String reason = 'Confirma tu identidad para acceder a NexoDocs'}) async {
    try {
      final available = await isAvailable();
      if (!available) return false;
      return await _auth.authenticate(
        localizedReason: reason,
        biometricOnly: false,
        persistAcrossBackgrounding: true,
      );
    } on PlatformException catch (e) {
      debugPrint('Biometric authentication failed: $e');
      return false;
    }
  }
}
