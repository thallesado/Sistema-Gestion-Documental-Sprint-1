# Tareas de Cruz: reportes reales y app móvil

Carga estimada: 9 días. Migración reservada: 044. Lee antes `README.md`.

Orden recomendado: D1, luego G1 y después D3 y G2. G1 es la tarea que más valor da frente al requisito 7.

## Parte 1. Reportes (requisito 4)

### Qué pide el docente

Los reportes tienen cuatro niveles:

1. **Clásicos desde el menú, pero nunca sin una interfaz previa de filtros** (fecha, vendedor, curso...). "Cuantos más filtros, más valor tiene el sistema." No se admite un reporte que sea solo `select *`.
2. **Consultas dinámicas por ejemplo (QBE):** lo hace Edixon (D2).
3. **Analítica o inteligencia de negocios:** tuya (D3).
4. **Voz con un agente de IA:** lo hace Edixon (D4, opcional).

### D1. Reportes reales con filtros obligatorios (P1, 3 días)

#### Qué ya existe

- `features/reportes/pages/reportes-page.ts` con una interfaz de filtros y exportación a CSV, JSON y vista de impresión (`core/utils/export-utils.ts`). Funciona, pero con arreglos fijos de `core/data/report-data.ts`, y el propio pie de página dice que son datos simulados.
- La tabla `report_templates` (`001_schema.sql`) sin entidad ni repositorio.
- Las rutas `/reports`, `/reports/users` y `/reports/workflows` con `sprintEnabled: false`.
- En el backend no existe `ReportController` ni `ReportService`. `DashboardController` solo devuelve tareas, documentos y expedientes recientes. El permiso `report:read` ya existe.

#### Qué implementar

1. `ReportController` y `ReportService` con reportes reales sobre los datos del tenant:
   - documentos por estado, tipo y área;
   - usuarios activos por grupo y actividad;
   - flujos de trabajo por estado y tiempos;
   - expedientes por estado;
   - auditoría por usuario y acción;
   - digitalizaciones OCR (puedes reutilizar `GET /api/v1/ocr/stats`).
2. **Filtros obligatorios:** la API rechaza (400) una petición sin rango de fechas, y acepta además estado, usuario, área y otros según el reporte. Paginación del lado del servidor.
3. Exportación CSV generada en el servidor.
4. Conectar `reportes-page.ts` a la API, eliminar `report-data.ts` y el aviso de "datos simulados", y activar la entrada de menú.
5. Opcional: guardar conjuntos de filtros en `report_templates`.

#### Criterio de aceptación

Cada reporte muestra datos reales del tenant, no permite ejecutarse sin filtro de fechas, y exporta lo que se ve. Sin datos de ejemplo en pantalla. Tests del servicio y del rechazo sin filtros.

### D3. Analítica (P2, 2 días)

#### Qué implementar

1. `AnalyticsService` con agregaciones reales: por mes, por área, tiempos de ciclo de flujos de trabajo, usuarios más activos y aceptación de OCR.
2. Gráficos en `features/reportes/components/report-chart.ts` sobre esos datos. Antes de añadir una librería de gráficos, acordar cuál con el equipo y revisar el tamaño del paquete.
3. Endpoints bajo `/api/v1/reports/analytics/*`.

El docente mencionó librerías de análisis de Python; no es necesario añadir Python, las agregaciones se pueden hacer en SQL desde Java.

#### Criterio de aceptación

Un tablero con al menos cuatro indicadores reales y filtros por período, sin datos fijos.

## Parte 2. App móvil (requisito 7)

### Qué pide el docente

Cada proyecto debe usar la tecnología más conveniente. Una app móvil que repite los formularios de la web "no tendría sentido; lo más que podría tener es justificación". Conviene usar un recurso del dispositivo cuando agrega valor.

### Qué ya existe

- Flutter con cinco pestañas de solo lectura: panel, documentos, tareas, pacientes y perfil (`mobile/lib/screens/*`), con `http` y `flutter_secure_storage`.
- Ninguna capacidad del dispositivo: sin cámara, GPS, biometría ni notificaciones. Solo el permiso de Internet en Android y nada en iOS.
- `mobile/lib/features/*` está vacío.
- En la web, el flujo OCR ya funciona con cámara: `POST /api/v1/ocr/process`, `GET /api/v1/ocr/jobs`, `POST .../validate`, `.../reject`, `.../index`, `PATCH .../metadata` y `GET /api/v1/ocr/stats` (ver `OcrController.java`).

### G1. Digitalización con cámara en el móvil (P1, 3 días)

Es la justificación natural del móvil: fotografiar el papel y digitalizarlo.

1. Dependencia `image_picker` (o `camera`) en `pubspec.yaml` y permisos de cámara en `AndroidManifest.xml` e `Info.plist`.
2. `mobile/lib/core/api/ocr_api.dart` con la subida multipart a `/ocr/process` y las demás llamadas.
3. Pantalla `ScanDocumentPage`: capturar, vista previa, indicador de progreso, resultado con el aviso de revisión cuando el tipo es `OTRO` o la confianza es baja, y acciones validar, rechazar e indexar. Un job `FAILED` se muestra como error con "Reintentar".
4. Lista de digitalizaciones recientes.
5. Una pestaña o botón nuevo en `main_shell_page.dart`.

#### Criterio de aceptación

Desde el teléfono se fotografía un documento, se procesa, se valida y se indexa, y el documento aparece en la web. La imagen se reduce antes de subir para no exceder el límite de 25 MB.

### G2. Móvil sin datos simulados (P2, 1 día)

1. `mobile/lib/core/api/auth_api.dart` devuelve datos de ejemplo cuando falla la red (por ejemplo "Laura Martínez"): mostrar el error real en su lugar.
2. `tasks_tab.dart`: el cambio de estado de una tarea solo cambia la lista en memoria. Conectarlo a un endpoint real de tareas.
3. `documents_tab.dart`: "Descargar archivo" solo muestra un aviso. Usar `GET /api/v1/documents/{id}/versions/{versionId}/content`.
4. Opcional: biometría (`local_auth`) para abrir la app como segunda capacidad del dispositivo.

Andres se encarga de compilar el APK en la integración continua (G3).

## Dependencias y coordinación

- Con Edixon: los reportes fijos viven en `/api/v1/reports/**` y sus consultas dinámicas en `/api/v1/queries/**`. Acordar un formato común de filtros y de paginación.
- Con Oscar: cuando esté `PermissionService`, usar los permisos en la pantalla de reportes.
- No toques `OcrJobService` ni los endpoints de OCR: son de Diego. Si necesitas algo nuevo, pídelo.
- Revisor cruzado: Edixon.
