# Base de datos de NexoDocs

PostgreSQL 17 para el SaaS multitenant de gestión documental. El dominio mantiene
al menos 49 tablas públicas y 45 tablas con RLS (51/46 tras las extensiones
actuales); el registro técnico de migraciones está en
`app.schema_migrations`. El módulo clínico permanece separado del núcleo documental.

Las decisiones, el contrato para el futuro backend y los límites están en
[DISEÑO_Y_OPERACION.md](../docs/database/DISEÑO_Y_OPERACION.md).

## Iniciar una instalación local nueva

Desde la raíz del repositorio:

```powershell
docker compose up -d --wait
```

Compose publica PostgreSQL en el puerto 5434 por defecto para evitar conflictos con
instalaciones locales de PostgreSQL en 5433. Las variables
están en .env.example. Si necesitas personalizarlas, crea .env antes del primer
inicio; no sobrescribas uno existente. Los usuarios y contraseñas del seed son
exclusivamente de demostración.

### Usuarios demo de Acme Consulting

La migración incremental `015_acme_superadmin_demo_users.sql` añade, de forma
idempotente, seis cuentas con el rol `Superadministrador` (`Andres`, `Edixon`,
`Oscar`, `Diego`, `Denilson` y `Mauricio`) y cuatro cuentas adicionales con los
roles existentes `Supervisor` y `Usuario operativo`. Todas usan el siguiente
valor exclusivamente local de demostración:

- Usuario: el nombre indicado o su correo `.invalid`.
- Contraseña: `DemoPass123!`
- Tenant: `Acme Consulting`
  (`20000000-0000-0000-0000-000000000001`)

| Nombre | Usuario | Rol |
| --- | --- | --- |
| Andres, Edixon, Oscar, Diego, Denilson, Mauricio | `<nombre>.superadmin` | Superadministrador |
| Usuario Supervisor / Prueba Supervisor | `acme.supervisor.test` / `acme.supervisor.test2` | Supervisor |
| Usuario Operativo / Prueba Operativo | `acme.operativo.test` / `acme.operativo.test2` | Usuario operativo |

No reutilices estas credenciales fuera de una base de demostración ni las
consideres secretos de producción. Los hashes se generan con
`crypt(..., gen_salt('bf'))`, compatibles con `BCryptPasswordEncoder`; nunca se
guardan las contraseñas en texto plano.

Los archivos 001, 002 y 003 son la base histórica. Docker ejecuta también 004 en un
volumen vacío. Reiniciar un contenedor con un volumen existente no aplica SQL nuevo.

## Actualizar una base existente conservando los datos

```powershell
powershell -NoProfile -File .\database\migrate.ps1
```

El script obtiene el nombre de la base y del usuario desde el servicio Compose,
genera un respaldo pg_dump en formato custom en database/backups/ y aplica las
migraciones numeradas desde 004. Los respaldos están excluidos de Git.

Cada migración es transaccional y registra su versión. Repetir 004 es seguro.
Si una restricción detecta registros incompatibles, la migración aborta sin
borrarlos: revisa el error y resuelve los datos explícitamente. Las correcciones
posteriores deben incorporarse en una migración 005, 006, etc.; no edites una
migración ya aplicada.

El rol migrador necesita administrar esquema, roles y políticas. No uses el login
normal del backend para migrar. En una base grande planifica una ventana: las nuevas
restricciones e índices necesitan escanear tablas y tomar locks; esta migración
usa lock_timeout de 10 segundos. No se promete una actualización sin bloqueo.

## Ejecutar todas las pruebas en aislamiento

Requiere Docker Desktop funcionando:

```powershell
powershell -NoProfile -File .\database\tests\run.ps1
```

El script crea un contenedor PostgreSQL temporal sin red, sin puertos publicados y
con datos en tmpfs. Verifica instalación Docker desde cero, actualización del
esquema anterior, conservación de registros, repetición de la migración, rollback
ante datos incompatibles, login sin privilegios y dos escritores concurrentes.
Elimina solamente su contenedor al terminar. El resultado final es DATABASE_TESTS_OK.

