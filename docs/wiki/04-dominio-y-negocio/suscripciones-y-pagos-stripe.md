# Suscripciones y pagos recurrentes con Stripe

> Revisión documental: 2026-10-27. Base `3f80c45` más implementación local sin commit (ciclo de vida de la suscripción, migración 061). Describe código; no acredita claves, precios ni webhook configurados en ningún servidor.

## Modelo

NexoDocs no cobra ni guarda tarjetas. **Stripe Billing** cobra el primer pago en Stripe Checkout (`mode=subscription`), guarda el medio de pago, renueva cada período y reintenta los cobros fallidos. El backend crea sesiones y refleja en PostgreSQL lo que informan los webhooks firmados. No hay cron de cobro.

El navegador envía solo `planCode` y `billingPeriod`. El `price_...` se resuelve en `StripeBillingProperties` desde variables de entorno; nunca se acepta un precio del cliente. Un plan o ciclo sin precio configurado responde 503. BASIC, PRO y ENTERPRISE se compran igual, sin pasar por ventas: la bienvenida, el registro, `/billing` y el modal de cambio de plan ya no desvían Enterprise a `/plans/contact-sales` (la página sigue existiendo para consultas comerciales).

## Compra directa (alta pública)

1. `/planes` recoge organización, correo, administrador y contraseña («Comenzar ahora» en la bienvenida lleva ahí). `/register` es solo la solicitud de demo: crea una organización de prueba gratuita de 12 días por `/public/onboarding`, sin pago; `/planes` enlaza a ella desde cada plan.
2. `POST /api/v1/public/subscriptions/checkout` (público, con el límite de `public-signup`) guarda una fila `tenant_signups` en `PENDING` con la contraseña como hash BCrypt y devuelve la URL de Checkout. El metadata de Stripe solo lleva `kind=tenant_signup`, `signupId`, plan y ciclo.
3. Al pagar, `checkout.session.completed` (o `async_payment_succeeded`) llega a `POST /api/v1/billing/webhooks/stripe`. Un claim atómico pasa el alta a `PROVISIONING`; `TenantService.createWithPasswordHash` crea organización, administrador, rol, permisos y catálogos por el recorrido habitual. El tenant queda `ACTIVE` con `stripe_customer_id`, `stripe_subscription_id`, período de Stripe y la primera factura en `billing_transactions`. El alta pasa a `COMPLETED` y se vacía el hash.
4. `/planes/exito?session_id=...` consulta `GET /api/v1/public/subscriptions/checkout/{sessionId}/status` cada 3 s. Si el webhook no llegó, el backend pregunta a Stripe por la sesión (respaldo idempotente). Al completar enlaza a `/login?tenant=<id>`.

No interviene ningún administrador de plataforma ni del tenant. Un fallo de aprovisionamiento deja `FAILED` y responde error al webhook para que Stripe reintente; el claim admite `FAILED` y `PROVISIONING` de más de 15 minutos. `checkout.session.expired` marca `EXPIRED` y borra el hash.

`POST /api/v1/public/signup` (pago simulado) responde 410 cuando hay una clave Stripe real configurada, porque activaría una organización de pago sin cobro. La prueba gratuita `/public/onboarding` no cambia.

## Organización existente

`POST /billing/checkout/initiate` con `STRIPE_CARD` y Stripe configurado crea una Checkout de suscripción (`kind=tenant_subscription`, tenant tomado del JWT) y el frontend redirige a `paymentData.checkoutUrl`. Se rechaza si ya hay una suscripción viva (`active`, `trialing`, `past_due`, `incomplete`). QR bancario y USDT siguen como pago único manual.

`POST /api/v1/billing/portal` (`TENANT_PLAN_ADMIN`) abre el Billing Portal de Stripe para cambiar tarjeta o plan, cancelar y ver facturas. Está exento del bloqueo de escritura por `PAST_DUE`/`EXPIRED` para poder regularizar la tarjeta. `my-invoices` devuelve `stripeManaged` y la pantalla cambia «Activar plan» por «Gestionar suscripción».

## Gestionar suscripción (ciclo de vida)

