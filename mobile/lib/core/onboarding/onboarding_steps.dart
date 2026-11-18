/// Definición del recorrido guiado (onboarding) de un solo uso.
///
/// Solo datos: títulos, descripciones y el objetivo de cada paso. La vista asocia cada
/// [OnboardingTarget] a su widget mediante la `GlobalKey` que le entrega [AppTourController].
library;

import '../i18n/app_language.dart';

/// Elementos de la interfaz que el recorrido señala, en el mismo orden que la web.
enum OnboardingTarget { navigation, primaryAction, profile }

class OnboardingStep {
  const OnboardingStep({
    required this.target,
    required this.title,
    required this.description,
  });

  final OnboardingTarget target;
  final String title;
  final String description;
}

/// Pasos del recorrido de bienvenida de la app móvil.
List<OnboardingStep> appTourSteps = [
  OnboardingStep(
    target: OnboardingTarget.navigation,
    title: tr('Navega por NexoDocs'),
    description: 'Desde esta barra cambias entre Inicio, Documentos, Tareas y los módulos que tu perfil tiene habilitados.',
  ),
  OnboardingStep(
    target: OnboardingTarget.primaryAction,
    title: 'Escanea documentos',
    description: 'Toma una foto de un documento en papel y NexoDocs lo digitaliza con OCR para guardarlo en tu organización.',
  ),
  OnboardingStep(
    target: OnboardingTarget.profile,
    title: tr('Tu perfil'),
    description: 'Aquí revisas tus datos, activas el acceso con huella o rostro y cierras sesión.',
  ),
];
