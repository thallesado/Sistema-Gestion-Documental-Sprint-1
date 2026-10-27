import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nexodocs_mobile/core/onboarding/app_tour_controller.dart';
import 'package:nexodocs_mobile/core/onboarding/onboarding_steps.dart';
import 'package:nexodocs_mobile/core/onboarding/onboarding_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Pantalla mínima con los tres objetivos del recorrido.
class _TourHost extends StatefulWidget {
  const _TourHost();

  @override
  State<_TourHost> createState() => _TourHostState();
}

class _TourHostState extends State<_TourHost> {
  final tour = AppTourController();

  @override
  void initState() {
    super.initState();
    tour.register();
    WidgetsBinding.instance.addPostFrameCallback((_) => tour.startIfNeeded());
  }

  @override
  void dispose() {
    tour.unregister();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        body: Column(children: [
          tour.wrap(OnboardingTarget.navigation, const SizedBox(width: 200, height: 40, child: Text('nav'))),
          tour.wrap(OnboardingTarget.primaryAction, const SizedBox(width: 120, height: 40, child: Text('accion'))),
          tour.wrap(OnboardingTarget.profile, const SizedBox(width: 40, height: 40, child: Text('perfil'))),
        ]),
      );
}

/// The tooltip bounces forever, so pumpAndSettle never settles: advance a fixed time instead.
Future<void> settle(WidgetTester tester) async {
  for (var i = 0; i < 10; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

Future<void> pumpTour(WidgetTester tester) async {
  await tester.pumpWidget(const MaterialApp(home: _TourHost()));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 500));
  await settle(tester);
}

void main() {
  test('los pasos se definen aparte y cubren los tres objetivos en orden', () {
    expect(appTourSteps.map((step) => step.target), OnboardingTarget.values);
    expect(appTourSteps.every((step) => step.title.isNotEmpty && step.description.isNotEmpty), isTrue);
  });

  test('la bandera hasCompletedTour se lee y se escribe en SharedPreferences', () async {
    SharedPreferences.setMockInitialValues({});
    const storage = OnboardingStorage();
    expect(await storage.hasCompletedTour(), isFalse);
    await storage.markCompleted();
    expect(await storage.hasCompletedTour(), isTrue);
    expect((await SharedPreferences.getInstance()).getBool(OnboardingStorage.completedKey), isTrue);
    await storage.reset();
    expect(await storage.hasCompletedTour(), isFalse);
  });

  testWidgets('el recorrido se muestra una vez y permite avanzar, retroceder y omitir', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await pumpTour(tester);

    expect(find.text('Navega por NexoDocs'), findsOneWidget);
    expect(find.text('Omitir'), findsOneWidget);

    await tester.tap(find.text('Siguiente'));
    await settle(tester);
    expect(find.text('Escanea documentos'), findsOneWidget);

    await tester.tap(find.text('Atrás'));
    await settle(tester);
    expect(find.text('Navega por NexoDocs'), findsOneWidget);

    await tester.tap(find.text('Omitir'));
    await settle(tester);
    expect(find.text('Navega por NexoDocs'), findsNothing);
    expect(await const OnboardingStorage().hasCompletedTour(), isTrue);
  });

  testWidgets('con hasCompletedTour en true el recorrido no aparece', (tester) async {
    SharedPreferences.setMockInitialValues({OnboardingStorage.completedKey: true});
    await pumpTour(tester);
    expect(find.text('Navega por NexoDocs'), findsNothing);
  });
}
