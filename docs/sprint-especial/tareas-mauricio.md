# Tareas de Mauricio: SaaS, marca y ayuda

Carga estimada: 10 días. Migraciones reservadas: 038 y 039. Lee antes `README.md`.

Orden recomendado: A1, luego A2, E2 y A3, y H1 en paralelo (es independiente). A1 es la base de las demás.

## Qué pide el docente

Un sistema universal que sirva a muchas empresas del mismo ámbito, **vendido por suscripción con planes** (básico, intermedio, avanzado). El cliente elige un plan, coloca sus datos, paga y recibe una cuenta con la que empieza a usar el sistema. Esa cuenta es de administrador y administra su espacio según el plan (por ejemplo, un máximo de usuarios).

## A1. Planes y alta de tenant con administrador inicial (P1, 3 días)

### Qué ya existe

- Tablas `plans`, `plan_limits`, `plan_features` y `tenants` (con `plan_id`, `logo_url`, `primary_color`, `subscription_status`, `billing_cycle`, `storage_limit_bytes`) en `001_schema.sql`.
- Planes de ejemplo sembrados (`BASIC`, `PRO`, `ENTERPRISE`) con límites `maxUsers`, `maxStorageMB`, `maxDocuments` y `maxOcrPagesPerMonth` en `003_seed.sql`.
- `TenantController` con listado público, listado, creación y cambio de estado. Rutas `/tenants` y `/tenants/new` en el frontend, sin enlace en el menú.

### Qué falta

- La entidad `Tenant` ignora `plan_id`, el logo, el color y el almacenamiento. No hay entidades de plan.
- Crear un tenant no crea a su administrador: queda una empresa sin nadie que pueda entrar.

### Qué implementar

1. Entidades `Plan`, `PlanLimit` y `PlanFeature`, repositorios y `GET /api/v1/plans` (público, para la página de precios).
2. Mapear en `Tenant` los campos que faltan.
3. Ampliar `TenantCreateRequest` con `planId`, `adminEmail` y `adminName`. Al crear el tenant, en la misma transacción:
   - crear el usuario administrador con contraseña temporal y obligar a cambiarla al entrar;
   - asignarle el rol `Administrador de tenant` (el trigger de la migración 007 exige que el tenant tenga siempre al menos un administrador);
   - enviarle el correo con el acceso, reutilizando la configuración de correo que ya usa la recuperación de contraseña.
4. Frontend: selector de plan en el formulario de tenants y enlace en el menú (la entrada la deja el PR 0).
5. Coordinar con Oscar: el tenant nuevo nace solo con el rol de administrador.

### Criterio de aceptación

El superadministrador crea un tenant eligiendo un plan. El administrador recibe el correo, entra, cambia la contraseña y administra su espacio. Hay tests de la creación completa.

## A2. Límites del plan (P1, 1 día)

### Qué ya existe

Los límites existen solo como datos. Ningún servicio los consulta y la tabla `tenant_usage_monthly` nunca se lee ni se actualiza.

### Qué implementar

1. `PlanLimitService` con comprobaciones para:
   - usuarios (`UserService.createUser`);
   - documentos (`DocumentService.create`);
   - almacenamiento (`DocumentStorageService`, incluido `adoptExistingFile`);
   - páginas de OCR por mes (`OcrJobService.process`).
2. Actualizar los contadores de `tenant_usage_monthly`.
3. `PlanLimitExceededException` con HTTP 402 o 409 y mensaje claro ("Tu plan permite 10 usuarios").
4. `GET /api/v1/tenants/current/usage` y un resumen de uso en la pantalla de administración.

Cada servicio recibe **una sola línea** que llama a `PlanLimitService`. `UserService` lo toca también Oscar y `OcrJobService` es de Diego: avisa antes de editarlos.

### Criterio de aceptación

Con un plan de 3 usuarios, el cuarto es rechazado con un mensaje que nombra el límite. El mismo comportamiento para documentos y almacenamiento, con tests.

## E2. Marca y regionalización (requisito 5, P1, 2 días)

### Qué pide el docente

Un mecanismo de personalización: idiomas, zonas horarias, monedas y colores. El idioma lo hace Edixon (E1); tú haces el resto.

### Qué ya existe

- Las columnas `primary_color` y `logo_url` en `tenants`, y la ruta `/tenants/branding` con `sprintEnabled: false`.
- El color `#087f7b` está fijo en el CSS. No hay API para guardar marca, moneda ni zona horaria.
- `ProfileUpdateRequest` y `NotificationPreferencesRequest` solo guardan nombre, teléfono y avisos.

### Qué implementar

1. Migración 038: `currency`, `timezone`, `date_format` y `default_language` en `tenants`, y `preferred_language` en `users`.
2. `GET/PATCH /api/v1/tenants/current/settings` (solo administrador del tenant): color, logo (subida al almacenamiento), moneda ISO, zona horaria, formato de fecha e idioma por defecto. **Este contrato debe acordarse con Edixon antes de implementarlo.**
3. Frontend: `ThemeService` (el vacío lo deja el PR 0) que al iniciar sesión inyecta variables CSS a partir de los ajustes del tenant, y la pantalla `/settings/appearance`.
4. Pipes `appCurrency` y `appDate` que respeten moneda y zona horaria. Úsalos en las pantallas nuevas y en las existentes solo cuando las toques.

### Criterio de aceptación

El administrador cambia el color y sube un logo: al recargar toda la aplicación usa ese color y logo. Las fechas y los importes se muestran con la moneda y la zona elegidas.

## A3. Suscripción y pago simulado (P2, 2 días)

### Qué implementar

1. Página pública `/planes` (`features/pricing/`) con los planes de `GET /api/v1/plans`.
2. Flujo: elegir plan, datos de la empresa, datos del administrador y pago. El pago es **simulado y debe decirlo claramente en pantalla**. Registrar el intento en una tabla nueva `subscription_payments` (migración 039).
3. Endpoint público `POST /api/v1/public/signup` con límite de peticiones, que reutiliza la creación de tenant de A1. El estado de la suscripción pasa a `TRIAL` o `ACTIVE`.
4. Enlace "Crear cuenta de empresa" en la página de inicio de sesión.

### Criterio de aceptación

Una persona sin cuenta elige un plan, completa los datos, "paga", recibe el correo y entra como administrador de su nueva empresa.

## H1. Centro de ayuda (requisito 8, P2, 2 días)

### Qué ya existe

El botón de ayuda de la barra superior solo muestra un aviso (`notify('Centro de ayuda')` en `shell/app.html`). No hay manual, preguntas frecuentes ni guía de primer uso.

### Qué implementar

1. Un panel lateral de ayuda en `features/help/`, con artículos en archivos Markdown dentro de `assets/help/`: OCR, flujos de trabajo, expedientes, usuarios y roles.
2. Buscador de preguntas frecuentes.
3. Ayuda contextual: según la ruta actual se sugiere el artículo correspondiente.
4. Guía breve de primer uso.
5. Un enlace al asistente que hace Diego (H2).

El único cambio en el shell es conectar el botón de ayuda, y lo deja preparado el PR 0.

### Criterio de aceptación

El botón de ayuda abre el panel, se puede buscar "OCR" y aparece el artículo, y desde la pantalla de digitalización el panel propone su guía.

## Dependencias y coordinación

- A1 antes que A2, A3 y E2.
- Con Oscar: roles del tenant nuevo y `UserService`.
- Con Edixon: contrato de `/tenants/current/settings`.
- Con Diego: `OcrJobService` (límite de páginas) y el enlace con el asistente.
- Revisor cruzado: Oscar.
