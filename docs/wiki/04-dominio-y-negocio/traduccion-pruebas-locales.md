# HU-27: traducción y cuenta de pruebas locales

> Revisión documental: 2026-11-18. Verificado en `http://localhost:4201`, proyecto Docker `nexodocs-pruebas`. Checkout `4d7c663` más cambios locales. No acredita AWS ni el entorno de puerto 4200.

## Cuenta sintética para probar

Estas credenciales son públicas de demostración, creadas expresamente por petición del usuario. No reutilizarlas en producción ni para datos reales. La cuenta existe únicamente en la base local de pruebas; este documento no la crea automáticamente al clonar el repositorio.

| Campo | Valor |
|---|---|
| Organización | FinoCode |
| Correo | `revisor.hu27@example.com` |
| Usuario | `revisor.hu27` |
| Contraseña de demostración | `DemoTraduccion27!` |
| Nombre | Revisor Traducciones DEMO |
| Rol | Revisor traducciones DEMO |

Se creó mediante `POST /api/v1/roles` y `POST /api/v1/users`, con Laura autenticada. No se insertó directamente en SQL ni se modificó su contraseña.

Permisos efectivos del rol: `translation:read`, `translation:review`, `translation:publish`, `document:read`, `document:create`, `document:update`, `document:download`, `document_version:read`, `document_version:create` y `configuration:read`. No administra usuarios, roles, respaldos ni traducciones nuevas. `configuration:read` permite consultar el catálogo exigido por RLS al crear el derivado; `document:update` es necesario para el bloqueo de documento que usa la carga de su primera versión. Estos permisos también permiten leer configuración y editar documentos accesibles del tenant; no son un permiso exclusivo sobre la copia traducida.

## Recorrido manual

1. Abrir `http://localhost:4201`, iniciar sesión como Laura en FinoCode y entrar en `/translations`.
2. Crear una solicitud sobre un PDF sintético con texto, elegir idiomas diferentes y aceptar el tratamiento externo. El texto se envía a Google.
3. Cerrar sesión y entrar con el revisor indicado arriba. También pueden usarse dos perfiles de navegador independientes.
4. Abrir `http://localhost:4201/translations`, seleccionar la solicitud pendiente, comparar original y traducción, corregir si corresponde y aceptar el bloque.
5. Publicar con un título. Se crea otro documento, con PDF propio y estado documental DRAFT; la revisión editorial no equivale a aprobación institucional.
6. Descargar la copia y consultar el original: conserva su versión y archivo.

Hay una solicitud preparada sobre `DEMO-DOC-003`, español a inglés, en `REVIEW_PENDING`: `1bfa8384-f51e-46f6-945e-9a4718605858`. No se publicó para que el usuario pueda revisarla. Las otras dos pruebas ya publicadas se conservan en el historial.

## Evidencia real de API

[Resultado estructurado](../../evidencias/hu27/resultado-verificacion.json): dos ciclos con `gemini-3.5-flash-lite`, sobre `DEMO-DOC-001` hacia inglés y `DEMO-DOC-002` hacia portugués. Ambos terminaron en `PUBLISHED`; los PDF originales y derivados descargaron con HTTP 200 y cabecera PDF. El SHA-256 del original siguió coincidiendo con el capturado antes de traducir.

Se verificó HTTP 403 al intentar revisar la propia solicitud, HTTP 409 para una revisión con contador antiguo y HTTP 409 al publicar otra vez. Las primeras pruebas de publicación detectaron dependencias de permisos del catálogo y del bloqueo de carga; se ajustó solo el rol sintético y se repitieron los dos recorridos correctamente.

No es una evaluación profesional de calidad lingüística ni una prueba visual de cada clic. Se revisaron respuestas reales de Gemini y controles de API. Los documentos usados son ficticios, sin información de pacientes.

## Funciones y límites

`DocumentTranslationController` expone las solicitudes, revisión y publicación. `DocumentTranslationService.create` verifica archivo y consentimiento y llama a `GeminiClient.generateCompleteText`; `updateSegment` exige otra persona y revisión vigente; `publish` crea documento y primera versión mediante los servicios documentales existentes. `TranslationSourceExtractor` exige PDF con texto verificable. La clave del proveedor no se guarda aquí.

El alcance actual admite PDF con texto de hasta 10 páginas y 20.000 caracteres, revisión en un bloque y publicación de PDF no certificado. DOCX, segmentación granular, reanudación automática y políticas de proveedor configurables por tenant siguen siendo ampliaciones de la [propuesta P06](../07-propuestas/p06-traduccion.md). No declarar esas ampliaciones implementadas por haber pasado estas pruebas.

## Correccion visual de autorrevision

La interfaz ocultaba insuficientemente las acciones: mostraba aceptar y publicar al propio solicitante, aunque el backend rechazaba correctamente con 403. Ahora `TranslationsPage.isRequester` compara el usuario autenticado con `requested_by`; el solicitante ve el motivo y el texto en lectura, sin acciones de revision/publicacion. `editable` impide editar solicitudes terminadas; cancelar exige `translation:create`. El backend conserva sus controles independientes.

Verificado en Chromium real contra 4201 con ambas cuentas: [solicitante sin autorrevision](../../evidencias/hu27/solicitante-sin-autorrevision.png) y [acciones del revisor](../../evidencias/hu27/revisor-acciones.png). La solicitud DEMO-DOC-003 sigue sin publicar; su segmento fue aceptado durante el diagnostico con la cuenta revisora. Puede revisarse nuevamente o publicarse con ella. Compilacion Angular y 224 pruebas frontend aprobadas, una omitida.

## Navegación a la revisión

Al abrir «Revisar y ver segmentos», el foco pasa al panel de revisión después de cargar los segmentos para llevarlo a la vista. El solicitante puede ver el panel y la cuenta revisora autorizada realiza las acciones de revisión.
