# HU-26: archivo físico y gestión de préstamos

> Revisión documental: 2026-11-18. Fuente: checkout `4d7c663` más cambios locales. Pruebas con datos sintéticos, PostgreSQL desechable y navegador real. No certifica una entrega material de papel ni un despliegue en AWS.

## Qué hace el sistema

La ficha representa una unidad física prestable, incluso si no está digitalizada. Su ubicación es jerárquica y su custodio es un usuario activo del tenant. Prestar papel no modifica ni aprueba su PDF. Las cajas funcionan como ubicaciones; no hay préstamos colectivos de cajas y carpetas superpuestas.

La entrada es **Expedientes → Archivo físico**, ruta `/physical-archive`. Al abrir una ficha se muestra su detalle, sin obligar a recorrer nuevamente toda la lista. Los selectores muestran la ruta de ubicación; el historial identifica al actor y muestra condiciones y motivos. Las acciones sensibles usan formularios de confirmación.

## Personas y permisos

| Persona | Permisos del recorrido | Puede hacer |
|---|---|---|
| Consulta | `physical:read` | Consultar fichas e historial del tenant; no registrar movimientos. |
| Solicitante | `physical:read`, `physical:request` | Pedir una unidad disponible y cancelar su propia solicitud o reserva. No confirma recepción ni devolución. |
| Custodio asignado | `physical:read`, `physical:approve`, `physical:handover`, `physical:return` | Reservar/rechazar, confirmar entrega y recibir devolución. No necesita administrar ubicaciones. |
| Administrador del archivo | `physical:read`, `physical:manage`, más el permiso de cada acción | Registrar fichas/ubicaciones y reasignar custodia. Puede actuar por el custodio si además tiene el permiso de la transición. |

Otro usuario con permisos de custodio no puede actuar sobre una ficha de la que no es custodio, salvo que tenga `physical:manage`. La interfaz oculta esas acciones y el backend las vuelve a autorizar. Cancelar exige propiedad de la solicitud o administración del archivo. Las consultas y escrituras están acotadas al tenant; ser administrador de plataforma no concede acceso transversal.

La visibilidad de código/nombre documental también se comprueba en el selector de documentos vinculados. Ocultarlos por permisos de componentes no debe permitir leerlos mediante el módulo físico.

## Recorrido comprobado

1. Un administrador crea una ubicación y una ficha con código, nombre, custodio y condición. El documento o expediente digital son opcionales.
2. El solicitante elige motivo y fecha futura, hasta 90 días. Se registra REQUESTED; el papel sigue AVAILABLE. La misma persona no puede duplicar su solicitud pendiente.
3. El custodio acepta una solicitud: queda RESERVED y el original se bloquea exclusivamente. La reserva dura como máximo 24 horas y nunca supera la fecha de devolución. Dos reservas simultáneas producen un éxito y un conflicto, no dos préstamos activos.
4. El custodio confirma la entrega material y su condición. Solo entonces el préstamo queda HANDED_OVER y el original ON_LOAN. El formulario exige confirmar que la entrega ocurrió; no es una firma legal.
5. El custodio inspecciona la devolución, indica condición y ubicación de retorno y confirma recepción. El préstamo queda RETURNED. La unidad vuelve a AVAILABLE si está completa, o a INCIDENT si hay daños/faltantes.
6. Resolver una incidencia exige motivo, condicion observada y confirmación de la comprobación física. Se actualiza la condicion actual y se conserva la anterior en los movimientos. Para clientes anteriores que solo envian motivo, ese texto se usa como observacion, sin inventar una condicion. La conciliación consulta los préstamos activos: si el papel sigue prestado, conserva ON_LOAN; no lo libera por comodidad.

Una reserva cancelada por su solicitante libera la unidad en la misma transacción. Si vence sin recogida, el worker cancela la reserva. Un préstamo vencido **sigue abierto**: genera avisos internos al solicitante y custodio, como máximo una vez al día, sin declarar devuelto el papel.

## Reasignación e identidad histórica

