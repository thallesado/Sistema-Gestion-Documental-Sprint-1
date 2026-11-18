import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'translations_en.dart';

/// Idiomas de la app móvil. La web admite además fr/zh; el móvil se alinea con es/en.
enum AppLanguage {
  es('Español'),
  en('English');

  const AppLanguage(this.nativeName);

  final String nativeName;

  Locale get locale => Locale(name);

  static AppLanguage fromCode(String? code) =>
      AppLanguage.values.firstWhere((language) => language.name == code, orElse: () => AppLanguage.es);
}

/// Idioma activo con persistencia local (misma clave que usa la web en localStorage).
///
/// El idioma por defecto es español, como en la web; no se toma el del sistema para que
/// la terminología clínica y documental sea la misma que ve el resto de la organización.
class AppLanguageController extends ValueNotifier<AppLanguage> {
  AppLanguageController([super.value = AppLanguage.es]) {
    _current = value;
  }

  static const storageKey = 'nexodocs_lang';

  static AppLanguage _current = AppLanguage.es;

  /// Idioma vigente para código sin [BuildContext] (cliente HTTP, etiquetas, avisos).
  static AppLanguage get current => _current;

  /// Instancia de la app; las pruebas pueden crear la suya.
  static final AppLanguageController instance = AppLanguageController();

  @override
  set value(AppLanguage newValue) {
    _current = newValue;
    super.value = newValue;
  }

  Future<void> load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      value = AppLanguage.fromCode(prefs.getString(storageKey));
    } catch (_) {
      // Sin almacenamiento disponible se mantiene el idioma actual.
    }
  }

  Future<void> use(AppLanguage language) async {
    value = language;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(storageKey, language.name);
    } catch (_) {
      // La elección se aplica igualmente durante la sesión.
    }
  }
}

/// Expone el idioma al árbol de widgets: quien llama a `context.tr` se redibuja al cambiarlo.
class AppLanguageScope extends InheritedNotifier<AppLanguageController> {
  const AppLanguageScope({super.key, required AppLanguageController controller, required super.child})
    : super(notifier: controller);

  /// Controlador del árbol (o el de la app) para cambiar el idioma desde el perfil.
  static AppLanguageController controllerOf(BuildContext context) =>
      context.getInheritedWidgetOfExactType<AppLanguageScope>()?.notifier ?? AppLanguageController.instance;

  static AppLanguage of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<AppLanguageScope>()?.notifier?.value ?? AppLanguageController.current;
}

/// Traduce un texto escrito en español (la clave es el propio texto en español).
///
/// Si no hay traducción se muestra el español, como hace la web con las claves que faltan.
/// [params] sustituye marcadores `{nombre}` en el texto ya traducido.
String translate(String spanish, AppLanguage language, [Map<String, Object?> params = const {}]) {
  var text = language == AppLanguage.en ? (englishTranslations[spanish] ?? spanish) : spanish;
  params.forEach((key, value) => text = text.replaceAll('{$key}', '${value ?? ''}'));
  return text;
}

/// Traducción sin contexto: usa el idioma vigente ([AppLanguageController.current]).
String tr(String spanish, [Map<String, Object?> params = const {}]) =>
    translate(spanish, AppLanguageController.current, params);

extension AppLanguageContext on BuildContext {
  /// Traducción ligada al árbol: el widget se reconstruye al cambiar de idioma.
  String tr(String spanish, [Map<String, Object?> params = const {}]) =>
      translate(spanish, AppLanguageScope.of(this), params);

  AppLanguage get language => AppLanguageScope.of(this);
}
