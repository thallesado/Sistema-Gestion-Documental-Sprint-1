# Administración de plataforma: ficha de organización y auditoría

> Revisión documental: 2026-10-27. Base `8996d62` más implementación local sin commit (fases 1 a 3 de `plan-implementacion-admin-global.md`, migraciones 062 a 064). Describe código. Verificación 2026-10-27: 062, 063 y 064 se aplicaron (y 064 dos veces, sin efecto la segunda) sobre una copia descartable de la base local de desarrollo (en 061) en un contenedor postgres:17-alpine, con `platform-audit.sql`, `plan-catalog.sql` y `tenant-addons.sql` en verde; la base local en uso y ningún servidor recibieron las migraciones. Una base creada desde cero con `database/init` falla antes, en `005_demo_users.sql` (RLS de `audit_events`), problema anterior a estas fases.

## Principio

El administrador global (cuenta de plataforma: `platformAdmin` sin `tenantId`, autoridad `platform:tenant:manage` de `PlatformAuthorities`) administra el negocio y la plataforma, no el contenido de los tenants. `app.context_is_valid()` sigue excluyendo a las cuentas de plataforma de los datos de las organizaciones; la ficha lee con el usuario de conexión, como `PlatformAnalyticsService`, y solo devuelve números y datos comerciales.

## Auditoría de plataforma (migración 062)

`062_platform_audit.sql` crea `platform_audit_events` (global, sin `tenant_id` obligatorio): actor (`actor_user_id`, `actor_username`), `action`, `tenant_id` afectado, `reason` obligatorio (CHECK de al menos 5 caracteres), `before_state` y `after_state` en JSON, `ip_address` y `occurred_at`. Es inmutable: triggers `trg_platform_audit_events_no_update`, `_no_delete` (con `app.block_mutation()`, como `audit_events`) y `_no_truncate` por sentencia. `nexodocs_app` no tiene privilegios sobre la tabla ni su secuencia.

`PlatformAuditService.record(...)` valida acción (lista cerrada `ACTIONS`) y motivo (`requireReason`, 5 a 1000 caracteres) y escribe dentro de la transacción de la acción: si el registro falla, la acción se revierte. La IP es `getRemoteAddr()` (no `X-Forwarded-For`, falsificable). Acciones registradas: `TENANT_CREATED`, `TENANT_SUSPENDED`, `TENANT_REACTIVATED`, `TENANT_TRIAL_EXTENDED`, `TENANT_PLAN_CHANGED`, `PLATFORM_BACKUP_REQUESTED` (y `TENANT_STATUS_CHANGED` reservada).

## API

| Ruta | Uso |
|---|---|
| `GET /api/v1/platform/tenants/{id}/overview` | Ficha (`PlatformTenantOverviewResponse`) |
| `POST /api/v1/platform/tenants/{id}/status` | `{status: SUSPENDED\|ACTIVE, reason}` |
| `POST /api/v1/platform/tenants/{id}/trial-extension` | `{days: 1..90, reason}` |
| `POST /api/v1/platform/tenants/{id}/plan` | `{planCode, acceptOverLimit, reason}` |
| `GET /api/v1/platform/audit` (+ `/actions`, `/export/csv`) | Filtros `dateFrom`, `dateTo`, `action`, `tenantId`, `actor`; CSV con el límite de 100 000 filas |
| `POST /api/v1/tenants?reason=` | Alta manual; ahora exige motivo |
| `PATCH /api/v1/tenants/{id}/status?value=&reason=` | Compatible; delega en la ficha y exige motivo |
| `POST /api/v1/platform/backups/full?reason=` | Respaldo completo; el registro se escribe antes de encolar |

Todas con `@PreAuthorize("hasAuthority('platform:tenant:manage')")` a nivel de clase y, en el servicio, rechazo de cualquier cuenta con tenant (403). Un administrador de tenant no recibe esa autoridad.

## Reglas de las acciones

