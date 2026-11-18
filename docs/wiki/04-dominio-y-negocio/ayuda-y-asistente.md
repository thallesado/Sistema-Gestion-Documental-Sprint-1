# Centro de ayuda y asistente contextual

> Revisión documental: 2026-11-18. Fuente: checkout `4d7c663` mas cambios locales; asistente verificado con Gemini real en localhost:4201, sin inspeccion de AWS.

## Compatibilidad del contexto de errores (2026-11-18)

El navegador incluye `context.lastError.at` como fecha del ultimo error. El backend rechazaba ese campo con HTTP 400 antes de llamar a Gemini. `AssistantChatRequest.ErrorInfo` ahora descarta exclusivamente `at` mediante `@JsonIgnoreProperties("at")`: la fecha no se conserva ni se envia al proveedor y los demas campos desconocidos siguen rechazandose con deserializacion estricta. No se modifica la configuracion global de Jackson.

Prueba de regresion: [AssistantChatRequestTest](../../../backend/bootstrap/src/test/java/com/lta/gestdocum/backend/dto/AssistantChatRequestTest.java), junto con `AssistantServiceTest`. Esta correccion local no acredita despliegue ni respuesta real de Gemini en EC2.

## Qué hay

- **Centro de ayuda:** panel lateral (botón Ayuda) con artículos y preguntas frecuentes. Cada artículo existe en dos copias que deben mantenerse idénticas: el archivo `frontend/public/assets/help/<id>.md` y el contenido embebido en `help-drawer.ts`. Un test (`frontend/tests/help-content.test.mjs`) vigila que coincidan y que no se afirmen capacidades que el sistema no tiene (por ejemplo, corrección de perspectiva en OCR o etapas paralelas en workflows).
- **Artículos:** `ocr`, `workflows`, `expedientes`, `usuarios-roles`, `primer-uso`, `respaldos`, `privilegios-formulario`, `auditoria` y `apariencia`. El visor solo interpreta los títulos `###` y `####`.
- **Asistente:** widget flotante que usa Gemini a través de `GeminiClient`. Responde solo con lo que figura en `backend/bootstrap/src/main/resources/assistant/manual.md`; si algo no está, lo dice y sugiere el centro de ayuda. El manual cubre respaldos, privilegios por formulario, auditoría y verificación de integridad, apariencia, registro y planes, contraseña temporal, tope de usuarios y bloqueo de login (HTTP 429).

La pregunta libre del usuario **no se reenvía a Gemini**. `AssistantService.safeHelpIntent` solo clasifica localmente el texto en una categoría de ayuda permitida y envía esa frase fija junto al manual y al contexto saneado. UUIDs, query strings, mensajes de error y permisos fuera del formato permitido se eliminan del contexto. Esto reduce exposición accidental de datos clínicos, pero no convierte al widget en un canal para consultar expedientes ni impide que el usuario escriba información sensible en el navegador; la política del navegador para dictado también es independiente.

Las fallas HTTP se registran separadamente como logs técnicos minimizados: ruta sin query/identificadores, código HTTP y clase de excepción; no se guarda cuerpo ni mensaje de excepción.

## Cómo mantenerlo

Al cambiar una pantalla o un permiso, actualizar el artículo, la pregunta frecuente y el manual del asistente en el mismo cambio, con las rutas de menú tal como están en `frontend/src/app/core/data/nexodocs-data.ts`. No describir funciones que no estén en el código: el sistema no corrige perspectiva ni sombras en OCR y sus workflows son secuenciales con un aprobador por etapa. La bienvenida del administrador de una organizacion puede enviarse por SMTP; no equivale al alta de usuarios internos.

Fuentes: [help-drawer.ts](../../../frontend/src/app/features/help/components/help-drawer.ts), [manual del asistente](../../../backend/bootstrap/src/main/resources/assistant/manual.md), [AssistantService.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/AssistantService.java).

## Privacidad del prompt al proveedor (2026-11-04)

AssistantService convierte la pregunta libre en una intencion fija allowlist antes de invocar Gemini y filtra el contexto de ruta/permisos. El texto original no se envia, reduciendo el riesgo de que una consulta pegada contenga PII o datos clinicos. La voz del navegador tiene tratamiento separado y dependiente del navegador. Ver [HU-19 a HU-24](sprint-hu19-24.md).

## Correccion local del 2026-11-18

En localhost:4201 se reprodujo HTTP 503 en `POST /api/v1/assistant/chat`: el archivo `.env` tenia GEMINI_API_KEY, pero el contenedor `nexodocs-pruebas-backend-1` no habia recibido esa variable. Editar un archivo de entorno no cambia las variables de un contenedor existente. Se copio la configuracion Gemini al archivo privado de Compose del laboratorio y se recreo solo ese backend, conservando SMTP, volumen y base. No se modificaron localhost:4200 ni AWS.

La clave se comprobo sin imprimirla: listado de modelos y una generacion minima respondieron HTTP 200. Luego la API del asistente y el widget real en Chromium respondieron HTTP 200 con `gemini-3.5-flash-lite`. Pregunta sintetica: como solicitar un prestamo fisico. [Captura real del widget](../../evidencias/asistente/01-respuesta-gemini.png) y [resultado seguro](../../evidencias/asistente/resultado-verificacion.json).

El modelo no se entrena ni consulta automaticamente la wiki o las tablas de pacientes. Usa el manual incluido en el backend. Se agregaron al manual las entregas externas, archivo fisico/prestamos, traduccion revisada y buzon documental, con sus permisos y limites. `safeHelpIntent()` reconoce esas categorias antes de las categorias generales sin reenviar el texto libre. Los permisos legitimos con guion, como `mail-intake:read`, se conservan en el contexto; siguen procediendo del servidor y no del navegador.

Verificacion: `AssistantServiceTest` (10 pruebas), `GeminiClientTest` (8 pruebas), y `node --test frontend/tests/help-content.test.mjs` (14 pruebas), sin fallos. Se reconstruyo y levanto el backend de pruebas y se comprobo el widget contra el proveedor real. No se enviaron documentos ni datos de pacientes. No afirmar que esta prueba certifica OCR o traduccion documental: requieren sus propios recorridos.