`POST /api/v1/physical-archive/items/{id}/custodian` recibe `custodianId`, `revision` y `reason`. Exige `physical:manage`, usuario activo de la misma organización y revisión vigente. Registra CUSTODIAN_REASSIGNED sin cambiar el estado del original ni del préstamo. Un custodio anterior deja de poder confirmar movimientos salvo que tenga administración del archivo.

Los nuevos movimientos y préstamos guardan nombres de actor/solicitante como evidencia. Renombrar o desactivar a la persona no modifica esos nombres guardados. Los registros anteriores a la migración 100 no se inventan ni reescriben: se muestra la identidad histórica disponible como alternativa. Los movimientos continúan siendo inmutables.

## Respaldo y restauración

La migración `100_physical_archive_recovery` amplía `app.capture_tenant_backup()` con `_physical_archive`, formato 1. Incluye ubicaciones, fichas, préstamos y movimientos dentro de `snapshot.json`; el ZIP y su manifest conservan sus verificaciones SHA-256. Estas tablas siguen fuera de `app.backup_tables()`, la lista que se borra/rebobina durante la restauración.

`app.restore_tenant_backup()` valida formato, identidad y alcance tenant antes de recuperar evidencia:

- Conserva las filas actuales. Restaurar un respaldo anterior no deshace una entrega posterior ni borra movimientos.
- Recupera únicamente registros faltantes del paquete; no sobrescribe una fila existente con su versión antigua.
- Marca las unidades afectadas como RECONCILIATION_REQUIRED y registra RECOVERED_FOR_RECONCILIATION. Una persona debe comprobar su custodia actual.
- Al conciliar, respeta el préstamo activo. Un préstamo recuperado como entregado vuelve a ON_LOAN, nunca directamente a AVAILABLE.
- Repetir la restauración no duplica movimientos existentes. Identidades ajenas, datos incompletos o conflictos de integridad hacen fallar la transacción; no se adivina el estado del papel.

Los paquetes anteriores a 100 no contienen esta evidencia adicional. El sistema conserva los registros físicos actuales, pero no puede recuperar de ellos información que nunca incluyeron. El recorrido disponible restaura un paquete registrado para el mismo tenant; no agrega un importador público de ZIP a otra instalación. Para un desastre de infraestructura se siguen respaldando PostgreSQL y los volúmenes completos.

También se corrigió `app.backup_schema_signature()`: su resultado ya no depende de los privilegios de columnas del usuario de ejecución. Antes un ZIP creado por una cuenta restringida podía rechazarse después como incompatible. No se reescriben los paquetes antiguos con firmas parciales; deben conservarse para recuperación asistida y generarse respaldos nuevos verificados.

## Funciones y contratos para mantenimiento

| Función | Responsabilidad |
|---|---|
| `PhysicalArchiveService.location()` / `saveItem()` | Ubicaciones y fichas con validación, contexto tenant y auditoría. |
| `request()` | Solicitud y bloqueo acotado mediante `app.physical_request_unit()`. |
| `action()` | Transiciones, propiedad, custodia, fechas y movimientos. |
| `app.physical_release_reservation()` | Libera solo una reserva cancelada autorizada; no concede edición general al solicitante. |
| `app.physical_return_location()` | Valida y bloquea una ubicación activa sin exigir al custodio administrar ubicaciones. |
| `reassign()` | Relevo de custodio con revisión optimista. |
| `resolve()` / `maintenance()` | Conciliación respetando custodia, expiración y avisos diarios. |
| `app.physical_identity_snapshot()` | Nombre guardado al insertar evidencia nueva. |
| `TenantBackupService` | Generación, descarga, verificación del ZIP y restauración asíncrona por API. |

Base HTTP: `/api/v1/physical-archive`. Mantiene `/options`, `/locations`, `/items`, `/items/{id}`, `/items/{id}/requests`, `/loans/{id}/{reserve|reject|cancel|handover|return}`, `/items/{id}/resolve` y `/items/{id}/withdraw`, además de la nueva reasignación. Un conflicto de revisión, estado o reserva responde 409; falta de permiso/custodia, 403; un recurso de otro tenant no se entrega.

