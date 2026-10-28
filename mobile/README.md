# NexoDocs Mobile (Flutter)

Cliente móvil de NexoDocs para Android e iOS. Usa la misma API REST (`/api/v1`) y la
misma sesión JWT que la web Angular.

## Ejecutar

```powershell
flutter pub get
flutter run                      # dispositivo o emulador conectado
flutter test                     # pruebas con un servidor simulado (no necesita backend)
flutter analyze
flutter build apk --debug        # APK instalable de desarrollo
```

La compilación de integración continua también publica `nexodocs-android-debug-apk` como
artefacto descargable durante 14 días. El archivo local queda en
`build/app/outputs/flutter-apk/app-debug.apk`.

### Servidor

Por defecto la app apunta a `http://127.0.0.1:8080/api/v1`. Para cambiarlo:

- **Desde la app:** icono ⚙ en el login → URL del servidor. Se guarda en el teléfono.
  Desde un teléfono real usa la IP del equipo que ejecuta el backend, por ejemplo
  `http://192.168.1.50:8080/api/v1`.
- **Al compilar:** `flutter run --dart-define=NEXODOCS_API_URL=https://mi-servidor/api/v1`
- **Emulador Android:** el equipo anfitrión es `http://10.0.2.2:8080/api/v1`.

El tráfico `http://` sin cifrar solo está permitido en compilaciones **debug**
(`android/app/src/debug/AndroidManifest.xml`); las compilaciones release y profile exigen HTTPS, así
que para producción compila con `--dart-define=NEXODOCS_API_URL=https://...`. Los botones
"Demo: ..." del login solo existen en debug (`kDebugMode`). En iOS hace falta HTTPS o
una excepción de App Transport Security en `ios/Runner/Info.plist`.

## Estructura

```text
lib/
├── main.dart                 # Arranque: restaura servidor y sesión; vuelve al login si la sesión expira
├── core/
│   ├── api/
│   │   ├── api_client.dart   # HTTP + token + renovación automática ante 401 (como el interceptor web)
│   │   ├── auth_api.dart     # Login, logout, perfil, organizaciones; acceso a los servicios
│   │   ├── documents_api.dart
│   │   ├── workflows_api.dart
│   │   └── clinical_api.dart
│   ├── auth/user_permissions.dart   # Permisos por función de /auth/me (menú y botones)
│   ├── notifications/        # Avisos del sistema: comprobación en primer y segundo plano
│   ├── errors/api_exception.dart
│   ├── theme/app_theme.dart  # Paleta compartida con la web
│   ├── utils/format.dart     # Fechas y etiquetas de estado (mismos textos que la web)
│   ├── utils/upload_rules.dart  # Formatos y límites de POST /documents/{id}/versions
│   └── widgets/state_views.dart
└── screens/                  # auth, dashboard, documents, tasks, notifications, patients, profile, shell
```

Si una llamada a la API falla, las pantallas muestran el error con un botón **Reintentar**.
La app nunca muestra datos de ejemplo en su lugar.

## Alineación con la web

| Módulo | Estado en móvil |
|---|---|
| Login con selector de organización, renovación y cierre de sesión | ✅ |
| Inicio (resumen, tareas pendientes, documentos y actividad) | ✅ |
| Documentos: listado, filtros, detalle, versiones y descarga | ✅ |
| Subir nueva versión con la cámara, la galería o un archivo | ✅ (crear documentos: pendiente) |
| Permisos por función: pestañas, campana y acciones según `/auth/me` | ✅ |
| Avisos de workflow como notificaciones del sistema | ✅ Android (iOS: solo con la app abierta) |
| Workflows: mis tareas, detalle, aprobar/revisar/completar/rechazar/devolver, checklist y comentarios | ✅ (diseñador e inicio de workflows: pendiente) |
| Notificaciones | ✅ |
| Pacientes y resumen clínico | ⚠️ parcial (antecedentes y notas médicas: pendiente) |
| Perfil | ✅ consulta (edición, contraseña y foto: pendiente) |
| Expedientes, Digitalización/OCR, Auditoría, Usuarios y roles, Reportes, Facturación | ❌ pendiente |
| Idiomas (es/en/fr/zh) | ❌ pendiente (solo castellano) |

## Permisos, nueva versión y avisos

**Permisos.** El login y `GET /auth/me` devuelven `permissions`. La app oculta lo que el perfil no
puede usar, con los mismos códigos que el backend:

| Elemento | Permiso |
|---|---|
| Pestaña Documentos / Tareas / Clínico | `document:read` / `task:read` / `patient:read` |
| Campana y avisos | `notification:read` |
| Resolver y comentar tareas | `task:update` (+ `workflow:approve`, `workflow:review`, `workflow:reject` o `workflow:return` según la acción) |
| Nueva versión de un documento | `document:update` |

Si el servidor no informa `permissions` no se oculta nada; el backend sigue rechazando con 403.

**Nueva versión.** Detalle del documento → **Nueva versión** → Cámara, Galería o Archivo, y un
motivo obligatorio. Formatos PDF, JPG, PNG o DOCX hasta 25 MB (las mismas reglas que
`DocumentStorageService`); el servidor calcula el SHA-256.

**Avisos.** No usa Firebase. Con la app abierta consulta `/workflows/notifications` cada minuto y
al volver a primer plano; en Android, WorkManager lo hace con la app cerrada (como mínimo cada
15 minutos y solo con red). Los avisos ya vistos no se repiten y, al iniciar sesión, los antiguos
no se notifican. En segundo plano solo se usa el token de acceso: nunca se renueva la sesión,
para no invalidar el refresh token que usa la app. Al tocar el aviso se abre la tarea.

Para probarlo con el APK: `flutter build apk --release`, instalar `build/app/outputs/flutter-apk/app-release.apk`,
configurar la URL del servidor en el login (⚙), aceptar el permiso de notificaciones y asignar
una tarea a ese usuario desde la web. Con la app abierta llega en menos de un minuto.
