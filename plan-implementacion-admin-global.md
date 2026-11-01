# Plan de implementación: administración global de NexoDocs

Versión 1 · 27 de octubre de 2026 · Base de código: rama `main` (commit `8996d62`)

## Objetivo

Completar las herramientas del administrador global (plataforma) para gestionar organizaciones, planes, precios, descuentos, complementos (add-ons), soporte y los mensajes que los usuarios envían al equipo de NexoDocs, **sin dar acceso al contenido de los tenants**.

Principio rector: el admin global administra el **negocio** y la **plataforma**; el administrador de cada tenant administra su **contenido** y sus **usuarios**. La base de datos ya lo impone: `app.context_is_valid()` excluye a las cuentas de plataforma de los datos de las organizaciones.

## Punto de partida (lo que ya existe)

| Área | Implementado | Archivos de referencia |
|---|---|---|
| Panel de plataforma | KPIs de MRR/ARR, tenants por estado y plan | `PlatformAnalyticsController`, `platform-dashboard-page.ts` |
| Organizaciones | Lista, alta, suspender/activar | `TenantController`, `administracion-page.ts` |
| Reportes | Tenants y pagos con exportación CSV | `ReportController`, `reportes-page.ts` |
| Suscripciones | Stripe Checkout, webhooks, mejora, cambio programado, no renovar, cancelación con borrado diferido | `StripeSubscriptionService`, `SubscriptionLifecycleService`, migraciones 059 y 061 |
| Planes | Tablas `plans`, `plan_limits`, `plan_features`; matriz en código | `PlanFeatureMatrix`, `PlanEnforcementService` |
| Respaldos | Respaldo completo de plataforma | `PlatformBackupController` |
| Autoridades de plataforma | Lista fija | `PlatformAuthorities` |

**Lo que falta:** ficha de organización, edición de planes y precios, descuentos, complementos, auditoría propia de plataforma, roles internos y acceso de soporte con consentimiento.

## Convenciones para todas las fases

- **Migraciones:** la siguiente libre es `062`. Antes de crear cada una, verificar los números en todas las ramas compartidas. Seguir el patrón de `060`/`061`: `ON_ERROR_STOP`, transacción, advisory lock, guard por nombre y registro en `app.schema_migrations`.
- **Tablas globales** (planes, cupones, complementos): sin `tenant_id`, sin privilegios para `nexodocs_app`, escritas por el backend con el usuario de conexión (como `tenant_signups` en 059).
- **Tablas por tenant** (complementos comprados, descuentos asignados): `tenant_id` obligatorio, FK compuestas, ENABLE/FORCE RLS, política `tenant_context` y lectura para el propio tenant.
- **Stripe es la fuente de verdad del cobro:** todo cambio de precio, cupón o complemento se crea primero en Stripe y después se refleja en la base. Los webhooks confirman.
- **Cada acción del admin global exige motivo** y queda en la auditoría de plataforma (fase 1).
- **Pruebas por fase:** unitarias de servicio (JUnit/Mockito), regresión SQL en `scripts/tests/`, pruebas de frontend (`node --test`) e idiomas (`scripts/i18n-audit.mjs` sin faltantes).
- **Documentación:** actualizar la wiki (`docs/wiki`) y `verification.json`, el manual de uso (`node scripts/build-manual.mjs`) y el manual del asistente.

---

## Fase 1 · Ficha de organización y auditoría de plataforma

**Por qué primero:** es la base de las demás fases. Todas las acciones posteriores (descuentos, complementos, soporte) se ejecutan desde la ficha y deben quedar auditadas.

### Alcance
1. **Auditoría de plataforma**
   - Migración `062_platform_audit`: tabla `platform_audit_events` (actor, acción, tenant afectado, motivo obligatorio, antes/después en JSON, IP, fecha). Inmutable, con triggers como `audit_events`.
   - `PlatformAuditService.record(...)`, llamado desde cada acción de plataforma.
   - Vista `/platform/audit` con filtros por actor, tenant, acción y fecha, y exportación CSV.
2. **Ficha de organización** `/platform/tenants/{id}`
   - **Resumen:** nombre, administrador de contacto, alta, estado del ciclo de vida.
   - **Suscripción:** plan, ciclo, renovación, cambio programado, no renovar, gracia y borrado programado.
   - **Uso frente a límites:** usuarios, almacenamiento, documentos y OCR del mes, con barras de consumo.
   - **Facturas y pagos** (lectura de `billing_transactions`).
   - **Historial:** eventos de plataforma y del ciclo de vida.
