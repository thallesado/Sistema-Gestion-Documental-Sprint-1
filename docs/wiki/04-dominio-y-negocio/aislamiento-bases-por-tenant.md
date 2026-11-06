# Aislamiento de bases de datos por tenant

> Revisión documental: 2026-11-06. Fuente: checkout local 91fb767 más cambios locales sin commit; código y evidencia verificados para esta página.

## Objetivo acordado

Cada organización nueva debe tener una base PostgreSQL propia. La prueba dura 12 días. Al vencer empieza una gracia de 3 días en modo de solo lectura. Si se paga durante la prueba o la gracia, se conserva esa base y el tenant pasa a activo. Si no paga, la base se elimina después de archivar y verificar la auditoría. Decisión del usuario: el respaldo completo temporal se elimina una vez que se verificó el borrado de la base; el registro de auditoría se conserva en el plano central.

La base central debe limitarse al control del servicio: identidad del tenant, estado de provisión, referencia al nombre de base, fechas del ciclo de vida y eventos de auditoría del ciclo de vida. Los nombres de base se derivan de UUID en servidor y nunca se aceptan desde el cliente.

## Lo implementado en el código

- `database/init/059_tenant_database_lifecycle.sql` agrega un registro de modo `LEGACY_SHARED`/`ISOLATED`, estados de provisión/ciclo de vida, fechas de prueba y gracia, y eventos de ciclo de vida inmutables. Registra tenants existentes como `LEGACY_SHARED`; no mueve ni borra sus datos.
- La misma migración crea `app.tenant_audit_archive`, append-only, para que el proceso futuro copie los eventos y hashes verificados antes de borrar una base. El respaldo temporal no sustituye este archivo de auditoría.
- `database/tenant-bootstrap/migrate-tenant.sh` prepara el esquema de una base nueva y vacía con el catálogo global mínimo, sin seeds de tenants, usuarios, expedientes, pacientes ni cobros demo. Usa una variante de 036 sin los cobros sandbox. La imagen de migraciones incluye este script y `TENANT_DATABASE_BOOTSTRAP=true` lo selecciona explícitamente.
- El alta crea tenant y administrador en el registro compartido y programa el aprovisionamiento tras el commit. El worker serializa por tenant, crea `nexodocs_t_<uuid>`, ejecuta el bootstrap sin seeds demo, copia catálogos y filas del tenant, valida conteos/auditoría y solo entonces elimina sus filas con `tenant_id` del control. Si ya pagó queda `ACTIVE`; en otro caso `TRIAL`. Los errores quedan en `PROVISIONING_FAILED` y se reintentan.
- `TenantTrialLifecyclePolicy` calcula la fecha de vencimiento a los 12 días, el final de gracia a los 15 días y las fases `TRIAL`, `GRACE_READ_ONLY` y `DELETE_ELIGIBLE`.
- `TenantDatabaseName` deriva un identificador `nexodocs_t_<uuid sin guiones>` y rechaza identificadores externos o malformados antes de usarlos como identificadores SQL.
- `TenantTrialEnforcementInterceptor` deja pasar lecturas durante los 3 días de gracia y, desde el día 15, exige pago para las rutas autenticadas del tenant. Las rutas de autenticación y activación de pago siguen disponibles.
- `TenantDatabaseRoutingDataSource` enruta por el tenant firmado en JWT y solo usa otra base cuando el registro central está `ISOLATED` y activo. Login y refresh consultan el estado central antes de conectarse; el selector público omite tenants en provisión o cierre. La opción queda desactivada por defecto.
- `TenantDatabaseLifecycleService` registra rutas centrales para callbacks de pago sin JWT, activa después del commit y pasa a solo lectura al vencer los 12 días de prueba. Después de 3 días sin pago cambia a `DELETING`; una ruta de pago vigente aplaza el borrado.
- `TenantDatabaseDeletionService` procesa `DELETING`/`DELETION_FAILED` de forma serializada: valida cadena y anclas de auditoría, copia al archivo central append-only, crea y verifica un respaldo temporal de la base y los archivos, cierra el pool y borra la base con comprobación de ausencia. Luego elimina archivos del tenant y el respaldo temporal, conserva la metadata central como `EXPIRED` y registra `DELETED`. Los errores se guardan y reintentan; no se declara éxito si falla una verificación.
- El aprovisionamiento exige credenciales administrativas separadas de runtime, usuario runtime `NOSUPERUSER` miembro de `nexodocs_app`, y `TENANT_DATABASE_ROUTING_ENABLED=true`. Ambos switches están apagados por defecto.
- Hay pruebas unitarias de límites temporales y validación del nombre.

