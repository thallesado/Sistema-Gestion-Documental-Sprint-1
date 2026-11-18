# Reportes y analítica

> Revisión documental: 2026-11-04. Fuente: checkout local 123419c más cambios locales sin commit; código y evidencia revisados para esta página.

## Endpoints

Todos exigen `report:read` y filtran por el tenant autenticado.

- Reportes tabulares: `GET /api/v1/reports/{documents,users,workflows,expedients,audit,ocr}` con `dateFrom` y `dateTo` obligatorios, paginación en servidor y `size` máximo de 200 por página.
- Exportación: `GET /api/v1/reports/{tipo}/export/csv` recorre **todas** las filas filtradas en lotes de 1000. El máximo es `MAX_EXPORT_ROWS = 100_000`; por encima responde 413 con el mensaje "Acote los filtros". La cabecera `X-Report-Total-Rows` informa el total. Las celdas que empiezan con `=`, `+`, `-` o `@` llevan un `'` delante para evitar fórmulas, y el archivo incluye BOM UTF-8.
- Analítica: `GET /api/v1/reports/analytics/{dashboard,summary,monthly,by-area,workflow-cycle-times,top-users,ocr-performance}`. Las fechas se envían como `yyyy-MM-dd` (se interpretan en la zona del tenant) o como instante ISO.

## Zona horaria y privilegios

Las fechas se interpretan y se muestran en `tenants.timezone`, con UTC como respaldo. Los componentes ocultos del formulario de documentos o de usuarios se devuelven como vacíos en las filas y en el CSV (por ejemplo `nombre`, `codigo`, `departamento`, `responsable`); filtrar por un componente oculto responde 403.

## Analítica

`workflowCount` por área sale de una segunda consulta sobre `workflows` y `workflow_documents`. En los usuarios más activos, las acciones auditadas y `documents_created` se calculan con subconsultas por usuario, así que tener varios roles no multiplica los conteos. La agrupación mensual usa `AT TIME ZONE`.

## Frontend

`reportes-page.ts` toma tenant y roles de `AuthService`; no usa datos de demostración. El menú «Documentos» (`/reports/documents`) abre el reporte tabular de documentos. `/reports` sigue en la vista ReportIQ y no muestra esa tabla. Los gráficos descartan valores no finitos, el botón se llama "Exportar a CSV (Excel)" (no se genera `.xlsx`) y las celdas vacías se muestran como "—". El reporte OCR está en `/reports/ocr`.

## QBE y consulta por voz

- `/reports/queries` construye consultas por ejemplo sobre documentos, expedientes, workflows y usuarios. Usa únicamente los endpoints de reportes existentes, rango de fechas requerido, paginación servidor y exportación CSV; los campos disponibles dependen del tipo de reporte y sus permisos por componente. No es un editor SQL ni permite consultas arbitrarias.
- `/reports/voice` acepta dictado del navegador o texto escrito. La aplicación interpreta fechas reales, estados reconocidos y área/departamento mediante una lista acotada; solo envía esos filtros compatibles al endpoint de reportes. El texto/transcripción libre no se manda al backend ni a Gemini. La implementación del navegador puede procesar audio mediante servicios propios del navegador; el usuario debe evitar dictar identificadores o datos clínicos. Si no se reconocen dos fechas válidas en orden, no se consulta.
- El parser de voz no convierte expresiones libres en reglas complejas ni reconoce cualquier campo. Su comportamiento está cubierto por `frontend/tests/report-query.test.mjs`.

Fuentes: [ReportService.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/ReportService.java), [AnalyticsService.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/AnalyticsService.java), [report-data.ts](../../../frontend/src/app/core/data/report-data.ts).

## Consulta guiada y voz (2026-11-04)

QBE permite componer consultas acotadas por entidad/campos y ejecuta el API real con paginacion. La vista de voz reconoce una gramatica limitada de rango de fechas, estado y area; solo envia filtros interpretados al mismo API. La transcripcion libre no se envia al backend ni a Gemini. SpeechRecognition puede usar procesamiento del navegador/proveedor para el audio; no se promete procesamiento local del microfono. report:read se mantiene condicionado a advanced_analytics del plan. Ver [HU-19 a HU-24](sprint-hu19-24.md).

## Conteos por estado sobre todo el filtro (2026-11-15)

`ReportPageResponse` incluye `facets`: conteo por valor de la columna de estado (`result` en auditoría, `status` en el resto), calculado en SQL sobre todo el conjunto filtrado con `GROUP BY` y no solo sobre la página visible. Angular usa `facetCount` y `chartPointsFromFacets` para KPIs y gráficos de estado. Si el campo «estado» está oculto para el usuario en el reporte de usuarios, no se calculan facetas para no revelarlo. Los KPIs sin faceta (áreas, módulos, usuarios con acciones) siguen siendo por página y se etiquetan así. El filtro de workflows usa los valores reales de `workflow_status`.

## Vista embebida ReportIQ (2026-11-17)

`GET /api/v1/reports/embed-config` pide a ReportIQ un token de embebido acotado a la organización del usuario y devuelve la URL del iframe que muestra `reportiq-embed.ts`. Configuración: `REPORTIQ_API_URL`, `REPORTIQ_FRONTEND_URL` y `REPORTIQ_API_KEY`. La clave no tiene valor por defecto ni se guarda en el repositorio: sin ella el endpoint responde 503 y la pantalla muestra «ReportIQ no está configurado». Un usuario sin organización (administrador de plataforma) recibe 403: antes se usaba una organización de demostración fija. Una clave que estuvo en el historial público de las ramas `elkin`, `oscar` y `Cruz` debe considerarse expuesta y rotarse en ReportIQ. Si ReportIQ no responde, el endpoint devuelve 502 «ReportIQ no está disponible en este momento», sin el cuerpo de error de ReportIQ. Un HTTP de error deja solo el código de estado en el log. Una caída de conexión o un parseo deja la excepción en el log del servidor, no en la respuesta. Como el resto de reportes, exige `report:read` (2026-11-18). Fuentes: [ReportEmbedService](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/ReportEmbedService.java), [prueba](../../../backend/bootstrap/src/test/java/com/lta/gestdocum/backend/service/ReportEmbedServiceTest.java).

## Permisos de reportes restituidos (2026-11-18)

La rama de reportes de Elkin (`f933760`) había ampliado `ReportController.REPORT_AUTH` y `AnalyticsController.ANALYTICS_AUTH` a `tenant:manage`, `tenant:update` y `platform:tenant:manage`. Esos permisos no los recorta el plan, así que un administrador de un plan sin `advanced_analytics` abría todos los reportes, incluida la auditoría, y un rol con solo `tenant:update` leía la auditoría completa. Se volvió a `hasAuthority('report:read')` en ambos y en `/reports/embed-config`; el menú web (`nexodocs-data.ts`) también vuelve a pedir solo `report:read`. Pruebas: `ReportAuthorizationTest` evalúa las reglas `@PreAuthorize` reales y `frontend/tests/permissions.test.mjs` el menú.
