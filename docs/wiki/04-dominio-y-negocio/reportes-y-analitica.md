# Reportes y analítica

> Revisión documental: 2026-10-25. Base de código: `3876454` más los cambios del sprint especial; descripción del código inspeccionado, no certificación de producción.

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

`reportes-page.ts` toma tenant y roles de `AuthService`; no usa datos de demostración. Los gráficos descartan valores no finitos, el botón se llama "Exportar a CSV (Excel)" (no se genera `.xlsx`) y las celdas vacías se muestran como "—". El reporte OCR está en `/reports/ocr`.

Fuentes: [ReportService.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/ReportService.java), [AnalyticsService.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/AnalyticsService.java), [report-data.ts](../../../frontend/src/app/core/data/report-data.ts).