`/billing/subscription` (`subscription-page.ts`, permiso `TENANT_PLAN_ADMIN`) reemplaza el botón «Activar plan»/«Gestionar suscripción» de `/billing`, que ahora enlaza a esta pantalla. `SubscriptionLifecycleService` implementa las operaciones; con Stripe llama a su API y refleja la respuesta con `StripeSubscriptionService.syncTenant`, sin Stripe (prueba, QR o USDT) guarda el estado en `tenants` y lo aplica un job (`billing.lifecycle.poll-ms`, 5 min).

| Acción | Endpoint `/api/v1/billing/subscription…` | Con Stripe | Sin Stripe |
|---|---|---|---|
| Ver estado | `GET` | Lee `tenants` | Igual |
| Mejorar ahora | `POST /upgrade` | `POST /v1/subscriptions/{id}` con `proration_behavior=always_invoice` y `payment_behavior=error_if_incomplete`: cobra la diferencia hoy | 409: la pantalla abre el checkout de `/billing?plan=X&pay=1` |
| Cambiar en el próximo período | `POST /scheduled-change` | Subscription Schedule `from_subscription` + fase 2 con el precio nuevo (`end_behavior=release`) | `scheduled_plan_id` y `scheduled_change_at` = fin del período; el job cambia `plan_id` en esa fecha |
| Anular cambio programado | `DELETE /scheduled-change` | `POST /v1/subscription_schedules/{id}/release` | Limpia columnas |
| No renovar / reanudar | `POST /stop-renewal`, `/resume-renewal` | `cancel_at_period_end` en Stripe | Marca local; el job cancela al pasar `current_period_end` |
| Cancelar | `POST /cancel` | `DELETE /v1/subscriptions/{id}` | — |

Pago desde la aplicación: `/billing/checkout?plan=&cycle=` (`checkout-page.ts`) muestra el plan (límites y funcionalidades), el ciclo con el ahorro anual, el total y el medio de pago. «Continuar a Stripe» llama a `POST /checkout/initiate` y redirige a Stripe Checkout; la tarjeta se ingresa solo allí (se quitó el formulario de tarjeta simulado del modal de `/billing`). QR bancario y USDT generan la orden manual en la misma pantalla. Stripe vuelve a `/billing?checkout=success&session_id=…` y la página llama a `POST /api/v1/billing/checkout/stripe-sessions/{id}/confirm`, que consulta la sesión en Stripe, exige `kind=tenant_subscription` con el `tenantId` del JWT y la vincula de forma idempotente si está `complete` (respaldo del webhook, como en el alta pública). Una organización que ya tiene suscripción en Stripe no usa esta pantalla: cambia de plan con «Mejorar ahora».

Reglas: mejorar ahora solo si el equivalente mensual del plan elegido es mayor (bajar de plan o pasar al ciclo anual se programa); un cambio que no admite el uso actual se rechaza al programarlo (`PlanEnforcementService.assertCurrentUsageFits`); no renovar anula el cambio programado. `POST /plans/change` (cambio sin cobro) queda limitado a organizaciones en `TRIAL`.

### Cancelación y borrado de la organización

`POST /cancel` exige el nombre exacto de la organización, la contraseña de quien cancela y un motivo. Deja `subscription_status = CANCELED`, `canceled_at`, `cancellation_reason` y `deletion_scheduled_at = now() + billing.cancellation.retention-days` (30 por defecto), revoca todas las `auth_sessions` del tenant y registra `SUBSCRIPTION_CANCELED` en auditoría. No hay reembolso automático del período pagado. Lo mismo ocurre al terminar un período sin renovar (webhook `customer.subscription.deleted` o job). Durante la gracia, `AuthService.login`/`refresh` responden 403 con la fecha de borrado; un superadministrador puede reactivar la organización (`PATCH /tenants/{id}/status?value=ACTIVE`), lo que anula el borrado.

