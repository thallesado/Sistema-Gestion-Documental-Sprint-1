# NexoDocs Mobile (Flutter)

Cliente móvil de NexoDocs para Android e iOS. Usa la misma API REST (`/api/v1`) y la
misma sesión JWT que la web Angular.

## Ejecutar

```powershell
flutter pub get
flutter run                      # dispositivo o emulador conectado
flutter test                     # pruebas con un servidor simulado (no necesita backend)
flutter analyze
```

### Servidor

Por defecto la app apunta a `http://127.0.0.1:8080/api/v1`. Para cambiarlo:

- **Desde la app:** icono ⚙ en el login → URL del servidor. Se guarda en el teléfono.
  Desde un teléfono real usa la IP del equipo que ejecuta el backend, por ejemplo
  `http://192.168.1.50:8080/api/v1`.
- **Al compilar:** `flutter run --dart-define=NEXODOCS_API_URL=https://mi-servidor/api/v1`
- **Emulador Android:** el equipo anfitrión es `http://10.0.2.2:8080/api/v1`.

Android permite `http://` (tráfico sin cifrar) para desarrollo. En iOS hace falta HTTPS o
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
│   ├── errors/api_exception.dart
│   ├── theme/app_theme.dart  # Paleta compartida con la web
│   ├── utils/format.dart     # Fechas y etiquetas de estado (mismos textos que la web)
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
| Documentos: listado, filtros, detalle, versiones y descarga | ✅ (crear y subir versiones: pendiente) |
| Workflows: mis tareas, detalle, aprobar/revisar/completar/rechazar/devolver, checklist y comentarios | ✅ (diseñador e inicio de workflows: pendiente) |
| Notificaciones | ✅ |
| Pacientes y resumen clínico | ⚠️ parcial (antecedentes y notas médicas: pendiente) |
| Perfil | ✅ consulta (edición, contraseña y foto: pendiente) |
| Expedientes, Digitalización/OCR, Auditoría, Usuarios y roles, Reportes, Facturación | ❌ pendiente |
| Idiomas (es/en/fr/zh) | ❌ pendiente (solo castellano) |
