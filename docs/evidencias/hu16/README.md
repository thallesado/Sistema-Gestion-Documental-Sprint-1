# HU-16 - Conservación documental

Verificación local del 2026-11-06. Rama main, revisión 91fb767 más cambios locales. Pantalla: http://localhost:4200/settings/retention. Se reutilizó el tenant sintético HU09; no se modificaron documentos de pacientes reales.

## Recorrido con capturas completas

1. [Crear una política](01-crear-politica.png): nombre, 12 meses, acción Transferir y vigencia. POST respondió 201.
2. [Asignarla al tipo documental](02-politica-asignada.png): HU16-RET guarda su política mediante PUT.
3. [Consultar vencidos y próximos a vencer](03-documentos-proximos-y-vencidos.png): HU17-APTO cumplió el 01/01/2025 y HU16-PROXIMO cumple el 20/11/2026. HU17-FUTURO, con cumplimiento el 01/11/2027, no aparece en el horizonte de 30 días.
4. [Editar la política](04-editar-politica.png): cambio de nombre conservando plazo y acción, guardado por API.
5. [Impedir borrar una política asignada](05-bloqueo-politica-asignada.png): HTTP 409; permite desactivarla conservando las referencias.
6. [Eliminar una política sin uso](06-politica-sin-uso-eliminada.png): creada con acción Eliminar, editada a Conservar y eliminada con HTTP 204.
7. [Política de cero meses para la segunda transferencia](07-politica-demostracion-cero-meses.png): preparación explícita y exclusivamente sintética para HU-17, sin adelantar fechas. Luego se restituyó la política anual a HU16-RET.
8. [Lector de configuración](08-lector-solo-consulta-politicas.png): consulta políticas y asignaciones sin botones de creación, edición o eliminación.
9. [Configuración persistente tras recargar](09-configuracion-persistente-final.png): políticas, tipos y vencimientos obtenidos nuevamente del backend.
10. [Conservación indefinida](10-conservacion-indefinida.png): el plazo se deshabilita al elegir esta modalidad. Alta HTTP 201 y edición HTTP 200 conservan el plazo nulo, sin convertirlo en cero.

Las capturas proceden de Chromium controlado por Playwright; no se editaron imágenes ni se simularon respuestas.

## Qué se completó

Se reutilizó retention_policies y la relación de document_types. DocumentRetentionController/Service implementan CRUD, asociación por tipo, vigencia, meses de calendario y consulta de cumplimiento. La pantalla se integró en el menú y la portada de Configuración. Los permisos de configuration y document se verifican en el backend y en RLS, además de reflejarse en los controles.

La conservación indefinida se mantiene explícitamente con plazo nulo; no se transforma en cero al editar. Transferir y Eliminar necesitan un plazo definido. Los valores finitos aceptados son 0 a 1200 meses. Los vencimientos excluyen documentos anulados o en papelera y políticas inactivas o indefinidas, con máximo 500 filas ordenadas por cumplimiento.

La regla previa a eliminar también se conectó a la operación existente de papelera: DocumentService exige document:delete y una política DELETE activa con plazo cumplido. Se comprobó HTTP 409 con una política Transferir y con un plazo futuro; con política Eliminar y plazo cumplido respondió 200 y guardó TRASHED. PostgreSQL conserva la fila: no se implementó borrado físico ni eliminación automática por cron.

## Evidencia técnica

[Resultados HTTP y estado persistido](api-results.json). Se probaron plazos inválidos o ausentes (400), política inexistente/inactiva para transferencia (409), política referenciada al borrar (409), permisos insuficientes (403), disposición anticipada (409) y disposición lógica permitida (200).

49 pruebas seleccionadas de backend aprobadas, incluidas 17 de reglas de conservación y transferencia, cinco de archivo y regresiones de búsqueda, tokens, metadatos y componentes. Build Angular y empaquetado Java correctos. Seis comprobaciones de frontend aprobadas, incluyendo las 97 URLs de navegación contra nginx local; esta última comprueba entrega de HTML, no autenticación de cada módulo.

```text
mvn -pl bootstrap -am test -Dtest=DocumentRetentionTest,DocumentArchiveTest,DocumentSearchSpecificationTest,DocumentStateTokenTest,DocumentMetadataPersistenceTest,DocumentComponentPermissionTest,HiddenComponentsReadPathsTest,DocumentServiceTest,FormComponentEnforcementTest -Dsurefire.failIfNoSpecifiedTests=false
node --test tests/routes.test.mjs tests/documents.test.mjs
```

La migración 090 se aplicó en la base central local y la base sintética, con respaldos previos fuera del repositorio. Se probó además desde un respaldo anterior en una base separada, nexodocs_hu1617_migration_check, y se ejecutó dos veces para comprobar su marca e idempotencia. El worker local recibió el archivo de migración actualizado. No se certifica el aprovisionamiento completo de un tenant nuevo ni el servidor AWS.

Archivos principales: DocumentRetentionController.java, DocumentRetentionService.java, DocumentService.java, DocumentRetentionTest.java, 090_document_retention_transfers.sql, document-retention-api.service.ts, document-retention-page.ts, rutas y navegación. Wiki y contratos de verificación actualizados.

## Alcance

La asignación se hace por tipo y rige para sus documentos. Cambiar una política no reescribe movimientos históricos. El cumplimiento usa ingreso al nivel actual; inicialmente emisión o creación. Se conservan las acciones antiguas REVIEW, ARCHIVE y ANONYMIZE; configurarlas no crea automatizaciones adicionales.

La preparación de HU09 sigue teniendo un aviso de settings ajeno al circuito; se cerró con el botón del asistente. Se preservaron cambios locales previos y de otras tareas. No se hizo commit, push ni despliegue AWS. El runtime local conserva su configuración; para persistir el despliegue deben reconstruirse las imágenes y aplicarse 090 en las bases correspondientes.