Al vencer la gracia el job llama a `app.purge_tenant(uuid)` (061): borra las filas de todas las tablas de `app.backup_tables()` salvo `users`, las sesiones y recuperaciones de contraseña, vacía `tenant_backups` (sin payload ni archivo), anonimiza usuarios y datos de contacto del tenant y marca `purged_at`. Después el backend borra `storage/<tenant>`, `storage/ocr/<tenant>` y los ZIP de respaldo. Se conservan `audit_events`, `billing_transactions`, `subscription_payments` y la fila del tenant. Los triggers de inmutabilidad y auditoría por fila se omiten con la misma prueba ligada a la transacción que usa la restauración (`app.tenant_purges` + `app.backup_is_restoring()`); `nexodocs_app` no puede crearla. Una organización eliminada no se puede reactivar. Prueba en seco (con `ROLLBACK`) sobre la base local el 2026-10-27: 21 tablas vaciadas, 35 usuarios anonimizados, auditoría y facturación intactas y segunda llamada idempotente.

## Sincronización de estado

`customer.subscription.updated/deleted` se procesan releyendo la suscripción en Stripe (los eventos pueden llegar desordenados). `invoice.paid` registra cada renovación en `billing_transactions` (`external_reference` = id de factura, `ON CONFLICT DO NOTHING`) y actualiza el período. El plan se deriva del `price_id`, de modo que un cambio hecho en el portal se refleja solo.

| Estado Stripe | `subscription_status` |
|---|---|
| active, trialing | ACTIVE |
| past_due, incomplete | PAST_DUE (lectura; escrituras bloqueadas por `PlanEnforcementService`) |
| canceled | CANCELED |
| unpaid, incomplete_expired, paused | EXPIRED |

Un tenant `SUSPENDED` (suspensión manual) no se reactiva por webhook. El estado Stripe sin traducir se guarda en `stripe_subscription_status`.

## Base de datos

`059_stripe_subscription_billing.sql` agrega las columnas Stripe a `tenants` con índices únicos parciales, crea `tenant_signups` (RLS habilitada, sin privilegios para `nexodocs_app`) y amplía `app.validate_tenant_user_status()` para aceptar `EXPIRED`, que 036 agregó al tipo pero la validación de 010 rechazaba.

El alta pública y el webhook escriben con el usuario de conexión del backend, igual que `/public/signup` y `/public/onboarding` (sin `establishDatabaseContext`). El portal lee `tenants` con contexto de tenant.

## Configuración

Variables: `STRIPE_API_KEY` (clave restringida con permisos de escritura en Checkout Sessions y Customer Portal, y de lectura en Subscriptions e Invoices), `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_{BASIC,PRO,ENTERPRISE}_{MONTHLY,ANNUAL}` y `FRONTEND_URL` para las URL de retorno. En Stripe: un Product por plan con Prices recurrentes de los mismos montos que `plans` (el catálogo público muestra los de la base), el webhook con `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `customer.subscription.updated`, `customer.subscription.deleted` e `invoice.paid`, y el Customer Portal activado. En local: `stripe listen --forward-to localhost:8080/api/v1/billing/webhooks/stripe`.

## Pendientes

- Migración 059 no ejecutada contra una base en esta revisión.
- Flujo completo con Stripe en modo test (tarjeta 4242, webhook duplicado y renovación con test clock) sin reproducir.
- Un tenant `CANCELED` o `EXPIRED` no supera `context_is_valid()`: durante la gracia solo un superadministrador lo reactiva; no hay autoservicio de reactivación.
- Las llamadas a Stripe de mejorar, programar, no renovar y cancelar no se reprodujeron en modo test en esta revisión; el flujo manual y el borrado sí se probaron en la base local.
- `invoice.payment_failed` no se escucha: el cambio a `past_due` llega por `customer.subscription.updated`.

Fuentes: [SubscriptionLifecycleService.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/SubscriptionLifecycleService.java), [061_subscription_lifecycle.sql](../../../database/init/061_subscription_lifecycle.sql), [subscription-page.ts](../../../frontend/src/app/features/billing/pages/subscription-page.ts), [StripeSubscriptionService.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/StripeSubscriptionService.java), [StripeBillingProperties.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/billing/StripeBillingProperties.java), [PublicSubscriptionController.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/controller/PublicSubscriptionController.java), [BillingService.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/BillingService.java), [059_stripe_subscription_billing.sql](../../../database/init/059_stripe_subscription_billing.sql), [pricing-page.ts](../../../frontend/src/app/features/pricing/pages/pricing-page.ts), [checkout-success-page.ts](../../../frontend/src/app/features/pricing/pages/checkout-success-page.ts).
