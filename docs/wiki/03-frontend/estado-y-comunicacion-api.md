# Estado y comunicación API

> Revisión documental: 2026-10-16. Base de código: `a590a6d`; ver [estado verificado](../05-guias-ia/estado-verificado-y-pendientes.md). Descripción del código inspeccionado, no certificación de producción.

## Conexión

Clientes bajo core/api, API relativa /api/v1. Proxy de desarrollo [frontend/proxy.conf.json](../../../frontend/proxy.conf.json) apunta actualmente a localhost:8080 (puerto por defecto del backend, BACKEND_PORT). El proxy envía `Origin: http://localhost:4200` al backend para permitir el servidor Angular también en puertos alternativos como 4201 con el backend local existente. Este ajuste es exclusivo del proxy de desarrollo; no modifica la lista CORS del servidor ni producción. Docker usa Nginx hacia backend:8080; HTTPS se termina en Caddy en el despliegue documentado.

## Sesión e interceptor

AuthService almacena `nexodocs.access_token` y `nexodocs.refresh_token` en **sessionStorage**, tomando `response.token`. Al recargar consulta identidad/roles con /auth/me.

El interceptor añade Bearer si encuentra token; en el código local no limita ese agregado exclusivamente a /api/v1 ni excluye todos los endpoints públicos. Para 401 excluye login/logout/refresh de reintentos, usa refreshOnce y reintenta con response.token; si falla ejecuta logout. La ruta web de login es /login.

Distinguir regla deseada de comportamiento: no documentar un filtrado de URLs que todavía no existe.

## Estado y errores

Signals para carga/listas/selección; computed para derivados; RxJS para debounce/cancelación. No usar vacío/cero como prueba de que no hay registros tras fallar una API. Mostrar errores y reintentos sin datos inventados.

Filtros locales sobre una página no equivalen a filtrado global del backend. Evitar conservar datos del paciente/documento anterior al cambiar selección.

## Asistente contextual

`AssistantWidget` (`features/assistant/`) reemplaza al widget externo de Botpress. Cada pregunta va a `POST /api/v1/assistant/chat` con un contexto mínimo: ruta actual y rutas recientes sin query string, último error HTTP (método, ruta y estado, registrado por `assistantErrorInterceptor`) y códigos de permiso del usuario. El backend (`AssistantService`) vuelve a sanear ese contexto (reemplaza identificadores por `:id`, descarta permisos mal formados), arma el mensaje de sistema con el manual `assistant/manual.md` y llama a `GeminiClient`. No lee datos del tenant ni de pacientes. Límite por usuario en memoria (`app.assistant.rate-limit.*`, 20 por minuto por defecto): 429 al exceder, 503 sin API key de Gemini, 502 si Gemini falla. Las sugerencias proactivas (`assistant-suggestions.ts`) son reglas locales sin llamada a Gemini: un fallo de OCR ofrece reintentar o revisar la imagen.

## Cambio obligatorio de contraseña temporal

`AuthService.mustChangePassword` (signal) se rellena con `mustChangePassword` del login/refresh y de `/auth/me`. `authGuard` redirige a `/change-password` (`features/auth/pages/change-password-page.ts`, protegida por `changePasswordPageGuard`) y `authInterceptor` hace lo mismo ante un 403 con `code: MUST_CHANGE_PASSWORD`. La pantalla usa `PUT /auth/me/password`; al terminar llama a `completeForcedPasswordChange()`, que limpia la sesión local (el backend cerró las sesiones) y lleva a `/login?reason=password-changed`.

## Contratos TS/Java

packages/shared contiene utilidades/tipos, pero las API también declaran interfaces locales. No hay sincronización automática con Java ni evidencia de que todos los clientes importen shared. Alinear campos/alias con DTO real y validar el comportamiento de HTTP, no solo compilación TS.

Fuentes: [frontend/src/app/core/auth/auth.service.ts](../../../frontend/src/app/core/auth/auth.service.ts), [frontend/src/app/core/auth/auth.interceptor.ts](../../../frontend/src/app/core/auth/auth.interceptor.ts), [frontend/src/app/core/api/document-api.service.ts](../../../frontend/src/app/core/api/document-api.service.ts), [packages/shared/src/index.ts](../../../packages/shared/src/index.ts). [Pruebas](../05-guias-ia/pruebas-y-validacion.md).
