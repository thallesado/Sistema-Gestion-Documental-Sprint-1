import 'package:shared_preferences/shared_preferences.dart';

/// Persiste si el usuario ya vio el recorrido guiado (bandera `hasCompletedTour`).
class OnboardingStorage {
  const OnboardingStorage();

  static const completedKey = 'hasCompletedTour';

  /// `true` si el recorrido ya se completó u omitió. Si el almacenamiento no está disponible
  /// se considera completado: es preferible no mostrar el recorrido a mostrarlo en cada inicio.
  Future<bool> hasCompletedTour() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getBool(completedKey) ?? false;
    } catch (_) {
      return true;
    }
  }

  Future<void> markCompleted() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(completedKey, true);
    } catch (_) {
      // Sin almacenamiento el recorrido no se repite en esta sesión de todos modos.
    }
  }

  /// Vuelve a habilitar el recorrido (por ejemplo, desde una opción «Ver recorrido de nuevo»).
  Future<void> reset() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(completedKey);
    } catch (_) {}
  }
}
