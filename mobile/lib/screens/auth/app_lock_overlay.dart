import 'package:flutter/material.dart';

import '../../core/api/auth_api.dart';
import 'login_page.dart';

/// Capa de bloqueo sobre toda la app: cubre cualquier pantalla, también las apiladas.
/// Cuando [AuthApi.locked] es verdadero se muestra el login con la huella; al desbloquear
/// vuelve la misma pantalla que estaba abierta (no se reconstruye la navegación).
class AppLockOverlay extends StatelessWidget {
  const AppLockOverlay({super.key, required this.api, required this.child, this.onFullLogout});

  final AuthApi api;
  final Widget child;

  /// Cierre completo desde el bloqueo ("Usar contraseña"): debe mostrar el login normal.
  final VoidCallback? onFullLogout;

  @override
  Widget build(BuildContext context) => ValueListenableBuilder<bool>(
    valueListenable: api.locked,
    builder: (context, isLocked, _) => Stack(
      children: [
        child,
        if (isLocked)
          // Navigator propio: aporta el Overlay que necesitan tooltips y rutas del login.
          Positioned.fill(
            child: HeroControllerScope.none(
              child: Navigator(
                onGenerateRoute: (_) => MaterialPageRoute<void>(
                  builder: (_) => LoginPage(
                    authApi: api,
                    lockedMode: true,
                    onUnlocked: () => api.locked.value = false,
                    onFullLogout: onFullLogout,
                  ),
                ),
              ),
            ),
          ),
      ],
    ),
  );
}