- **Suspender:** desde TRIAL, ACTIVE, PAST_DUE o EXPIRED. **Reactivar:** desde SUSPENDED, EXPIRED o CANCELED dentro del período de gracia (`deletion_scheduled_at` futuro y sin `purged_at`); anula el borrado programado (`TenantService.changeStatus`). Una prueba suspendida sin pagos ni Stripe vuelve a TRIAL.
- **Extender la prueba:** solo TRIAL o EXPIRED sin suscripción de Stripe; suma los días a la fecha mayor entre el fin actual y hoy y deja el estado en TRIAL.
- **Cambio de plan manual (cortesía o corrección):** sin cobro y solo sin suscripción de Stripe (Stripe es la fuente de verdad; el webhook revertiría el cambio). Si usuarios, almacenamiento o documentos superan el plan nuevo responde 402 `PLAN_LIMIT_EXCEEDED`; con `acceptOverLimit` se aplica y el exceso queda en `after_state.overLimit`. Anula un cambio programado y concede al grupo administrador los permisos del plan (`grantNewPlanPermissionsToAdminRole`).
- La fila del tenant se bloquea (`for update`) antes de evaluar el estado.

## Datos de la ficha (anexo A)

Resumen (nombre, código, slug, contacto, alta, estado del ciclo de vida: los de la suscripción más `PENDING_DELETION` y `PURGED`), administradores del grupo «Administrador de tenant» (nombre, correo, estado, último acceso), suscripción (plan, ciclo, renovación, cambio programado, no renovar, cancelación, gracia y borrado), uso en números frente a límites (usuarios activos, bytes, documentos, páginas OCR del mes; -1 = ilimitado), últimos 50 pagos de `billing_transactions` e historial: acciones de plataforma más la acción y fecha de los eventos `SUBSCRIPTION_*` y `TENANT_PURGED` de `audit_events` (sin `details`). `PlatformTenantOverviewResponseTest` fija la lista cerrada de campos; agregar uno exige revisarlo contra el anexo A.

## Frontend

`/platform/tenants/:id` (`platform-tenant-page.ts`) y `/platform/audit` (`platform-audit-page.ts`), con `platformAdminGuard`. Reglas puras en `platform-tenant.logic.ts` (motivo, barras de consumo, acciones por estado, confirmación del 402). El listado `/tenants` y la tabla del panel enlazan a la ficha; el alta y el respaldo completo piden motivo. Menú: Panel de plataforma → «Auditoría de plataforma». Textos en `module-text-rows.ts` (es/en/fr/zh).

## Pruebas

`PlatformAuditServiceTest`, `PlatformTenantServiceTest`, `PlatformTenantOverviewResponseTest`, `PlatformRoutesAuthorizationTest`, `frontend/tests/platform-tenant.test.mjs`, y la regresión SQL `scripts/tests/platform-audit.sql` (motivo vacío rechazado, UPDATE/DELETE bloqueados, `nexodocs_app` sin lectura ni escritura).

## Catálogo de planes y precios (migración 063)

`063_plan_catalog.sql` crea `plan_prices` (versiones por plan y ciclo: monto, `stripe_price_id`, `effective_from`, `archived_at`; índice único de una sola versión vigente por plan y ciclo), las columnas de `tenants` `plan_price_id` (versión que paga, fijada por `syncTenant` desde el precio de la suscripción) y `price_change_price_id`/`price_change_at` (migración programada), y `default_role_templates`. La versión inicial copia `plans.price_monthly/price_yearly` sin id de Stripe: hasta crear una versión nueva, Stripe usa las variables `app.stripe.prices.*`. Ninguna tabla da privilegios a `nexodocs_app`.

Vista `/platform/plans` (`platform-plans-page.ts`, menú Tenants → «Planes y precios»); API `GET /api/v1/platform/plans`, `PUT /plans/{id}`, `PUT /plans/{id}/limits`, `PUT /plans/{id}/features`, `POST /plans/{id}/prices`, `POST /plans/prices/{priceId}/migrate` y `/role-templates` (CRUD), todas con motivo y auditadas (`PLAN_*`, `ROLE_TEMPLATE_*`).