## Ensayo local aislado (2026-10-28)

Se creó una instancia PostgreSQL 17 de prueba, sin publicar puertos y con volumen propio, independiente del Compose local existente. La base de control se llamó `BasePruebaTenants`; dentro de esa misma instancia se creó `nexodocs_t_11111111222233334444555555555555` para probar el bootstrap.

- Las migraciones `059_tenant_database_lifecycle` y `060_tenant_payment_routes` constan en `app.schema_migrations`; el control conserva cero tenants de prueba y cero eventos archivados.
- `database/tenant-bootstrap/migrate-tenant.sh` termina de forma idempotente. La base tenant tiene 68 tablas públicas, 52 migraciones y cero filas en `tenants` y `users`; no se cargaron organizaciones ni usuarios demo.
- El rol aislado `nexodocs_runtime` se verificó como login no superusuario y con conexión a la base tenant.
- `mvn --batch-mode --no-transfer-progress -DskipTests clean compile` desde `backend/` compila 302 clases Java. `mvn --batch-mode --no-transfer-progress test` reporta 282 pruebas, cero fallos y dos omitidas.
- Esta evidencia valida SQL de control, bootstrap, compilación y límites unitarios. **No valida** creación/transferencia automáticas, login aislado, cobro/webhook, scheduler, archivo de auditoría durante borrado, limpieza de archivos ni reintentos. No se ejecutó el Compose normal ni se modificó su volumen.

El volumen `nexodocs-BasePruebaTenants-data` y el contenedor `nexodocs-base-prueba-tenants` se dejaron preservados para continuar las pruebas. No se modificó ni reinició el Compose normal ni se tocó su volumen de PostgreSQL.

## Límites importantes actuales

La función está implementada localmente, pero no está habilitada. El backend actual recibe credenciales administrativas para crear, transferir y borrar bases, lo que da a ese proceso acceso privilegiado al plano central; hay que separar el worker administrativo del API runtime o demostrar un rol mínimo que también pueda ejecutar las migraciones y transferir datos antes de producción. El owner de las bases nuevas se asigna a la cuenta administrativa para permitir su borrado; runtime accede por `nexodocs_app`. La migración `059` y el alta no migran tenants existentes; estos continúan `LEGACY_SHARED`. No habilitar en el Compose normal hasta completar el recorrido integral en `BasePruebaTenants` y revisar compatibilidad con trabajos de fondo (auditoría, workflows, respaldos), cobros y almacenamiento. El archivo central de auditoría queda retenido, pero todavía falta exponerlo en la interfaz/herramienta de consulta tras la eliminación del tenant. La eliminación física tiene consecuencias irreversibles aunque exista un archivo temporal verificado; ese recorrido debe ensayarse con un tenant descartable.

Por eso no se debe activar `ISOLATED` ni `TENANT_DATABASE_ROUTING_ENABLED`, ejecutar la migración 059 en producción, borrar bases ni anunciar que cada tenant ya tiene almacenamiento independiente. El script de bootstrap solo puede usarse contra una base nueva, vacía, con nombre `nexodocs_t_<uuid sin guiones>`; no se conecta todavía al flujo de alta. La migración 059 requiere respaldo previo y revisión del estado de la base central.

## Secuencia necesaria antes de activar el aislamiento

1. Ejecutar el recorrido integral solo en `BasePruebaTenants`, con un tenant descartable: signup, copia, nombre de base, datos y acceso runtime.
2. Probar login/JWT y aislamiento entre dos tenants; probar pago en prueba y gracia con callback firmado.
3. Simular vencimiento con fechas controladas: lectura durante gracia, bloqueo de escritura, inicio de borrado, auditoría central inmutable, respaldo temporal verificado, ausencia de la base y borrado del temporal.
4. Probar fallos y reintentos en bootstrap, transferencia, `pg_dump`, auditoría, cierre de pool y limpieza de archivos sin perder eventos.
5. Revisar/adaptar todos los schedulers y repositorios que consultan el esquema tenant antes de habilitar routing en otro entorno.
6. Definir credenciales externas seguras: rol admin limitado a crear/borrar bases y runtime no superusuario; no usar la cuenta postgres para runtime ni subir credenciales a Git.

Kubernetes no es necesario para separar bases lógicas en PostgreSQL. La separación de bases en un mismo clúster mejora el aislamiento lógico, pero sigue compartiendo host, recursos y dominio de fallo; no equivale a instancias PostgreSQL independientes.

## Ensayo actualizado en BasePruebaTenants (2026-10-28)

