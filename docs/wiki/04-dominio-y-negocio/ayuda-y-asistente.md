# Centro de ayuda y asistente contextual

> Revisión documental: 2026-11-04. Fuente: checkout local 123419c más cambios locales sin commit; código y evidencia revisados para esta página.

## Qué hay

- **Centro de ayuda:** panel lateral (botón Ayuda) con artículos y preguntas frecuentes. Cada artículo existe en dos copias que deben mantenerse idénticas: el archivo `frontend/public/assets/help/<id>.md` y el contenido embebido en `help-drawer.ts`. Un test (`frontend/tests/help-content.test.mjs`) vigila que coincidan y que no se afirmen capacidades que el sistema no tiene (por ejemplo, corrección de perspectiva en OCR o etapas paralelas en workflows).
- **Artículos:** `ocr`, `workflows`, `expedientes`, `usuarios-roles`, `primer-uso`, `respaldos`, `privilegios-formulario`, `auditoria` y `apariencia`. El visor solo interpreta los títulos `###` y `####`.
- **Asistente:** widget flotante que usa Gemini a través de `GeminiClient`. Responde solo con lo que figura en `backend/bootstrap/src/main/resources/assistant/manual.md`; si algo no está, lo dice y sugiere el centro de ayuda. El manual cubre respaldos, privilegios por formulario, auditoría y verificación de integridad, apariencia, registro y planes, contraseña temporal, tope de usuarios y bloqueo de login (HTTP 429).

La pregunta libre del usuario **no se reenvía a Gemini**. `AssistantService.safeHelpIntent` solo clasifica localmente el texto en una categoría de ayuda permitida y envía esa frase fija junto al manual y al contexto saneado. UUIDs, query strings, mensajes de error y permisos fuera del formato permitido se eliminan del contexto. Esto reduce exposición accidental de datos clínicos, pero no convierte al widget en un canal para consultar expedientes ni impide que el usuario escriba información sensible en el navegador; la política del navegador para dictado también es independiente.

Las fallas HTTP se registran separadamente como logs técnicos minimizados: ruta sin query/identificadores, código HTTP y clase de excepción; no se guarda cuerpo ni mensaje de excepción.

## Cómo mantenerlo

Al cambiar una pantalla o un permiso, actualizar el artículo, la pregunta frecuente y el manual del asistente en el mismo cambio, con las rutas de menú tal como están en `frontend/src/app/core/data/nexodocs-data.ts`. No describir funciones que no estén en el código: el sistema no corrige perspectiva ni sombras en OCR, no envía correos de bienvenida y sus workflows son secuenciales con un aprobador por etapa.

Fuentes: [help-drawer.ts](../../../frontend/src/app/features/help/components/help-drawer.ts), [manual del asistente](../../../backend/bootstrap/src/main/resources/assistant/manual.md), [AssistantService.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/AssistantService.java).

## Privacidad del prompt al proveedor (2026-11-04)

AssistantService convierte la pregunta libre en una intencion fija allowlist antes de invocar Gemini y filtra el contexto de ruta/permisos. El texto original no se envia, reduciendo el riesgo de que una consulta pegada contenga PII o datos clinicos. La voz del navegador tiene tratamiento separado y dependiente del navegador. Ver [HU-19 a HU-24](sprint-hu19-24.md).
