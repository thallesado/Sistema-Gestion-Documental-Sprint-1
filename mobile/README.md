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
│   │   ├── auth_api.dart     # Sesión, permisos, biometría y orquestación
│   │   ├── auth_repository.dart # Contratos HTTP desacoplados de autenticación (SRP)
│   │   ├── documents_api.dart
│   │   ├── expedients_api.dart # Consulta y ciclo de vida de expedientes/radicaciones
│   │   ├── audit_api.dart      # Consulta de bitácora y verificación de cadena SHA-256
│   │   ├── workflows_api.dart
│   │   └── clinical_api.dart
│   ├── models/               # Modelos de dominio tipados e inmutables (Clean Architecture)
│   │   ├── document_model.dart      # DocumentModel y DocumentVersionModel
│   │   ├── expedient_model.dart     # ExpedientModel, ExpedientParticipantModel y ExpedientTypeModel
│   │   ├── radicacion_model.dart    # RadicacionRequestModel, RadicacionResultModel, RadicacionType
│   │   ├── public_radicacion_model.dart # PublicRadicacionModel, PublicRadicacionEventModel
│   │   ├── radicacion_receipt_model.dart # RadicacionReceiptModel (sello de tiempo, firma y hash SHA-256)
│   │   ├── audit_event_model.dart   # AuditEventModel y AuditVerificationModel
│   │   ├── medical_appointment_model.dart # MedicalAppointmentModel (citas y agendamiento)
│   │   ├── workflow_task_model.dart # WorkflowTaskModel y WorkflowNotificationModel
│   │   ├── workflow_instance_model.dart # WorkflowInstanceModel, WorkflowStageProgressModel, WorkflowEventModel
│   │   ├── user_profile_model.dart  # UserProfileModel
│   │   ├── patient_model.dart       # PatientModel
│   │   ├── clinical_history_model.dart # ClinicalHistoryModel, ClinicalAllergyModel, etc.
│   │   └── ocr_job_model.dart       # OcrJobModel
│   ├── auth/user_permissions.dart   # Permisos por función de /auth/me (menú y botones)
│   ├── notifications/        # Avisos del sistema: comprobación en primer y segundo plano
│   ├── errors/api_exception.dart
│   ├── theme/app_theme.dart  # Paleta compartida con la web
│   ├── utils/
│   │   ├── format.dart       # Fechas y etiquetas de estado (mismos textos que la web)
│   │   ├── upload_rules.dart # Formatos y límites de POST /documents/{id}/versions
│   │   ├── pdf_generator.dart # Generador nativo en Dart puro de comprobantes y certificados PDF 1.4
│   │   └── ocr_field_extractor.dart # Extracción inteligente de metadatos OCR para radicar sin tecleo
│   └── widgets/
│       ├── state_views.dart
│       ├── signature_pad_widget.dart # Lienzo de firma manuscrita/biométrica con sello SHA-256
│       └── verification_qr_widget.dart # Renderizado determinista de código QR de autenticidad
└── screens/                  # audit, auth, dashboard, documents, expedients, tasks, notifications, patients, profile, scan, shell, workflows
```

Si una llamada a la API falla, las pantallas muestran el error con un botón **Reintentar**.
La app nunca muestra datos de ejemplo en su lugar.

## Alineación con la web

| Módulo | Estado en móvil |
|---|---|
| Login de tenant o plataforma, sesión verificada, renovación y cierre | ✅ |
| Contraseña temporal obligatoria, cambio voluntario y recuperación | ✅ API y formularios (enlace por correo requiere SMTP) |
| Inicio (resumen, tareas pendientes, documentos y actividad) | ✅ |
| Documentos: listado, filtros, detalle, versiones y descarga | ✅ |
| Creación de documentos / nuevos trámites | ✅ Modal con selección de tipo y archivo/cámara (`POST /documents`) |
| Subir nueva versión con la cámara, la galería o un archivo | ✅ (`POST /documents/{id}/versions`) |
| Permisos por función: pestañas, campana y acciones según `/auth/me` | ✅ |
| Avisos de workflow como notificaciones del sistema | ✅ Android (iOS: solo con la app abierta) |
| Workflows: mis tareas, detalle, checklist y comentarios | ✅ |
| Seguimiento de trámites en tiempo real (etapas, timeline de eventos, progreso) | ✅ Modal de seguimiento con etapas y observaciones (`GET /workflows/{id}`) |
| Inicio de workflows desde documentos con plantillas activas | ✅ Modal con validación (`POST /workflows`) |
| Firma biométrica nativa (Face ID / Huella dactilar) para aprobaciones | ✅ Verificación obligatoria al aprobar en detalle, acción rápida y en bloque |
| Bandeja de Aprobación Múltiple (Bulk Approve) | ✅ Selección múltiple de tareas y firma biométrica única en lote |
| Notificaciones | ✅ |
| Expedientes Digitales (radicaciones, trámites y documentos agrupados, ciclo de vida) | ✅ Pestaña dedicada, buscador, filtros por estado, detalle con workflows y documentos (`/api/v1/expedients`) |
| Buzón de Radicación Digital Directa (PQRS / Solicitudes Ciudadanas) | ✅ Wizard guiado (3 pasos: tipo/solicitante, descripción, soporte adjunto cámara/PDF y firma digital en pantalla), código único `RAD-YYYY-XXXXXX` y comprobante |
| Firma Digital Manuscrita / Biométrica para Ciudadanos | ✅ Lienzo interactivo para firmar con dedo o stylus con sello criptográfico SHA-256 |
| Consulta Pública / Externa sin Autenticación (Modo Invitado) | ✅ Acceso directo desde el login por código `RAD-...`, estado del trámite, cronología de etapas y sello de verificación |
| Comprobante Oficial de Radicación Digital y Exportación PDF Nativa | ✅ Membrete institucional, estampado cronológico, hash SHA-256, código QR y descarga de archivo `.pdf` nativo |
| Certificados de Autenticidad con Código QR para Documentos | ✅ Constancia oficial con código QR y descarga PDF en el detalle de documentos para presentar ante terceros |
| Pacientes, Historial Clínico y Agendamiento de Citas Médicas (Sector Salud) | ✅ Ficha del paciente, Historia Clínica completa (Antecedentes, Diagnósticos CIE-10, Evolución) y módulo de Citas Médicas (consulta y agendamiento) bajo `patient:read` |
| Digitalización con OCR y Extracción de Metadatos sin Tecleo | ✅ Escaneo con cámara/galería (`/api/v1/ocr`), validación, indexación y autocompletado directo del Buzón de Radicación |
| Pistas de Auditoría y Trazabilidad en Tiempo Real (Audit Log) | ✅ Historial de accesos, descargas, estados, filtro de alertas sospechosas y verificación en vivo de cadena SHA-256 (`/api/v1/audit`, `/api/v1/audit/verify`) |
| Perfil | ✅ consulta y cambio de contraseña (edición y foto: pendiente) |
| Usuarios y roles, Reportes, Facturación | ❌ pendiente |
| Idiomas (es/en/fr/zh) | ❌ pendiente (solo castellano) |

## Permisos, nueva versión y avisos

**Permisos.** El login y `GET /auth/me` devuelven `permissions`. La app oculta lo que el perfil no
puede usar, con los mismos códigos que el backend:

| Elemento | Permiso |
|---|---|
| Pestaña Documentos / Tareas / Expedientes / Clínico | `document:read` / `task:read` / `expedient:read` / `patient:read` |
| Campana y avisos | `notification:read` |
| Resolver y comentar tareas | `task:update` (+ `workflow:approve`, `workflow:review`, `workflow:reject` o `workflow:return` según la acción) |
| Nueva versión de un documento | `document:update` |
| Seguimiento de trámites en documentos | `workflow:read` |
| Iniciar workflow / trámite desde documento | `workflow:start` o `workflow:create` + `workflow_template:read` |
| Radicar solicitud / PQRS ciudadana | `expedient:create` (y `document:create` si adjunta soporte) |
| Ciclo de vida de expediente (cerrar/archivar/reabrir) | `expedient:update` |

Si el servidor no informa `permissions` no se oculta nada; el backend sigue rechazando con 403.

**Nueva versión.** Detalle del documento → **Nueva versión** → Cámara, Galería o Archivo, y un
motivo obligatorio. Formatos PDF, JPG, PNG o DOCX hasta 25 MB (las mismas reglas que
`DocumentStorageService`); el servidor calcula el SHA-256.

**Avisos.** No usa Firebase. Con la app abierta consulta `/workflows/notifications` cada minuto y
al volver a primer plano; en Android, WorkManager lo hace con la app cerrada (como mínimo cada
15 minutos y solo con red). Los avisos ya vistos no se repiten y, al iniciar sesión, los antiguos
no se notifican. En segundo plano solo se usa el token de acceso: nunca se renueva la sesión,
para no invalidar el refresh token que usa la app. Al tocar el aviso se abre la tarea.

Para pruebas de instalación usa `flutter build apk --debug` y `build/app/outputs/flutter-apk/app-debug.apk`.
No instales un APK `release` de desarrollo: la compilación release requiere un keystore privado de publicación.
Configúralo en `mobile/android/key.properties` usando `key.properties.example`; ese archivo y el keystore
están ignorados por Git. No guardes el keystore ni sus contraseñas en el repositorio. Para validar avisos,
configura la URL del servidor, acepta el permiso y asigna una tarea a ese usuario desde la web.