Para ejecutar las pruebas SQL en la base local existente, usando los valores
predeterminados de usuario/base (ajústalos si los cambiaste):

```powershell
docker compose cp ./database/tests/validate.sql postgres:/tmp/nexodocs-validate.sql
docker compose exec -T postgres psql -X -U nexodocs -d nexodocs -v ON_ERROR_STOP=1 -f /tmp/nexodocs-validate.sql
docker compose exec -T postgres rm -- /tmp/nexodocs-validate.sql
```

Debe aparecer VALIDATION_OK. Las pruebas crean sus propias fixtures dentro de una
transacción y hacen ROLLBACK; no requieren nombres de usuarios del seed. Como en
cualquier transacción PostgreSQL, los valores consumidos de secuencias no se
reutilizan tras el rollback. Prefiere el contenedor aislado para pruebas rutinarias.

## Contrato de conexión del backend

El frontend sigue siendo una demostración sin API ni autenticación real.
El futuro backend debe autenticar al usuario antes de establecer ambos contextos:

```sql
BEGIN;
SET LOCAL ROLE nexodocs_app;
SELECT set_config('app.tenant_id', 'uuid-del-tenant-autorizado', true);
SELECT set_config('app.user_id', 'uuid-del-usuario-autenticado', true);
-- Consultas parametrizadas, comprobación de filas afectadas y manejo de errores.
COMMIT;
```

No basta establecer tenant_id. Las políticas exigen un usuario activo del tenant,
una suscripción TRIAL/ACTIVE/PAST_DUE y el permiso RBAC correspondiente. Una
suscripción PAST_DUE conserva acceso durante la gracia; SUSPENDED/CANCELED no.

El login del backend debe ser un usuario PostgreSQL sin privilegios administrativos
con membresía únicamente en nexodocs_app. Los UUID de contexto no autentican por sí
mismos: cualquiera que controle una conexión SQL puede cambiar esos parámetros.
Nunca entregues esa conexión ni sus credenciales al navegador.

nexodocs_platform_admin es para operaciones globales autorizadas. nexodocs_security
es un rol interno sin login para funciones de autorización, integridad y auditoría;
no lo concedas al backend ni a personas.

## Archivos

| Archivo | Responsabilidad |
| --- | --- |
| init/001_schema.sql | Esquema base histórico. |
| init/002_security.sql | Roles y RLS iniciales, reforzados por 004. |
| init/003_seed.sql | Catálogos y datos exclusivamente de demostración. |
| init/004_saas_hardening.sql | Migración incremental de integridad, permisos, índices y auditoría. |
| init/006_password_recovery.sql | Tokens de recuperación de contraseña de un solo uso. |
| init/007_tenant_user_management.sql | Administración de usuarios, roles y auditoría de tenant. |
| init/008_tenant_status_compatibility.sql | Compatibilidad e integridad de estados de tenants y usuarios. |
| init/009_clinical_domain_extensions.sql | Extensiones para identificadores, antecedentes y cronología de expedientes. |
| init/010_medical_notes.sql | Notas médicas append-only con RLS y permisos clínicos. |
| init/011_persistent_auth_sessions.sql | Sesiones refresh persistentes, rotación y revocación por usuario. |
| init/012_http_access_audit.sql | Registro inmutable de accesos HTTP autenticados, incluidas lecturas. |
| init/013_document_checksum_compatibility.sql | Compatibilidad del checksum documental con Hibernate sin alterar datos. |
| init/014_auth_user_password_hash_privilege.sql | Permite al rol RLS del backend leer únicamente el hash necesario para materializar la entidad de autenticación. |
| init/015_acme_superadmin_demo_users.sql | Usuarios demo de Acme para probar superadministración y permisos por rol. |
| migrate.ps1 | Respaldo y aplicación al servicio local existente. |
| tests/validate.sql | Regresión de integridad, aislamiento y autorización con rollback. |
| tests/run.ps1 | Inicialización, upgrade, errores, login real y concurrencia en Docker temporal. |
| seeds/acme_synthetic_300.sql | Carga explícita, idempotente y no destructiva de 300 pacientes sintéticos de Acme. |
| seeds/load_acme_synthetic.ps1 | Ejecuta la carga y crea/copía los 300 archivos fixture fuera de `database/init`. |