La prueba se ejecutó únicamente en el contenedor aislado `nexodocs-base-prueba-tenants`, después de generar y validar un dump previo del control. El Compose normal y su volumen no se reiniciaron ni modificaron. El backup de control está fuera del repositorio y se conserva.

- Un tenant sintético se aprovisionó desde una fixture SQL de prueba, no desde el formulario público. El worker creó una base con nombre derivado del UUID, aplicó el bootstrap, copió el tenant, usuario, rol, categoría y departamento, verificó conteos y limpió sus filas operativas del control. El rol runtime pudo conectarse a la base.
- La transferencia encontró y corrigió dos defectos reproducibles: columnas identity `GENERATED ALWAYS` requieren `OVERRIDING SYSTEM VALUE`, y las columnas enum necesitan casts explícitos al copiar con JDBC. La suite Maven quedó en 282 pruebas, cero fallos y dos omitidas.
- El worker avanzó el tenant de `TRIAL` a `GRACE_READ_ONLY` con fechas controladas. El webhook Stripe firmado con secreto sintético falló inicialmente porque el trigger de auditoría no admitía eventos de sistema sin usuario; la migración 062 agrega una política de INSERT restringida al rol no-login `nexodocs_security`. Esa versión del webhook no se volvió a probar con una base nueva después de aplicar la política.
- La eliminación del tenant sintético verificó y archivó su evento de auditoría, creó y validó el respaldo temporal, borró la base y eliminó el temporal. La primera finalización quedó en `DELETION_FAILED`: el trigger no permitía auditoría de sistema y la validación de estados rechazaba `EXPIRED`. Las migraciones 062 y 063 corrigieron esos contratos; el worker reintentó y dejó el estado `DELETED`, el tenant `EXPIRED`, la base ausente y el evento archivado consultable.
- La consulta runtime del conteo del archivo central funcionó. La página reveló ambigüedad entre el parámetro de salida `tenant_id` y la columna; la migración 064 la elimina. Después, el mismo rol runtime devolvió el conteo y la fila histórica archivada.
- El alta pública integral continúa pendiente: con el rol runtime probado no hay permisos para insertar el registro central; con el rol superusuario el trigger de auditoría bloqueaba la operación antes de la migración 062. No se certifica todavía el alta pública ni se recomienda activar aislamiento en otro entorno.
- Se revisaron los schedulers de auditoría externa, workflows, respaldos, aprovisionamiento, ciclo de prueba y borrado. Auditoría, workflows y lifecycle usan contexto de base por tenant; el scheduler de respaldos aún intenta actualizar tablas protegidas con el rol runtime y registra errores de permisos. Falta mover esa recuperación a funciones controladas/worker o conceder permisos mínimos validados antes de activar routing.

## Corrección de permisos runtime (2026-10-28)

La prueba posterior reprodujo la causa: `nexodocs_runtime` no tenía `INSERT` en `public.tenants` por diseño, y las políticas RLS exigían un usuario activo del tenant antes de que ese usuario pudiera existir. Además, las funciones `SECURITY DEFINER` de auditoría/RBAC corrían como `nexodocs_security` bajo `FORCE ROW LEVEL SECURITY`, pero ese rol no tenía políticas de lectura limitadas para el actor/tenant ni una política para insertar auditoría atribuida al actor. Dar `BYPASSRLS` al runtime habría ocultado el defecto y eliminado el aislamiento.

- `065_secure_tenant_onboarding.sql` incorpora `app.create_public_tenant_onboarding`, una función `SECURITY DEFINER` propiedad de `nexodocs_platform_admin`, con ejecución concedida a `nexodocs_app`. Crea únicamente la organización, su primer usuario administrador, rol, permisos filtrados por plan y fija el contexto transaccional. El backend la usa solo cuando el aislamiento por bases está habilitado; el alta compartida conserva el flujo previo.
- `066_backup_runtime_permissions.sql` concede DML por columnas y políticas RLS por tenant/permisos para respaldos, configuración y operaciones de restauración. También añade una función que devuelve al scheduler un actor activo del tenant con el permiso solicitado.
- `067_security_definer_rls_context.sql` habilita a funciones de seguridad a leer el usuario actor y las asignaciones de rol del tenant autenticado, bajo `FORCE RLS`.
- `068_security_definer_audit_actor_insert.sql` autoriza a la función de auditoría a registrar eventos atribuidos solo al usuario y tenant del contexto. Se mantiene la política separada de eventos automáticos actorless de la migración 062.
- `TenantBackupService` ahora establece actor y contexto por tenant durante recuperación y programación. Recorre tenants desde el registro central y no intenta actualizar sus tablas sin identidad.

