import 'package:flutter/material.dart';
import 'package:showcaseview/showcaseview.dart';

import '../theme/app_theme.dart';
import 'onboarding_steps.dart';
import 'onboarding_storage.dart';

/// Coordina el recorrido guiado: registra [ShowcaseView], entrega una [GlobalKey] por paso,
/// lo inicia solo si `hasCompletedTour` es falso y guarda la bandera al terminar u omitir.
class AppTourController {
  AppTourController({
    this.steps = appTourSteps,
    this.storage = const OnboardingStorage(),
  });

  static const scope = 'nexodocs-app-tour';

  final List<OnboardingStep> steps;
  final OnboardingStorage storage;
  final Map<OnboardingTarget, GlobalKey> _keys = {
    for (final target in OnboardingTarget.values) target: GlobalKey(),
  };
  bool _registered = false;

  GlobalKey keyFor(OnboardingTarget target) => _keys[target]!;

  OnboardingStep stepFor(OnboardingTarget target) =>
      steps.firstWhere((step) => step.target == target);

  /// Envuelve [child] como objetivo del paso [target], con la paleta de la app.
  Widget wrap(OnboardingTarget target, Widget child, {ShapeBorder? shape}) {
    final step = stepFor(target);
    return Showcase(
      key: keyFor(target),
      title: step.title,
      description: step.description,
      titleTextStyle: const TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.bold,
        color: AppTheme.tealDark,
      ),
      descTextStyle: const TextStyle(
        fontSize: 14,
        height: 1.4,
        color: AppTheme.ink,
      ),
      targetShapeBorder:
          shape ??
          const RoundedRectangleBorder(
            borderRadius: BorderRadius.all(Radius.circular(16)),
          ),
      overlayOpacity: 0.7,
      child: child,
    );
  }

  /// Registra el controlador de showcase. Llamar en `initState` del widget que contiene los objetivos.
  void register() {
    if (_registered) return;
    _registered = true;
    ShowcaseView.register(
      scope: scope,
      skipIfTargetNotPresent: true,
      onFinish: storage.markCompleted,
      onDismiss: (_) => storage.markCompleted(),
      globalTooltipActionConfig: const TooltipActionConfig(
        alignment: MainAxisAlignment.spaceBetween,
        position: TooltipActionPosition.inside,
      ),
      globalTooltipActions: [
        TooltipActionButton(
          type: TooltipDefaultActionType.skip,
          name: 'Omitir',
          backgroundColor: Colors.transparent,
          textStyle: const TextStyle(
            color: AppTheme.tealDark,
            fontWeight: FontWeight.w600,
          ),
        ),
        TooltipActionButton(
          type: TooltipDefaultActionType.previous,
          name: 'Atrás',
          backgroundColor: AppTheme.mint,
          textStyle: const TextStyle(
            color: AppTheme.tealDark,
            fontWeight: FontWeight.w600,
          ),
          // En el primer paso no hay a dónde volver.
          hideActionWidgetForShowcase: [keyFor(steps.first.target)],
        ),
        TooltipActionButton(
          type: TooltipDefaultActionType.next,
          name: 'Siguiente',
          backgroundColor: AppTheme.teal,
          textStyle: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }

  /// Inicia el recorrido si aún no se completó. Los pasos cuyo objetivo no está en pantalla
  /// (p. ej. una pestaña sin permiso) se omiten.
  Future<void> startIfNeeded() async {
    if (!_registered || await storage.hasCompletedTour()) return;
    final view = ShowcaseView.getNamed(scope);
    final keys = [
      for (final step in steps)
        if (view.isTargetRendered(keyFor(step.target))) keyFor(step.target),
    ];
    if (keys.isEmpty) return;
    view.startShowCase(keys, delay: const Duration(milliseconds: 400));
  }

  void unregister() {
    if (!_registered) return;
    _registered = false;
    ShowcaseView.getNamed(scope).unregister();
  }
}