3. **Acciones desde la ficha** (todas con motivo obligatorio)
   - Suspender / reactivar (ya existe; añadir motivo y auditoría).
   - Extender la prueba N días.
   - Cambio de plan manual (cortesía o corrección), con aviso si el uso no cabe.
   - Reactivar dentro del período de gracia (ya existe; añadir motivo).
4. **Endpoint de resumen** `GET /api/v1/platform/tenants/{id}/overview` que devuelva **solo datos permitidos** (ver anexo A).

### Criterios de aceptación
- Ninguna acción de plataforma se ejecuta sin motivo y sin registro en `platform_audit_events`.
- La ficha no muestra nombres de documentos, pacientes ni contenido (prueba automática que lo verifique en el DTO).
- Un admin de tenant recibe 403 en todas las rutas `/platform/*`.

### Pruebas
- `PlatformAuditServiceTest`: motivo obligatorio, inmutabilidad.
- `scripts/tests/platform-audit.sql`: `nexodocs_app` no puede leer ni escribir la tabla.
- Prueba del DTO de la ficha: lista cerrada de campos.

---

## Fase 2 · Catálogo de planes editable (precios, límites y funcionalidades)

### Alcance
1. **Vista `/platform/plans`**
   - Editar nombre, descripción, límites (`plan_limits`) y funcionalidades (`plan_features`) de cada plan.
   - Activar o desactivar un plan para nuevas ventas sin afectar a quien ya lo tiene.
2. **Cambio de precio con versiones**
   - Migración `063_plan_price_versions`: tabla `plan_prices` (plan, ciclo, monto, `stripe_price_id`, vigente desde, archivado).
   - Al cambiar un precio: se crea un nuevo Price en Stripe, se archiva el anterior para nuevas ventas y se guarda la versión.
   - `StripeBillingProperties` deja de leer los `price_...` de variables de entorno y los toma de `plan_prices` (con las variables como respaldo durante la migración).
   - **Clientes actuales conservan su precio** (grandfathering). Opción de migrarlos: se programa el cambio en su próxima renovación con aviso de 30 días, reutilizando el mecanismo de Subscription Schedules de `SubscriptionLifecycleService`.
   - La vista muestra cuántos tenants pagan cada versión de precio.
3. **Funcionalidades por plan desde la vista**
   - `PlanFeatureMatrix` lee `plan_features` en lugar de la matriz fija (mantener la matriz como valores por defecto).
   - Al quitar una funcionalidad de un plan: advertir cuántos tenants la usan; los permisos asociados dejan de concederse en el siguiente inicio de sesión (como hace hoy `resolveAuthorities`).
4. **Grupos por defecto de un tenant nuevo**
   - Migración: tabla `default_role_templates` (nombre del grupo, lista de códigos de permiso).
   - `PublicOnboardingService` y `TenantService` crean los grupos desde estas plantillas.
   - Vista para editarlas. **No se crean permisos nuevos desde pantalla**: el catálogo de permisos sigue definido en código y migraciones porque cada permiso corresponde a una comprobación del backend.

### Criterios de aceptación
- Cambiar un precio no altera el cobro de suscripciones existentes salvo migración explícita.
- El precio que ve el cliente en `/planes` y en el checkout coincide con el Price de Stripe vigente.
- Una funcionalidad retirada deja de estar disponible tras renovar sesión, y la auditoría registra quién la retiró.

### Riesgos
- **Desincronización con Stripe:** si falla la creación del Price, no se guarda nada en la base (orden: Stripe primero).
- **Bajar límites de un plan con clientes que ya los superan:** no bloquear su operación actual; solo impedir crecer (misma lógica que `assertCurrentUsageFits` al bajar de plan).

---

## Fase 3 · Complementos (add-ons): paquetes de almacenamiento, usuarios y OCR

Caso principal: un tenant en Pro necesita más espacio sin pasar a Enterprise.

### Modelo
| Complemento | Tipo | Ejemplo de precio |
|---|---|---|
| Almacenamiento adicional | Recurrente, por unidades | +10 GB por $9/mes |
| Usuarios adicionales | Recurrente, por unidades | +5 usuarios por $15/mes |
| Paquete de páginas OCR | Consumible (pago único), con vencimiento | 1.000 páginas por $20, válidas 12 meses |

