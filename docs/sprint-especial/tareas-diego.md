# Tareas de Diego: auditoría, asistente e integración

Carga estimada: 10 días, más la integración del equipo. Migraciones reservadas: 040 y 041. Lee antes `README.md`.

Además eres el integrador: haces el PR 0, extraes el cliente Gemini compartido y resuelves conflictos entre ramas.

## PR 0. Andamiaje (primero, antes de que los demás empiecen)

Objetivo: que nadie tenga que editar los archivos calientes del frontend.

Estado: hecho en la rama `feature/diego-pr0-andamiaje`, pendiente de revisión y de integrarse en `main`. Qué contiene:

1. Rutas y entradas de menú ocultas (`sprintEnabled: false`) para respaldos, apariencia, privilegios por formulario, consultas dinámicas y reportes por voz, más la ruta pública `/planes`. Cada una tiene su página placeholder en `features/<área>/` y el catálogo genérico de `app.routes.ts` ya no las reclama.
2. Servicios gancho con lógica pura testeada: `PermissionService`, `ThemeService`, `TranslationService` y `AssistantContextService`.
3. Interceptores: `assistantErrorInterceptor` (primero) y `clientTimestampInterceptor` (último, sin efecto todavía).
4. Shell: el botón de ayuda abre `HelpDrawer`, y `<app-assistant-widget />` queda montado una sola vez. `/planes` figura entre las rutas públicas del shell.
5. `.github/pull_request_template.md` y esta carpeta `docs/sprint-especial/`.
6. Pendiente: `.github/CODEOWNERS`, que necesita los usuarios de GitHub de los seis.

Revisor: Andres, porque toca `.github/`.

## G0. Cliente Gemini compartido (0,5 días)

`OcrService` ya tiene el cliente HTTP con reintentos ante 429/500/503, lista de modelos candidatos y clave por cabecera. Extrae esa parte a `service/GeminiClient.java` sin cambiar el comportamiento del OCR (los tests existentes `OcrServiceExtractTest` deben seguir en verde). Lo reutilizan tu asistente (H2) y la voz de Edixon (D4).

## C1. Auditoría detallada (requisito 3, P1, 3 días)

### Qué pide el docente

Un registro muy detallado: fecha y hora (del cliente y del servidor), desde dónde se conecta, identificador del usuario y la operación exacta, "no solamente crea una venta: qué venta, con sus datos".

### Qué ya existe

- Tabla `audit_events` con triggers que bloquean `UPDATE` y `DELETE`, política RLS y revocación de permisos.
- `HttpAuditInterceptor` y `HttpAuditService` capturan usuario, tenant, IP, agente de usuario, método, ruta y estado.
- `AuditController` y la pantalla `features/auditoria` con filtros y un panel lateral que ya sabe mostrar antes y después.

### Lo que falta

- `details` guarda solo `{method, path, status}`: sin datos de la entidad ni valores antes y después.
- `AuditEventResponse` ni siquiera devuelve `details` al frontend.
- No hay hora del cliente.
- Las subrutas `/audit/document-creation`, `/audit/modifications` y similares muestran "HISTORIAL NO DISPONIBLE".

### Qué implementar

1. Migración 040: columnas `client_timestamp` y `client_timezone` en `audit_events`.
2. Un `HttpInterceptorFn` en el frontend (`core/`) que añada `X-Client-Timestamp` con hora local y desfase a cada llamada a la API. Backend: leerla en el interceptor de auditoría.
3. `AuditRecorder.record(action, entityType, entityId, before, after)` para registrar antes y después en los servicios clave: documentos, usuarios, roles, expedientes, pacientes, historias clínicas y digitalizaciones OCR. Nunca registrar contraseñas, tokens ni claves; truncar valores largos.
4. Devolver `details` en `AuditEventResponse` y mostrarlos en la pantalla.
5. Hacer reales las subrutas de auditoría filtrando por acción y tipo de entidad.

### Criterio de aceptación