- **Datos y venta:** nombre, descripción, orden e `is_active`. `is_active = false` retira el plan del catálogo público, checkout y altas; quien ya lo tiene lo conserva (`syncTenant` busca el plan por código sin exigir que esté activo). BASIC no se puede retirar porque es el plan por defecto.
- **Límites:** las cuatro claves de `plan_limits` (-1 = ilimitado). Bajar un límite que alguna organización ya supera responde 409 `CONFIRMATION_REQUIRED` con las afectadas; con `acceptImpact` se aplica. PlanLimitService no bloquea la operación actual, solo impide crecer.
- **Funcionalidades:** solo las claves existentes de `plan_features` (no se crean desde pantalla). **Discrepancia con el plan:** las funcionalidades de cada plan ya se leían de `plan_features` (`resolveAuthorities` y `app.has_permission` de 048); `PlanFeatureMatrix` solo relaciona permiso → funcionalidad y sigue en código. Retirar una pide confirmación con el número de organizaciones del plan y deja de concederse de inmediato en la base (048) y en el JWT al renovar sesión; activarla concede los permisos nuevos al grupo administrador de cada organización del plan.
- **Precios versionados:** crear una versión llama primero a Stripe (`POST /v1/prices` sobre el Product del precio anterior, o uno nuevo), después guarda la versión, archiva la anterior y actualiza `plans.price_*` en una transacción, y al final archiva el Price anterior en Stripe (`active=false`; sigue cobrando a quien ya lo tiene). Si Stripe falla no se guarda nada; si falla la base se archiva el Price recién creado. Sin Stripe configurado la versión se guarda sin id. La vista muestra cuántas organizaciones pagan cada versión. El MRR del panel usa la versión que paga cada organización.
- **Migración de clientes (opcional):** mueve a la versión vigente a quienes pagan una anterior del mismo plan y ciclo con Stripe. Crea un Subscription Schedule: período actual con su precio, una renovación más si faltan menos de 30 días, y luego el precio nuevo. Avisa con un evento `SUBSCRIPTION_PRICE_CHANGE_SCHEDULED` en la auditoría del tenant, una notificación a sus administradores y un correo. Omite organizaciones con cambio de plan programado, no renovar o migración ya programada. Si el tenant cambia de plan, el schedule se libera y la migración se anula. Los pagos manuales (QR/USDT) siempre se emiten al precio vigente.
- **Grupos por defecto:** `default_role_templates` (sembradas «Consulta» y «Gestor documental»). `TenantService.create` crea esos grupos además de «Administrador de tenant», con los códigos de la plantilla que existen y que el plan habilita. Solo afecta a organizaciones nuevas.
- `/planes` ya no muestra planes de respaldo con precios fijos si falla el catálogo: muestra el error con «Reintentar».

Pruebas: `PlatformPlanServiceTest`, `PlatformRoleTemplateServiceTest`, `StripeBillingPropertiesTest`, `TenantDefaultGroupsTest`, `frontend/tests/platform-plans.test.mjs` y la regresión SQL `scripts/tests/plan-catalog.sql`. **Pendiente:** probar el cambio de precio y la migración con Stripe en modo test.

## Complementos (migración 064)

`064_addons.sql` crea `addons` (catálogo global: recurso `maxUsers`/`maxStorageMB`/`maxOcrPagesPerMonth`, cantidad por unidad, tipo RECURRING o CONSUMABLE, validez en meses, planes en que se ofrece; `nexodocs_app` solo SELECT), `addon_prices` (versiones MONTHLY/ANNUAL para recurrentes y ONE_TIME para consumibles; sin privilegios para `nexodocs_app`) y `tenant_addons` (por tenant, ENABLE/FORCE RLS con `tenant_context` y lectura propia; sin escritura para `nexodocs_app`). Siembra `STORAGE_10GB`, `USERS_5` y `OCR_1000` con precios sin publicar en Stripe. Funciones SECURITY DEFINER: `app.consume_ocr_pack_pages` (descuenta páginas de los paquetes del tenant del contexto, primero los que vencen antes) y `app.grant_addon_from_payment` (crea el complemento desde una orden QR/USDT pagada). Como `app.purge_tenant`, su dueño debe saltarse RLS (superusuario de la migración). **Dependencia de despliegue:** la comprobación de límites lee `tenant_addons`; aplicar 064 antes de desplegar este backend.