### Alcance
1. **Datos**
   - Migración `064_addons`:
     - `addons` (global): código, recurso afectado (`maxStorageMB`, `maxUsers`, `ocrPagesMonthly`), cantidad por unidad, tipo (recurrente o consumible), `stripe_price_id`, planes en que se ofrece, activo.
     - `tenant_addons` (por tenant, con RLS): complemento, unidades, estado, `stripe_subscription_item_id`, origen (compra o cortesía), vencimiento para consumibles.
2. **Límite efectivo**
   - `PlanEnforcementService` y `PlanLimitService` calculan **límite del plan + complementos activos** en un único método (`effectiveLimit`), usado por usuarios, almacenamiento y OCR.
3. **Compra por el tenant**
   - Nueva pestaña en `/billing/subscription` → **Complementos**: catálogo disponible para su plan, cantidad y precio total.
   - Recurrentes: se agregan como **ítem adicional de la misma suscripción de Stripe** (`POST /v1/subscription_items` con cantidad y prorrateo); se facturan en la misma fecha de renovación.
   - Consumibles: Stripe Checkout en modo `payment`; al confirmarse, se acreditan las páginas.
   - Sin Stripe (pago manual): orden de pago QR/USDT como hoy, por un período.
   - Reducir o quitar unidades: solo si el uso actual cabe; se aplica al final del período.
4. **Administración global**
   - Vista `/platform/addons`: crear, editar precio (con versionado como en la fase 2), en qué planes se ofrece.
   - Desde la ficha de organización: asignar un complemento de cortesía (sin cobro), con motivo y vencimiento.
5. **Sugerencia de subir de plan**
   - Si el costo de los complementos supera la diferencia con el plan superior, la pantalla del tenant lo indica.
6. **Webhooks**
   - `customer.subscription.updated` ya relee la suscripción: ampliar `syncTenant` para sincronizar los ítems de complementos (unidades y estado).

### Criterios de aceptación
- Un tenant Pro con 1 paquete de +10 GB puede subir archivos hasta el límite del plan + 10 GB, y no más.
- Quitar un complemento con el espacio en uso se rechaza con un mensaje claro.
- El complemento aparece en la factura de Stripe junto al plan.
- Al subir a un plan que ya cubre el recurso, se ofrece retirar el complemento.

### Pruebas
- `EffectiveLimitTest`: plan + varios complementos, ilimitado (-1), complementos vencidos.
- Prueba de integración del webhook con ítems de suscripción.
- `scripts/tests/tenant-addons.sql`: un tenant no ve los complementos de otro.

---

## Fase 4 · Descuentos y promociones

### Tipos
| Tipo | Ejemplo | Implementación en Stripe |
|---|---|---|
| Cupón | 20 % durante 3 meses | Coupon (`percent_off` o `amount_off`, `duration`) |
| Código promocional | `LANZAMIENTO2026` | Promotion Code sobre un cupón, con vencimiento, límite de canjes y restricciones |
| Descuento a un tenant | Cliente frecuente: 10 % por 12 meses | Discount sobre la suscripción del cliente |
| Ciclo anual | 2 meses gratis | Ya existe como precio anual |

### Alcance
1. **Datos**
   - Migración `065_discounts`: `coupons` y `promotion_codes` (globales, espejo de Stripe), `tenant_discounts` (por tenant: cupón, motivo, aprobado por, inicio y fin).
2. **Vista `/platform/discounts`**
   - Crear cupones: tipo, valor, duración, planes aplicables, **tope máximo** (por ejemplo 50 %), **fecha de fin obligatoria**.
   - Crear códigos promocionales: código, límite de canjes, vencimiento, solo primer pago.
   - Ver canjes y su impacto en ingresos.
3. **Códigos en el checkout**
   - `/planes` y `/billing/checkout` aceptan un código promocional (Stripe Checkout con `allow_promotion_codes` o `discounts[0][promotion_code]`).
4. **Clientes frecuentes**
   - El sistema **sugiere** candidatos (por ejemplo, más de 12 meses activos sin pagos fallidos) en una lista.
   - El admin **aprueba** el descuento desde la lista o la ficha; no se aplica automáticamente.
5. **Visibilidad para el tenant**
   - En Gestionar suscripción: descuento activo, valor y fecha de fin.

### Criterios de aceptación
- No se puede crear un descuento sin fecha de fin ni por encima del tope.
- Un código vencido o agotado se rechaza en el checkout con un mensaje claro.
- Cada descuento aplicado queda en la auditoría de plataforma con aprobador y motivo.

---