Crear un documento y modificarlo deja eventos que muestran quién, cuándo (hora del cliente y del servidor), desde qué IP, qué documento y qué campos cambiaron con su valor anterior y nuevo. Ningún evento contiene datos sensibles.

## C3. Bitácora a prueba de manipulación (requisito 3, P1, 3 días)

### Qué pide el docente

Un registro inalterable incluso si quien hace fraude es el administrador de la base de datos: "como la caja negra de un avión". Sugirió algo parecido a blockchain (dudoso).

### Qué ya existe

Los triggers de `audit_events` evitan cambios desde la aplicación, pero el dueño de la tabla o un superusuario puede desactivarlos (`ALTER TABLE ... DISABLE TRIGGER`) y reescribir filas sin dejar rastro. No hay cadena de hashes, firma ni copia externa.

### Qué implementar

1. Migración 041: columnas `chain_seq`, `previous_hash` y `record_hash` en `audit_events`.
2. Un trigger `BEFORE INSERT` que calcule `record_hash = sha256(previous_hash || contenido canónico del evento)` por tenant, serializado con `pg_advisory_xact_lock`. Al estar en la base de datos cubre todos los caminos de inserción, incluida la auditoría de logins fallidos de Andres, sin acoplar código.
3. `AuditVerificationService` y `GET /api/v1/audit/verify` (superadministrador): recorre la cadena y reporta el primer eslabón roto.
4. **Ancla externa**, que es lo que realmente frena al administrador de la base: publicar periódicamente el último hash fuera de la base (por ejemplo un objeto en S3 con Object Lock o un correo firmado). Coordina con Andres si usan AWS. Sin ancla, un administrador puede recalcular toda la cadena.
5. Documentar el modelo de amenazas con honestidad: sin ancla es evidencia de manipulación, con ancla el administrador no puede reescribir sin ser detectado.

### Criterio de aceptación

Demostración: con un superusuario se modifica una fila vieja de `audit_events` y `GET /api/v1/audit/verify` detecta y señala el eslabón alterado. Hay tests de la verificación.

## H2. Asistente contextual (requisito 8, P2, 3 días)

### Qué pide el docente

Un agente que monitoree lo que hace el usuario para asistirlo en cualquier momento, mejor que manuales o videos.

### Qué ya existe

- Un widget de Botpress cargado desde un CDN externo (`core/chatbot/chatbot.service.ts`), montado en `app.ts`. No recibe usuario, rol, ruta ni errores: es decorativo.
- El botón de ayuda de la barra superior solo muestra un aviso.
- Clases de chat anteriores (`ChatBotToolsConfig`, `RAGService`, `modulos/chat`) están excluidas del build en `backend/bootstrap/pom.xml`.

### Qué implementar

1. Backend: `POST /api/v1/assistant/chat` sobre el `GeminiClient`. El mensaje de sistema incluye un manual resumido de la aplicación y el contexto recibido. Límite de peticiones por usuario y sin datos clínicos.
2. Frontend: un componente propio `features/assistant/` que reemplaza a Botpress. `AssistantContextService` registra la ruta actual, los últimos eventos de navegación y el último error HTTP (por un interceptor) y los envía como contexto.
3. Sugerencias proactivas: si falla un proceso (por ejemplo el OCR), la burbuja ofrece ayuda sobre ese caso concreto.
4. Quitar el script de Botpress.

### Criterio de aceptación

Si el OCR falla, la burbuja sugiere reintentar o revisar la imagen. Al preguntar "¿cómo indexo un documento?" responde con los pasos reales del sistema.

## Dependencias y coordinación

- PR 0 y G0 antes que todos.
- C1 antes que C3.
- Mauricio hace el centro de ayuda (H1): enlazarlo con tu asistente.
- Oscar publica los permisos del usuario en el frontend (B3): úsalos para limitar lo que el asistente sugiere.
- Eres dueño de `HttpAuditService` y `AuditController`: nadie más los toca.
