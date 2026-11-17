# HU-15 - Archivo digital

Verificado el 2026-11-06 en localhost:4200 y API localhost:8080, sobre `main` / `91fb767` más cambios locales. Se reutilizó exclusivamente el tenant sintético preparado para HU-09. Las capturas completas provienen del navegador real, sin simular respuestas ni retocar imágenes.

## Flujo demostrado

1. [Documento vigente en Activos](01-activos.png). Se creó HU15-ARCHIVO con un PDF sintético de 3329 bytes y se recorrieron las transiciones DRAFT → PENDING → IN_REVIEW → APPROVED → CURRENT por API. Alta y carga devolvieron 201; cambios, 200.
2. [Detalle y versión inicial](02-detalle-vigente.png): tipo, código, fechas, referencia, versión, motivo y SHA-256.
3. [Archivar desde la pantalla](03-archivado.png): botón Archivado, PATCH de estado HTTP 200, conservando v1 y metadatos.
4. [Sale del filtro Activos](10-sale-de-activos.png) al cerrar el detalle; no requiere recargar manualmente la página.
5. [Históricos filtrados por tipo y fecha](04-historicos-filtrados.png): incluye el documento archivado. La consulta filtra antes de paginar.
6. [Detalle histórico de solo lectura](05-historico-solo-lectura.png): mantiene referencia y archivo; no ofrece editar metadatos ni subir otra versión. Permite ver y descargar; la acción Vigente restaura a activos.
7. [Visualización real del PDF](06-vista-pdf.png) en otra pestaña. La descarga desde el histórico conservó exactamente el SHA-256 del original.
8. [Usuario sin permiso de archivo](07-sin-permiso-restaurar.png): puede leer y descargar, pero no ve la acción de restauración. Los intentos directos de archivar y restaurar devuelven HTTP 403 incluso teniendo document:update.
9. [Restaurar a Vigente](08-restaurado.png) desde la pantalla: HTTP 200; conserva la misma v1 y habilita continuar el trabajo documental.
10. [Regresa a Activos](09-activos-restaurado.png), con el mismo tipo y rango de fechas. Históricos devuelve cero para este documento después de restaurarlo.

## Cambios implementados

- DocumentSearchFilters y DocumentSearchSpecification: filtro `archiveState=ACTIVE|HISTORICAL`, combinado con tipo, fechas, búsqueda, alcance y tenant. Activos excluye archivados, anulados y papelera. Sin filtro se conservan todos los estados del catálogo general; un valor inválido devuelve 400.
- DocumentService: exige específicamente document:archive tanto para archivar como para restaurar. Conserva If-Match, bloqueo de fila, restricciones de componentes, transiciones y protección de workflow activo.
- DocumentStorageService: rechaza HTTP 409 la carga manual de otra versión sobre un documento archivado, antes de escribir archivos.
- DocumentosPage: filtro de archivo, acciones según permisos, actualización del listado después de cambiar estado, visualización PDF/imágenes y consulta histórica sin controles de modificación. DOCX se descarga.
- Pruebas de archivo y actualización de wiki/contratos. No se necesitó una migración nueva.

## Resultados reales

[Resultados HTTP y estado final](api-results.json). [PDF sintético utilizado](hu15-informe.pdf).

| Comprobación | Resultado |
| --- | --- |
| Archivo / restauración desde Angular | HTTP 200 / 200 |
| Activos estando archivado / tras restaurar | 0 / 1 |
| Históricos estando archivado / tras restaurar | 1 / 0 |
| Históricos + tipo + fecha exacta | 1 documento |
| Archivar o restaurar sin document:archive | HTTP 403 |
| Usuario sin permiso de archivo descarga el PDF | HTTP 200 |
| Subir versión a histórico | HTTP 409, permanece una versión |
| Filtro de archivo desconocido | HTTP 400 |
| Hash original, descarga histórica y descarga restaurada | Idéntico |
| Estado final persistido | CURRENT, v1, reference=REF-HU15 |

SHA-256 comprobado: `e70c2e73c90538778ed7b762ffd688c4faff5e2d47d94996569ea6e200f71340`.

La consulta directa a PostgreSQL confirmó que el documento conserva la fila, la referencia y la única versión, con el mismo checksum. La auditoría registra UPDATE_STATUS con estados anteriores/posteriores para archivar y restaurar.

42 pruebas seleccionadas de backend aprobadas, incluidos cinco casos de archivo: permiso de archivo, permiso de restauración, conservación de versión/metadatos, bloqueo por workflow y rechazo de escritura de archivos históricos. También se ejecutaron las pruebas de búsqueda, tokens de estado, metadatos y componentes. Cuatro comprobaciones estructurales de frontend aprobadas; build Angular y empaquetado backend correctos. Las advertencias de dependencias CommonJS del build siguen presentes. Esto no equivale a ejecutar toda la suite del repositorio.

```text
mvn -pl bootstrap -am test -Dtest=DocumentArchiveTest,DocumentSearchSpecificationTest,DocumentStateTokenTest,DocumentMetadataValidatorTest,DocumentMetadataPersistenceTest,DocumentComponentPermissionTest,HiddenComponentsReadPathsTest,DocumentServiceTest,FormComponentEnforcementTest -Dsurefire.failIfNoSpecifiedTests=false
node --test tests/documents.test.mjs
npm run build
```

## Alcance y límites

La arquitectura guarda registros, metadatos y versiones en PostgreSQL, y los binarios en el volumen central del backend; no guarda los binarios dentro de PostgreSQL. Ambos almacenamientos deben respaldarse. Archivar cambia el estado y no elimina archivos. No se agregó conservación automática ni transferencia entre niveles, que corresponden a HU-16 y HU-17.

El rol de prueba sin archivo tiene document:read, document:update, document:download, document_version:read, configuration:read, user:read y role:read; no tiene document:archive. La lectura de RBAC durante el login local exige role:read en esta preparación: el primer intento sin ese permiso no pudo iniciar sesión. Se documenta la limitación previa sin ampliar esta HU a una modificación de autenticación.

La preparación de HU-09 sigue siendo desechable y no certifica aprovisionamiento automático. Settings del tenant sintético sigue generando un aviso del asistente ajeno al flujo de archivo, que se cerró mediante su botón. El sistema queda ejecutándose localmente con los cambios; no se hizo commit, push ni despliegue en AWS. Para un despliegue persistente se deben reconstruir las imágenes con estos archivos.