## Fase 5 · Roles internos de plataforma y acceso de soporte con consentimiento

### Roles internos
| Rol | Permisos |
|---|---|
| Superadmin | Todo, incluida la gestión del equipo de plataforma |
| Finanzas | Precios, descuentos, complementos, reembolsos, reportes de ingresos |
| Soporte | Fichas de organización, extender pruebas, solicitar acceso de soporte |
| Operaciones | Respaldos, salud del sistema, suspensiones por incidente técnico |

- Migración `066_platform_roles`: roles y autoridades de plataforma en tablas (hoy son fijas en `PlatformAuthorities`).
- Vista `/platform/team`: alta de admins, rol, último acceso.
- **Doble factor (MFA) obligatorio** para cuentas de plataforma.
- Los descuentos superiores a un umbral requieren aprobación de Finanzas.

### Acceso de soporte con consentimiento
1. El admin de plataforma **solicita** acceso: motivo, duración máxima (por ejemplo 2 horas), módulos y solo lectura.
2. El **administrador del tenant aprueba o rechaza** desde su pantalla de Configuración.
3. Al aprobarse se emite una sesión temporal limitada a esos módulos; la base de datos la reconoce con una prueba ligada a la solicitud aprobada (mismo patrón que la restauración y el borrado: tabla de evidencia más función `SECURITY DEFINER`).
4. Cada acción queda en la **auditoría del propio tenant**, visible para él, además de la auditoría de plataforma.
5. El acceso vence solo; el tenant puede revocarlo antes.
6. **Emergencia (break-glass):** acceso sin aprobación previa solo con doble aprobación interna (superadmin y otro rol) y aviso inmediato al tenant.

### Criterios de aceptación
- Sin aprobación vigente, una cuenta de plataforma sigue sin leer datos del tenant (prueba SQL).
- El tenant ve en su auditoría cada acción hecha durante el acceso de soporte.
- No existe la opción de iniciar sesión como un usuario del tenant (impersonación).

---

## Fase 6 · Mensajes de los tenants al equipo de NexoDocs (solicitudes de soporte)

Un usuario de una organización puede escribir a los administradores del SaaS (dudas, problemas técnicos, facturación, sugerencias) y seguir la conversación dentro de la aplicación. Hoy solo existe el formulario público `/contacto`, que envía un correo y no deja historial.

### Modelo: solicitudes con conversación (tickets)
| Campo | Detalle |
|---|---|
| Categoría | Soporte técnico, Facturación y planes, Reportar un error, Sugerencia, Otro |
| Asunto y mensaje | Texto libre; mensajes posteriores forman un hilo |
| Prioridad | Normal o Urgente (urgente solo para el administrador del tenant) |
| Adjuntos | Capturas de pantalla (PNG/JPEG/PDF, máx. 5 MB); aviso de **no adjuntar datos de pacientes** |
| Contexto automático | Pantalla desde la que se escribió, navegador y versión; nunca contenido de documentos |
| Estado | Abierta → En curso → Esperando respuesta del cliente → Resuelta → Cerrada |
| Asignación | Persona o rol de plataforma (Soporte, Finanzas) |

### Alcance
1. **Datos**
   - Migración `067_support_tickets`: `support_tickets` (tenant, autor, categoría, asunto, prioridad, estado, asignado a, fechas) y `support_messages` (ticket, autor, si es de plataforma o del tenant, texto, adjunto, nota interna sí/no, fecha).
   - **RLS:** el autor ve sus solicitudes; el administrador del tenant ve todas las de su organización (permiso nuevo `support:read_tenant`); las cuentas de plataforma leen y responden todas por su propio rol. Las **notas internas** de plataforma nunca se muestran al tenant.
2. **Vista del tenant**
   - Botón **«Contactar a soporte»** en el centro de ayuda y en el menú de usuario.
   - `/support`: «Mis solicitudes», con estado, último mensaje y conversación.
   - Formulario de nueva solicitud: categoría, asunto, mensaje, adjunto y aviso de privacidad.
   - Aviso en la campana de notificaciones y por correo cuando la plataforma responde (se reutiliza el SMTP de `/contacto`).
   - Permiso `support:create`, incluido en los grupos por defecto (fase 2) para que cualquier usuario pueda escribir.
