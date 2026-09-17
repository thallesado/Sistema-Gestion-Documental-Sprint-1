# Base de datos de NexoDocs

PostgreSQL 17 para el SaaS multitenant de gestión documental. El dominio mantiene
49 tablas públicas y 45 tablas con RLS; el registro técnico de migraciones está en
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
| migrate.ps1 | Respaldo y aplicación al servicio local existente. |
| tests/validate.sql | Regresión de integridad, aislamiento y autorización con rollback. |
| tests/run.ps1 | Inicialización, upgrade, errores, login real y concurrencia en Docker temporal. |

No ejecutes docker compose down --volumes para aplicar una migración: ese comando
elimina los datos del volumen.