No ejecutes docker compose down --volumes para aplicar una migración: ese comando
elimina los datos del volumen.

### Dataset sintético reproducible de Acme

La carga no se ejecuta automáticamente: `database/seeds/` está fuera de
`database/init/`. Requiere que el esquema esté inicializado y se ejecuta con el
propietario local de demostración (no con `nexodocs_app`, cuyas políticas exigen
un contexto autenticado y permisos RBAC). No borra ni actualiza filas existentes;
usa UUID deterministas y `ON CONFLICT DO NOTHING`, y aborta ante colisiones fuera
del tenant.

```powershell
docker compose up -d --wait
powershell -NoProfile -File .\database\seeds\load_acme_synthetic.ps1 -CopyToDockerStorage
```

La ejecución crea 300 pacientes, una `clinical_history`, un documento, una versión
1 y un vínculo clínico por paciente en Acme Consulting
(`20000000-0000-0000-0000-000000000001`). Los nombres, teléfonos, correos
`.invalid`, identificadores y textos son manifiestamente sintéticos. Los archivos
son pequeños `.txt` diferenciados por secuencia y se copian al volumen del
servicio `backend` únicamente con `-CopyToDockerStorage`; la ruta almacenada en
la base es `synthetic/acme-patients/patient-NNNN.txt`.

Para una EC2 con Compose desplegado, copie `database/seeds/` al host y ejecute
los mismos comandos desde el directorio del despliegue (no exponga PostgreSQL
públicamente ni ejecute el SQL desde el navegador):

```powershell
docker compose up -d --wait
powershell -NoProfile -File .\database\seeds\load_acme_synthetic.ps1 -CopyToDockerStorage
```

El script imprime los cinco conteos esperados: `300` en `patients`,
`clinical_histories`, `documents`, `document_versions` y
`clinical_document_links`. Para validar relaciones adicionalmente:

```powershell
docker compose exec -T postgres psql -X -U nexodocs -d nexodocs -v ON_ERROR_STOP=1 -c "SELECT count(*) AS links_without_history FROM clinical_document_links l LEFT JOIN clinical_histories h ON h.tenant_id=l.tenant_id AND h.id=l.clinical_history_id WHERE l.tenant_id='20000000-0000-0000-0000-000000000001' AND h.id IS NULL; SELECT count(*) AS versions_without_document FROM document_versions v LEFT JOIN documents d ON d.tenant_id=v.tenant_id AND d.id=v.document_id WHERE v.tenant_id='20000000-0000-0000-0000-000000000001' AND d.id IS NULL;"
```

La inserción SQL no puede crear archivos dentro del volumen del backend:
PostgreSQL no tiene acceso a ese filesystem y no se debe inventar una API.
`load_acme_synthetic.ps1` ofrece la alternativa operacional mediante
`docker compose cp`. En EC2, si el backend no está levantado, genere primero
sin `-CopyToDockerStorage` y copie los fixtures cuando el servicio esté
disponible. La carga física real de producción debería usar la API autenticada
de documentos cuando exista un endpoint de subida; esta utilidad queda limitada
a fixtures locales/EC2 controladas.

### Compatibilidad del backend con el rol RLS

Desde `004_saas_hardening`, el backend debe cambiar a `nexodocs_app` dentro de
la transacción y fijar `app.tenant_id` y `app.user_id`. Esa separación revoca
el `SELECT` de tabla completo sobre `users` y conserva solo privilegios por
columna. La entidad JPA actual se carga completa y su consulta incluye
`users.password_hash`; por ello `014_auth_user_password_hash_privilege.sql`
concede únicamente `SELECT` sobre esa columna. El hash nunca forma parte de
las respuestas HTTP. La migración es segura de repetir y se aplica con
`database\migrate.ps1` sobre un volumen existente, sin reinicializarlo.
