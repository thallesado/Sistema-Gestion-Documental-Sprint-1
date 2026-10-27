# Suscripciones y pagos recurrentes con Stripe

> Revisión documental: 2026-10-26. Base `e3f6358` más implementación local sin commit. Describe código; no acredita claves, precios ni webhook configurados en ningún servidor.

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
- Un tenant `CANCELED` o `EXPIRED` no supera `context_is_valid()`; volver a suscribirse desde la aplicación requiere un camino de reactivación todavía inexistente.
- `invoice.payment_failed` no se escucha: el cambio a `past_due` llega por `customer.subscription.updated`.

Fuentes: [StripeSubscriptionService.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/StripeSubscriptionService.java), [StripeBillingProperties.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/billing/StripeBillingProperties.java), [PublicSubscriptionController.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/controller/PublicSubscriptionController.java), [BillingService.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/BillingService.java), [059_stripe_subscription_billing.sql](../../../database/init/059_stripe_subscription_billing.sql), [pricing-page.ts](../../../frontend/src/app/features/pricing/pages/pricing-page.ts), [checkout-success-page.ts](../../../frontend/src/app/features/pricing/pages/checkout-success-page.ts).