- **Límite efectivo:** `EffectiveLimits.effectiveLimit` = límite del plan + complementos recurrentes activos no vencidos (-1 sigue ilimitado). Lo usan `PlanEnforcementService` (usuarios, almacenamiento, cambio de plan), `PlanLimitService` (usuarios, OCR, `/tenants/current/usage`) y la ficha. Los paquetes OCR no suben la cuota mensual: `validateOcrLimit` admite el exceso si alcanza el saldo y `recordOcrUsage` lo descuenta con `app.consume_ocr_pack_pages`.
- **Stripe con varios ítems:** el ítem del plan es el que no tiene `price.metadata.addonCode` (`SubscriptionItems`). `syncTenant`, `periodEnd`, la mejora inmediata, el cambio programado y la migración de precio (063) ya no toman `items.data[0]`, y los schedules conservan los ítems de complementos. Cambiar de ciclo con complementos recurrentes se rechaza (Stripe exige el mismo intervalo en todos los ítems).
- **Compra (`/billing/subscription`, pestaña Complementos; API `/api/v1/billing/addons`, permisos de `TENANT_PLAN_ADMIN`):** solo con suscripción ACTIVE. Recurrente con suscripción de Stripe → `POST /v1/subscription_items` (o más cantidad en el ítem existente) con `proration_behavior=always_invoice`; aparece en la misma factura que el plan. Consumible → Checkout `mode=payment` (`metadata.kind=tenant_addon`), acreditado por el webhook `checkout.session.completed` o por `/billing/addons/checkout/{id}/confirm` al volver, idempotente por `stripe_checkout_id`, y registrado en `billing_transactions`. Sin Stripe → orden QR/USDT de un período (`metadata_json.kind=addon`); al confirmarla `BillingService.confirm` llama a `app.grant_addon_from_payment` en lugar de activar el plan.
- **Reducir o quitar:** solo lo comprado con la suscripción. Se rechaza si el uso actual no cabe sin esas unidades; si cabe, Stripe cambia la cantidad sin prorrateo y `pending_units/pending_at` lo aplican al final del período (`TenantAddonSync.applyDueChanges`, cada 5 minutos, que también marca EXPIRED las cortesías y pagos manuales vencidos). El webhook `customer.subscription.updated` sincroniza unidades: subir rige ya, bajar al fin del período.
- **Sugerencias:** si los complementos cuestan al mes más que la diferencia con el plan siguiente, la pestaña lo indica; si el plan ya cubre el uso de un recurso, se ofrece retirar el complemento.
- **Plataforma:** `/platform/addons` (menú Tenants → Complementos) crea complementos, edita nombre, planes y venta, y versiona precios como en 063 (Stripe primero; «Publicar en Stripe» crea el Price de una versión sembrada). La ficha lista los complementos activos y concede o retira cortesías con motivo y vencimiento (`TENANT_ADDON_GRANTED/REVOKED`). Los límites de uso de la ficha ya los incluyen.

Pruebas: `EffectiveLimitTest`, `TenantAddonSyncTest` (webhook con ítem de plan y de complemento), `TenantAddonServiceTest`, `PlatformAddonServiceTest`, `frontend/tests/addons.test.mjs` y `scripts/tests/tenant-addons.sql`. **Pendiente:** probar en Stripe modo test la compra, la reducción y la factura con plan y complemento; los ingresos por plan del panel cuentan los pagos de complementos en el plan de la organización.

## Pendiente (fases siguientes)

Roles internos de plataforma y MFA (fase 5); hoy toda cuenta de plataforma puede ejecutar todas las acciones. Las acciones de plataforma no se reflejan en la auditoría del propio tenant.

Fuentes: [062_platform_audit.sql](../../../database/init/062_platform_audit.sql), [PlatformAuditService.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/PlatformAuditService.java), [PlatformTenantService.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/PlatformTenantService.java), [PlatformTenantController.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/controller/PlatformTenantController.java), [platform-tenant-page.ts](../../../frontend/src/app/features/platform-admin/pages/platform-tenant-page.ts), [platform-audit-page.ts](../../../frontend/src/app/features/platform-admin/pages/platform-audit-page.ts).