## Evidencia visual sintética

Se ejecutaron dos ciclos con cuentas diferentes de solicitante y custodio; un tercer custodio no asignado no recibió acciones de aprobación. Son capturas del sistema, no diseños generados.

1. [Solicitud del primer ciclo](../../evidencias/hu26/01-solicitante-ciclo-1.png).
2. [Reserva confirmada por el custodio](../../evidencias/hu26/02-reserva-ciclo-1.png).
3. [Entrega física registrada](../../evidencias/hu26/03-entrega-ciclo-1.png).
4. [Devolución completa](../../evidencias/hu26/04-devolucion-ciclo-1.png).
5. [Solicitud del segundo ciclo](../../evidencias/hu26/06-solicitante-ciclo-2.png), [reserva](../../evidencias/hu26/07-reserva-ciclo-2.png) y [entrega](../../evidencias/hu26/08-entrega-ciclo-2.png).
6. [Devolución con incidencia](../../evidencias/hu26/09-incidencia.png) y [conciliación](../../evidencias/hu26/10-conciliado-ciclo-2.png).
7. [Vista móvil](../../evidencias/hu26/11-movil-custodio.png) y [custodia reasignada](../../evidencias/hu26/12-custodia-reasignada.png).

## Cómo repetir la verificación

```powershell
pnpm --dir frontend build
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/tests/document-operations.ps1 -Browser
powershell -NoProfile -ExecutionPolicy Bypass -File database/tests/run.ps1
node scripts/validate-wiki.mjs --include-remote
```

La integración usa runtime NOSUPERUSER/NOBYPASSRLS y bases desechables. Incluye cancelación con permisos limitados, exclusión de terceros, revisión obsoleta, identidad inactiva, recordatorios diarios, concurrencia, pérdida simulada de evidencia y restauración, rechazo de contenido de otro tenant y ZIP/restauración por HTTP. Simular pérdida elimina únicamente fixtures de la base desechable; nunca datos del entorno principal.

La navegación se valida en Chromium de escritorio y viewport móvil, no en un teléfono físico. La integración funcional usa tenants de una base de laboratorio; el bootstrap de bases aisladas se comprueba por separado en la suite SQL. Ninguna prueba puede demostrar que una persona entregó realmente un papel: la confirmación sigue siendo responsabilidad del custodio.

## Resultado y entorno local

Verificacion del 2026-11-18: **21 pruebas de integracion, cero fallos/errores/omitidas**, con los dos ciclos de navegador incluidos. La imagen backend completo 558 pruebas declaradas sin fallos (25 omitidas por condiciones de entorno); frontend, 224 aprobadas y una omitida de 225. La suite SQL termino `DATABASE_TESTS_OK`. Los conteos, limites y hashes de las capturas estan en [resultado de verificacion](../../evidencias/hu26/resultado-verificacion.json).

El entorno `nexodocs-pruebas` quedo actualizado en **http://localhost:4201/physical-archive**, con imagenes separadas `nexodocs-hu26-backend`, `nexodocs-hu26-frontend` y `nexodocs-hu26-migrate`. Se respaldaron base y almacenamiento antes de aplicar migraciones; la ubicacion del respaldo privado se conserva en `%TEMP%/nexodocs-hu26-backup-location.txt`. Nunca subirlo a Git.

Se conservaron los 50 documentos sinteticos y 25 originales existentes. Login, listado y detalle dieron HTTP 200 tras actualizar. Un respaldo generado por la API del contenedor termino COMPLETED, valido y compatible; su evidencia fisica contiene 1 ubicacion, 25 fichas, 2 prestamos y 33 movimientos. La restauracion se ejercito en laboratorio desechable, no rebobinando el entorno de demostracion.

El entorno principal de localhost:4200, sus datos y AWS no se modificaron. Los cambios de codigo/documentacion siguen locales sin publicar. Mantener la configuracion y los overrides de Compose del entorno de pruebas al reconstruir; no usar el nombre del proyecto principal para este laboratorio.