3. **Vista de plataforma**
   - `/platform/support`: bandeja con filtros por estado, categoría, prioridad, organización y asignado; contador de sin respuesta.
   - Detalle: conversación, respuesta, notas internas, cambiar estado, asignar.
   - **Acceso a la ficha de organización** (fase 1) desde la solicitud.
   - Si hace falta ver datos del cliente: botón **«Solicitar acceso de soporte»**, que abre el flujo con consentimiento de la fase 5 vinculado a la solicitud.
   - Respuestas predefinidas para preguntas frecuentes.
   - Indicadores: tiempo de primera respuesta, tiempo de resolución, solicitudes por categoría (se suman al panel de plataforma).
4. **Reglas**
   - Límite de envíos por usuario (por ejemplo 10 por hora) contra el abuso.
   - Una solicitud resuelta se cierra sola si el cliente no responde en 7 días; el cliente puede reabrirla mientras siga abierta.
   - Crear, responder, reasignar y cerrar quedan en la auditoría de plataforma (fase 1) y, para el tenant, en su propia auditoría.
   - Los adjuntos se guardan aislados por tenant (`storage/support/<tenant>`) y se incluyen en el borrado definitivo de una organización cancelada (`purge_tenant`, migración 061).

### Criterios de aceptación
- Un usuario no ve las solicitudes de otros usuarios salvo que sea administrador de su organización.
- Un tenant nunca ve solicitudes de otro tenant ni las notas internas de plataforma (prueba SQL).
- La respuesta de plataforma llega al usuario por notificación y correo.
- El admin de plataforma no puede abrir datos del tenant desde la solicitud sin el consentimiento de la fase 5.

### Pruebas
- `SupportTicketServiceTest`: permisos por rol, transiciones de estado, límite de envíos.
- `scripts/tests/support-tickets.sql`: aislamiento entre tenants y ocultación de notas internas.
- Prueba de frontend: el formulario muestra el aviso de privacidad y la vista del tenant no recibe notas internas.

---

## Anexo A · Datos del tenant accesibles para el admin global

| Puede ver | No puede ver |
|---|---|
| Nombre, contacto y administrador de la organización | Contenido y archivos de documentos |
| Plan, estado, fechas y suscripción | Nombres, descripciones y metadatos de documentos |
| Uso en números: usuarios, GB, documentos, páginas OCR | Pacientes, historias clínicas, notas médicas, DICOM |
| Facturas, pagos, descuentos y complementos | Expedientes y su contenido |
| Metadatos de respaldos: fecha, tamaño, estado | Contenido de respaldos o su descarga |
| Eventos de plataforma: alta, suspensión, cancelación | Detalle de la auditoría interna del tenant |
| Errores técnicos sin contenido | Contraseñas o sus hashes |
| Lista de usuarios: nombre, correo, estado, último acceso | Iniciar sesión como un usuario del tenant |

La excepción es el acceso de soporte con consentimiento (fase 5): temporal, limitado, aprobado por el tenant y auditado.

## Anexo B · Resumen de fases

| Fase | Entrega principal | Migraciones | Depende de |
|---|---|---|---|
| 1 | Ficha de organización y auditoría de plataforma | 062 | — |
| 2 | Catálogo de planes editable y precios versionados | 063 (+ plantillas de grupos) | 1 |
| 3 | Complementos (almacenamiento, usuarios, OCR) | 064 | 1, 2 |
| 4 | Descuentos y códigos promocionales | 065 | 1, 2 |
| 5 | Roles internos, MFA y acceso de soporte | 066 | 1 |
| 6 | Mensajes de los tenants a soporte (solicitudes con conversación) | 067 | 1 (la asignación por rol y el acceso con consentimiento usan la 5) |

Las fases 3 y 4 pueden hacerse en paralelo una vez terminada la 2. La 5 puede adelantarse si el equipo de plataforma crece antes. La 6 puede empezar justo después de la 1 en una versión básica (enviar, responder, estados) y sumar asignación por rol y acceso de soporte cuando exista la 5.

## Anexo C · Definición de terminado (cada fase)

- [ ] Migración aplicada en una base local con datos y prueba SQL de regresión pasando.
- [ ] Pruebas de backend y frontend en verde; `tsc` sin errores; build de Angular correcto.
- [ ] Textos traducidos en los cuatro idiomas (`node scripts/i18n-audit.mjs` sin faltantes).
- [ ] Flujo con Stripe probado en modo test (tarjeta 4242, `stripe listen`).
- [ ] Wiki y `verification.json` actualizados; `node scripts/validate-wiki.mjs` en verde.
- [ ] Manual de uso y manual del asistente actualizados.
- [ ] Toda acción nueva de plataforma exige motivo y queda auditada.