Ensayo SQL en `BasePruebaTenants`, ejecutado como `nexodocs_runtime` con `SET ROLE nexodocs_runtime` y dentro de una transacción revertida: la función de alta creó tenant/usuario/rol y 101 permisos; `app.context_is_valid()` y `app.has_permission('backup:create')` devolvieron true; se insertaron/actualizaron ajustes, respaldo y restauración con RLS; el scheduler devolvió el usuario esperado. La transacción terminó con `ROLLBACK`, por lo que no dejó ese tenant ni esos respaldos de prueba en la base. Las migraciones 065–068 se aplicaron a `BasePruebaTenants`. Esto prueba la capa SQL bajo runtime, pero todavía no sustituye un recorrido HTTP completo de signup y aprovisionamiento asíncrono.

El checkout ya compila y las 282 pruebas Maven pasan (0 fallos, 2 omitidas). Pendiente: probar el alta pública completa con API + worker desde el rol runtime y probar un respaldo real de archivos a través del endpoint. El pago queda expresamente fuera de esta corrección.

Comprobaciones ejecutadas desde `backend/`: compilación Maven limpia; suite Maven con 282 pruebas, 0 fallos, 2 omitidas; construcción de imagen backend aislada. El contenedor PostgreSQL de prueba y su volumen se dejaron preservados; los contenedores API/worker temporales se retiraron. No se hizo migración de tenants existentes (punto 6).

## Correcciones adicionales de auditoría y login (2026-10-28)

El primer recorrido HTTP real en `BasePruebaTenants` registró el tenant de prueba, pero el worker lo rechazó con `TENANT_AUDIT_CHAIN_INVALID`. La consulta de la cadena mostró que cada evento tenía `chain_seq = 1`: el trigger `SECURITY DEFINER` tenía permiso de columna para leer el hash, pero `FORCE ROW LEVEL SECURITY` le ocultaba los eslabones anteriores. La migración `069_audit_chain_rls_visibility.sql` añade lectura de solo `tenant_id`, `chain_seq` y `record_hash` para el tenant de contexto del rol no-login `nexodocs_security`. No concede `BYPASSRLS` ni acceso general a filas auditadas.

Tras esa corrección, el worker aprovisionó un tenant sintético en estado `TRIAL` y creó su base derivada del UUID. El login HTTP todavía devolvió 401: RLS ocultaba la fila del usuario antes de poder validar su contraseña. La migración `070_isolated_tenant_login.sql` incorpora una función de consulta de una identidad por tenant/identificador, propiedad de `nexodocs_security`, con permisos de columna limitados. `AuthService` ejecuta esa búsqueda dentro de una transacción enrutada a la base seleccionada, pasa al rol `nexodocs_app` y resuelve autoridades/sesiones con el contexto RLS del usuario. `AuthenticationAuditService` mantiene el contexto de base durante el registro exitoso de autenticación.

Verificación SQL con `nexodocs_runtime`: la función de login devolvió solo el usuario solicitado, y después de fijar el contexto `nexodocs_app` pudo leer la relación de roles/permisos (61 asignaciones); la transacción se revirtió. La cadena nueva se validó con hashes y secuencias consecutivas dentro de una transacción revertida. En ese punto aún faltaba repetir el flujo HTTP con la imagen reconstruida; los resultados posteriores aparecen en la subsección siguiente. Las filas y la base del tenant sintético previo se conservan como evidencia; no se tocaron tenants reales ni el Compose normal.

### Recorrido HTTP posterior a las correcciones

Con la imagen backend reconstruida y el worker temporal en la red exclusiva de prueba, `/api/v1/public/onboarding` respondió HTTP 200. El tenant sintético `ff34dbcb-1c35-4e9e-aa1e-2346ff4139d3` terminó `TRIAL` en `nexodocs_t_ff34dbcb1c354e9eaa1e2346ff4139d3`; la base recibió las migraciones 069 y 070 y un usuario inicial. El inicio de sesión directo respondió HTTP 200 y devolvió 61 permisos efectivos. La lectura de `/api/v1/backups` y la creación manual también funcionaron con el rol runtime; el respaldo llegó a `COMPLETED` con checksum.

La cadena de auditoría de esa base contiene 87 eventos, secuencias 1–87 y cero filas inválidas según la recomputación de hash. Incluye `HTTP_POST`, `BACKUP_STARTED` y `BACKUP_COMPLETED`. La comprobación de catálogo confirmó que `nexodocs_runtime` sigue siendo `NOSUPERUSER`, `NOBYPASSRLS`, miembro de `nexodocs_app`, no miembro de `nexodocs_platform_admin`, sin `INSERT` directo en `public.tenants`, pero con ejecución de la rutina de alta. El tenant y los respaldos son sintéticos y se mantienen solo en `BasePruebaTenants`. Los contenedores de API/worker de prueba se retiraron al terminar, conservando el contenedor y volumen de PostgreSQL de prueba y los archivos ZIP sintéticos fuera del repositorio. Un tenant previo de prueba, creado antes de corregir el trigger, permanece registrado en `PROVISIONING_FAILED` por su cadena histórica inválida; sus eventos inmutables no se reescribieron. No se probó ni alteró el pago.

## Verificacion consolidada local (2026-10-29)

- Se genero un dump nuevo de `BasePruebaTenants` en `%TEMP%/BasePruebaTenants-pre-tenant-lifecycle-20261029.dump`; `pg_restore --list` lo pudo leer antes del recorrido.
- `mvn -f backend/pom.xml clean test`: 282 pruebas, 0 fallas, 2 omitidas. `docker build` del backend tambien completo `clean package` con el mismo resultado.
- El alta HTTP creo una base independiente en estado `TRIAL`; el login devolvio 61 permisos. Dos JWT de tenants distintos resolvieron `/api/v1/auth/me` a su propio tenant y usuario.
- En un tenant sintetico, las fechas aceleradas en el registro central produjeron `GRACE_READ_ONLY`; `GET /api/v1/backups` respondio 200 y `POST /api/v1/backups` fue bloqueado con 402.
- En otro tenant sintetico con cadena valida, se avanzo el registro por gracia y vencimiento. El worker verifico y archivo 82 eventos inmutables, registro `DATABASE_ARCHIVED`/`DATABASE_DELETED`, elimino la base y los archivos/respaldo temporales; estado final `DELETED` y cero bases con ese nombre.
- Un ensayo separado quedo en `DELETION_FAILED` con `TENANT_AUDIT_CHAIN_INVALID` despues de cambiar directamente la fecha del tenant como superusuario, sin contexto de usuario. La comprobacion impidio el borrado; el registro y la base se conservan sin reescribir auditoria. Los cambios administrativos directos deben ejecutarse con contexto auditado.
- El sondeo de reintentos de aprovisionamiento se fija cada 30 segundos (primer sondeo a 5 segundos), dentro de la espera de 3 minutos del alta. Los errores `TENANT_AUDIT_CHAIN_INVALID` se excluyen del reintento automatico porque requieren revision manual de integridad.
- Se retiraron los contenedores temporales de aceptacion; el contenedor/volumen `BasePruebaTenants` y el Compose normal siguen activos. No se modifico ni elimino la base central de prueba.

### Pendientes antes de produccion

- Cambiar la cuenta superusuario usada por el worker de prueba por credenciales administrativas dedicadas y validar privilegios minimos. Runtime si se verifico como `NOSUPERUSER`/`NOBYPASSRLS`.
- Probar el pago/webhook firmado y definir que pasa con cobros en curso y reintentos.
- Definir la migracion de tenants existentes `LEGACY_SHARED`; las pruebas cubren tenants nuevos sinteticos.
- Revisar recursos compartidos y schedulers restantes con routing activo, y fijar aislamiento/limpieza de archivos en almacenamiento persistente.
- Ejecutar una prueba de recuperacion desde el dump antes de certificar la restauracion.
- No ejecutar estas migraciones ni habilitar los switches en la base principal hasta una instruccion expresa y respaldo actualizado.

## Fuentes

- [PostgreSQL `CREATE DATABASE`](https://www.postgresql.org/docs/17/sql-createdatabase.html): crear base requiere una operación fuera de una transacción ordinaria.
- [PostgreSQL `DROP DATABASE`](https://www.postgresql.org/docs/17/sql-dropdatabase.html): no se puede borrar la base actualmente conectada; la eliminación es irreversible y requiere controlar conexiones activas.
- [Migrador actual](../../../infrastructure/docker/migrate.sh): salta 001–003 y ejecuta las demás migraciones sobre una única `PGDATABASE`.
- [Alta actual](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/TenantService.java): crea tenant, usuario, roles, permisos y catálogos en el recorrido compartido existente.

## Auditoría de accesos al tenant (2026-10-30)

En `BasePruebaTenants` se revisaron las cuatro bases aisladas en estado `TRIAL`. `nexodocs_runtime` está habilitado para login, sin `SUPERUSER`, `BYPASSRLS`, `CREATEDB` ni `CREATEROLE`, y es miembro de `nexodocs_app`. En cada base, bajo `SET ROLE nexodocs_runtime` y luego `SET ROLE nexodocs_app`, se confirmaron `CONNECT`/uso de esquemas, ejecución de `lookup_tenant_login` y `has_permission`, lectura de roles/permisos y datos documentales, y escritura de sesión. El lookup encontró una identidad activa por tenant; el contexto resultó válido y `document:read`, `expedient:read` y `backup:read` fueron autorizados. Las consultas de filas de otro tenant devolvieron cero. El login HTTP del tenant sintético `d79cbd5d-c0be-4276-8fac-91d4c5446346` ya había respondido correctamente durante el ensayo backend anterior.

Se endureció `TenantDatabaseProvisioningService`: ahora exige que runtime tampoco tenga `BYPASSRLS`, abre una conexión al nombre de base recién creada usando las credenciales runtime ya configuradas y comprueba el rol `nexodocs_app` y los permisos mínimos de login, RBAC, sesiones y lectura antes de transferir datos. Ninguna contraseña se registra. La compilación y las pruebas Maven posteriores pasaron: 282 pruebas, 0 fallos/errores y 2 omitidas por opt-in.

Límites de esta auditoría: el control `BasePruebaTenants` contiene cuatro tenants `TRIAL` aislados, pero ningún `LEGACY_SHARED`, así que no se validó aquí la ruta de tenants antiguos. La base principal del Compose local no tiene todavía `app.tenant_database_registry` (migración 059), y no fue modificada. Dos fixtures sintéticas permanecen bloqueadas en `PROVISIONING_FAILED`/`DELETION_FAILED` por `TENANT_AUDIT_CHAIN_INVALID`; no se alteraron sus cadenas de auditoría. El worker de prueba fue configurado con rol superusuario, por lo que la cuenta administrativa mínima para producción sigue pendiente. El Compose normal conserva routing/aislamiento desactivados por defecto y el worker usa el perfil `tenant-isolation`; no se activaron ni desplegaron estos cambios.


## Estado verificado 2026-10-30

El runner se ejecut? hasta `077_backup_scheduler_schema_access` sobre una copia temporal restaurada, sin colisi?n entre migraciones con prefijo `059` y `060`. En esta revisi?n no se aplicaron migraciones a la base Compose principal ni a `BasePruebaTenants`. Los tests unitarios de nombres y ciclo de vida pasaron dentro de la suite backend. El worker a?n no est? certificado con un rol administrativo restringido; la prueba previa de onboarding us? superusuario. El Compose normal mantiene routing/provisioning apagados por defecto, as? que las altas no crean bases aisladas hasta habilitar las migraciones, el routing y el worker en un entorno preparado.


## Arranque local tras la auditor?a (2026-10-30)

Antes de reconstruir se gener? y valid? un dump `pg_dump -Fc` de la base Compose `nexodocs`. El servicio `migrate` aplic? las migraciones pendientes hasta `077_backup_scheduler_schema_access`; `BasePruebaTenants` no se modific?. El backend y frontend locales quedaron arriba en los puertos 8080 y 4200. Se corrigi? que la consulta de auditor?a archivada solo se registre cuando `app.tenant-databases.routing-enabled=true`, porque depende del `controlDataSource` que crea la configuraci?n de routing. Con el switch apagado, el backend ahora inicia con la base compartida. El provisioning y routing siguen desactivados en el Compose normal.

## Activación local y prueba de alta automática (2026-11-04)

Esta sección corrige el estado anterior, que quedó desactualizado. Solo describe el Compose local de pruebas; no se cambió AWS ni producción. Antes de operar se validó el dump de `nexodocs` guardado en `%TEMP%\NexoDocs-backups-20261104\nexodocs-before-tenant-isolation-20261104-005004.dump`. `BasePruebaTenants` y sus volúmenes no se tocaron.

- El `.env` local habilita routing, aislamiento y provisioning; el perfil `tenant-isolation` levanta `tenant-worker`. Backend y worker usan `nexodocs_runtime` para datos y `nexodocs_tenant_provisioner` para crear bases y ejecutar el bootstrap. Runtime está configurado sin `SUPERUSER` ni `BYPASSRLS`; el aprovisionador sí necesita `CREATEDB` y `BYPASSRLS` para la transferencia privilegiada. Estos permisos y credenciales son exclusivamente locales y no certifican una configuración de producción.
- Se completó la migración del tenant de prueba `Prueba Miercoles Tenant` a `nexodocs_t_506221efa88d47488c18553dbb9985b3`. Se copiaron y compararon filas en 67 tablas tenant; después se archivaron 119 eventos de auditoría y se eliminaron las filas operativas del tenant compartido. El tenant quedó `ISOLATED / TRIAL`. La cadena en la base nueva se comprobó con cero eventos inválidos; contiene dos eventos posteriores de respaldos automáticos que no existían al momento del archivo de corte.
- `Clínica Central` y `FinoCode` permanecen `LEGACY_SHARED`; no se movieron ni editaron sus datos. Las cuentas/organizaciones de prueba no son producción.
- Se probó además el alta pública real contra `http://localhost:8080/api/v1/public/onboarding`. La API devolvió sesión y `GET /api/v1/auth/me` respondió con el usuario y tenant recién creados, verificando que el login posterior al alta ya enrutó a su base aislada. El tenant sintético local quedó registrado como `ISOLATED / TRIAL`; el correo usa el dominio reservado `.invalid`, no se envió correo real.
- La conexión del rol runtime a la base aislada y su cambio a `nexodocs_app` funcionaron. Se comprobaron los permisos de esquema, lookup de login, RLS/RBAC, lectura de roles y tipos documentales, y escritura de sesión. La concesión de lectura de `public.default_role_templates` al grupo de aplicación se versionó en `078_tenant_onboarding_role_templates`; el catálogo sigue sin permisos de escritura para ese grupo.
- El bootstrap aislado aplica `060_user_customizations` y `061_subscription_lifecycle`, usa una variante tenant-safe de `059_stripe_subscription_billing` para mantener los campos de suscripción locales y omitir `tenant_signups` (que sigue siendo central), y omite las migraciones centrales de registro/archivo de auditoría `059_tenant_database_lifecycle`, `066` y `069`. También normaliza a `MEDIUM` valores históricos nulos de `permissions.criticality` solo al copiarlos al destino.

La prueba de onboarding descubrió que la revocación de lectura de `default_role_templates` en 063 abortaba la transacción de alta. La migración 078 concede únicamente `SELECT` a `nexodocs_app`, requerido por `TenantService.createDefaultGroups`; no concede modificaciones de plantillas.

Los contenedores locales quedaron arriba: frontend `4200`, backend `8080`, PostgreSQL `5434`; `tenant-worker` está activo. La verificación HTTP de frontend dio 200. `/actuator/health` respondió 401 porque está protegido, por lo que no se cuenta como comprobación de salud pública. La suite Maven pasó durante la reconstrucción del backend: 366 pruebas, cero fallos/errores y dos omitidas.

Al ejecutar Compose desde el repositorio, indicar explícitamente `--project-directory <raíz-del-repo> --env-file <raíz-del-repo>/.env -f <raíz-del-repo>/infrastructure/docker-compose.yml`. En 2026-11-04 se comprobó que omitir `--env-file` hizo que Compose usara credenciales por defecto, distintas de las del volumen PostgreSQL; fallaron el migrador y backend antes de aplicar SQL. Tras respaldar las cuatro bases, se alinearon los roles con el `.env` existente y el migrador quedó al día. El backend debe usar `nexodocs_runtime`; `nexodocs` queda para migraciones locales.

### Aún pendiente antes de producción

- Ensayar alta pública desde una sesión limpia tras el último rebuild y revisar login con credenciales de prueba por el flujo funcional de interfaz. El onboarding HTTP del 4 de noviembre sí completó y `GET /auth/me` verificó el enrutamiento.
- Definir rotación/almacenamiento administrado de credenciales del aprovisionador y revisar privilegios mínimos fuera del entorno local. No trasladar las credenciales locales a AWS.
- Probar pago/webhook firmado, cierre de gracia/borrado, recuperación de backups en una base tenant aislada, y almacenamiento de archivos por tenant.
- Auditar la cobertura de schedulers y el proceso de actualización de migraciones de tenants ya aislados. La activación local no es certificación operacional ni aprobación para producción.
- Mantener a los tenants existentes en `LEGACY_SHARED` hasta una migración separada, respaldada y autorizada.

**Límite del aprovisionador local:** `nexodocs_tenant_provisioner` también tiene `ADMIN OPTION` de `nexodocs_security`, necesario porque la migración heredada 004 reasigna ownership a ese rol. Esto no lo vuelve superusuario, pero amplía sus facultades; antes de producción se debe eliminar ese requisito del bootstrap o diseñar una credencial/mecanismo de migración con privilegios menores. No reutilizar ese rol local en AWS.

## Preparación pendiente de permisos para AWS

Estos son requisitos para una futura configuración de despliegue; no se han aplicado a AWS y no autorizan el despliegue:

- Separar la identidad de ejecución de la API de la identidad de aprovisionamiento. El rol PostgreSQL de runtime debe ser `LOGIN`, no superusuario, sin `CREATEDB`, `CREATEROLE` ni `BYPASSRLS`, y tener solo los permisos de aplicación/RLS necesarios.
- El aprovisionador debe usar una credencial dedicada y limitada a crear/asignar/quitar únicamente las bases aisladas del servicio y a ejecutar el bootstrap necesario. La configuración local actual (`CREATEDB`, `BYPASSRLS` y `ADMIN OPTION` sobre `nexodocs_security`) es una excepción de desarrollo por revisar; no es un modelo de privilegio mínimo para AWS. Antes de producción hay que resolver la reasignación de ownership de la migración 004 y demostrar el ciclo completo con la cuenta restringida.
- No guardar contraseñas en Git ni en el archivo Compose. En AWS, guardar credenciales en AWS Secrets Manager y permitir que la identidad de la instancia/servicio lea solo los secretos requeridos; si el secreto usa una clave KMS administrada por el cliente, limitar también `kms:Decrypt` a esa clave. No conceder permisos generales de administración de Secrets Manager o KMS. Definir y probar el mecanismo de inyección en runtime para EC2/Docker Compose antes del despliegue; no imprimir valores en logs.
- Mantener secretos distintos para runtime y aprovisionamiento, documentar su rotación y auditar el acceso. No reutilizar las credenciales locales ni crear claves IAM de larga duración para la aplicación.
- Revisar el grupo de seguridad, acceso al host y permisos de backup/migración aparte de los permisos PostgreSQL. Solo abrir puertos públicos necesarios; el acceso administrativo debe limitarse a los orígenes autorizados.

La lista de variables y roles no debe incluir sus valores. La política IAM exacta depende de los ARNs de secretos/KMS y de cómo se ejecute el servicio; se debe generar y revisar cuando se prepare ese despliegue, sin usar políticas comodín.

## Auditoria local y correcciones del 2026-11-06

- El servicio backend no recibe credenciales administrativas ni ejecuta aprovisionamiento: Compose fija TENANT_DATABASE_PROVISIONING_ENABLED=false. tenant-worker es el unico servicio que recibe las credenciales y esta dentro del perfil tenant-isolation. Provisioning, lifecycle, deletion y schema migration estan restringidos al perfil Java tenant-worker.
- TenantDatabaseMigrationService revisa periodicamente las bases TRIAL, GRACE_READ_ONLY o ACTIVE y aplica migraciones tenant-safe pendientes. Excluye por nombre completo la migracion central 059_tenant_database_lifecycle y conserva la variante tenant-safe 059_stripe_subscription_billing. El bootstrap aislado tampoco instala el registro central.
- Login y refresh consultan el registro de control antes de resolver el usuario aislado. Recuperacion y reset llevan el UUID del tenant; el servidor lo compara con el tenant del token. La migracion 087_secure_recovery_tenant_scope fuerza RLS para auth_sessions y password_recovery_requests.
- Se generaron y verificaron respaldos de las cuatro bases antes de migrar. La migracion 087 se aplico a la base central y las tres bases aisladas locales; auth_sessions y password_recovery_requests tienen RLS y FORCE RLS activos en las cuatro. Las pruebas de integracion se ejecutaron en una clonacion efimera tmpfs; los datos persistentes no se usaron como fixture destructivo.
- Runtime: nexodocs_runtime no tiene SUPERUSER, BYPASSRLS ni CREATEDB; conecto a las tres bases aisladas. Pruebas de contexto tenant valido y contexto cruzado fallido se ejecutaron en transacciones revertidas.
- Pruebas finales locales: Maven 422, 0 fallos, 0 errores y 3 omitidas; TypeScript typecheck correcto; frontend 211 (210 correctas, 1 omitida); PostgreSQL temporal DATABASE_TESTS_OK; Compose con backend, frontend, PostgreSQL y tenant-worker activos.
- Limites: el rol nexodocs_tenant_provisioner del worker conserva CREATEDB y BYPASSRLS porque copia/migra/elimina bases; no se probo reducir esos privilegios con un API administrativo seguro. revoked_access_tokens se consulta antes del contexto de login y audit_anchors admite cadenas globales y por tenant; ambos siguen sin RLS, una excepcion de superficie que falta encapsular con funciones restringidas. No se cambiaron permisos de forma especulativa.
- No se certifican aun reset con SMTP real, matriz completa de permisos por modulo, signup y ciclo de vida aislado por HTTP, webhook de pagos, dos schedulers, navegador de voz ni despliegue AWS. El apk debug compila y 41 tests Flutter pasan; no hay firma privada local para producir APK release.
