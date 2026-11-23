# Reporte de progreso — Sprint HU-19 a HU-24

> Fecha: 2026-11-23. Revisión: `43398312` (rama main). Este reporte está listo para revisión del equipo.

---

## Resumen ejecutivo

| Parte | Descripción | % Completado |
|---|---|---|
| 1 | Pagos simulados (sin Stripe) | **95 %** |
| 2 | Creación de tenants de demo | **90 %** |
| 3 | Creación de usuarios y roles | **85 %** |
| 4 | Carga de datos demo (Playwright + PDFs) | **80 %** |
| 5 | Validación de HU-19 a HU-24 | **88 %** |
| 6 | Documentación y entrega (wiki, plan, reporte) | **100 %** |

**Progreso global estimado: ~90 %**

---

## Parte 1 — Pagos simulados

**Estado: 95 % — Implementado, pendiente prueba end-to-end con navegador real**

### Cambios realizados

| Archivo | Tipo | Descripción |
|---|---|---|
| `backend/.../service/SimulatedSubscriptionService.java` | **Nuevo** (incluido en `43398312`) | Servicio que crea tenant y registra pago simulado sin Stripe |
| `backend/.../controller/PublicSubscriptionController.java` | Modificado | Inyecta `SimulatedSubscriptionService` exclusivamente |
| `backend/.../billing/StripeBillingProperties.java` | Modificado | Expone `frontendUrl()` para construir URL de retorno simulada |
| `backend/.../service/BillingService.java` | Modificado | Detecta ausencia de `STRIPE_API_KEY` y activa modo simulado |
| `database/init/086_secure_subscription_maintenance.sql` | Nuevo | Funciones `SECURITY DEFINER` para jobs de suscripción |
| `frontend/.../billing/pages/checkout-page.ts` | Modificado | Elimina formulario de tarjeta simulado; siempre redirige |
| `frontend/.../billing/pages/billing-page.ts` | Modificado | Botón «Activar plan» / «Gestionar suscripción» condicional |
| `frontend/.../pricing/pages/pricing-page.ts` | Modificado | Flujo unificado BASIC/PRO/ENTERPRISE sin desvío a contact-sales |
| `frontend/.../billing/pages/subscription-addons-panel.ts` | Modificado | Refleja estado de addons sin llamar a Stripe en modo simulado |

### Notificación de pago simulado

Al completar el alta simulada, el frontend muestra en `/planes/exito`:

> **"Pago simulado completado. Tu organización está lista para iniciar sesión."**

*(Captura de pantalla no disponible en esta revisión — el navegador de demo no estaba conectado. La evidencia puede reproducirse ejecutando `node scripts/tests/document-operations-browser.cjs` y navegando a `/planes/exito?session_id=sim_...`.)*

### Pendiente (5 %)

- [ ] Recorrido completo en navegador capturando pantallas del flujo de alta simulada.

---

## Parte 2 — Creación de tenants

**Estado: 90 % — Flujo funcional; sin capturas de tenants creados en esta sesión**

### Tenants de referencia creados (última sesión local)

> Los tenants se crean en la base de datos local y no hay archivo `tenants.json` generado automáticamente. Para producir el JSON ejecutar:
> ```bash
> psql $DATABASE_URL -c "COPY (SELECT id, name, subscription_status FROM public.tenants) TO STDOUT (FORMAT json)" > tenants.json
> ```

### Pendiente (10 %)

- [ ] Generar y versionar `tenants.json` con los IDs de tenants de demo.
- [ ] Captura de pantalla del panel de administración de plataforma mostrando los tenants.

---

## Parte 3 — Creación de usuarios

**Estado: 85 % — Usuarios creables por API y UI; sin recorrido completo de matriz de permisos**

### Cambios en AuthService

| Archivo | Cambio |
|---|---|
| `backend/.../service/AuthService.java` | Validación `userCustomizationService.assertAccessAllowed(user)` en login |
| `backend/.../service/PublicSignupService.java` | Firma de contraseña BCrypt en alta pública |

### Pendiente (15 %)

- [ ] Generar `users.json` con lista de usuarios demo y sus roles.
- [ ] Matriz completa de pruebas rol × módulo × permiso para certificar HU-20.

---

## Parte 4 — Carga de datos demo

**Estado: 80 % — Scripts Playwright funcionales; PDFs sintéticos disponibles**

### PDFs sintéticos disponibles

Ubicación: `backend/bootstrap/src/main/resources/docs/`

```
Historia_Clinica_20_Pacientes-1.pdf  ... Historia_Clinica_20_Pacientes-20.pdf
```

Total: **20 PDFs** de historias clínicas sintéticas (sin datos reales).

### Scripts Playwright

| Script | Señal de éxito | Estado |
|---|---|---|
| `document-operations-browser.cjs` | `DOCUMENT_OPERATIONS_BROWSER_OK` | ✅ Implementado |
| `mail-intake-receive-browser.cjs` | `HU28_RECEIVE_BROWSER_OK` + descarga `solo-recepcion.pdf` | ✅ Implementado |
| `test-sprint3-all.ps1` | Orquesta todos los scripts anteriores | ✅ Nuevo (incluido en `43398312`) |

### Capturas del chatbot

*(Captura de pantalla del chatbot no disponible en esta revisión — requiere Gemini API key configurada o modo demo sin Gemini. La respuesta esperada es una intención fija de la allowlist de `AssistantService`, sin enviar el texto libre al proveedor.)*

### Pendiente (20 %)

- [ ] Generar `data.json` con lista de documentos subidos y su estado.
- [ ] Captura de pantalla del chatbot respondiendo una consulta de demo.
- [ ] Captura de pantalla de la notificación de pago en `/planes/exito`.

---

## Parte 5 — Resultados de pruebas HU-19 a HU-24

**Estado: 88 % — Pruebas principales pasando; pendientes E2E y certificación AWS**

### Resultados de pruebas (referencia 2026-11-06)

#### Base de datos

```
./database/tests/run.ps1
→ DATABASE_TESTS_OK
```

Cobertura: aislamiento de dos tenants, acceso cruzado denegado, rol de aplicación, instalación/upgrade/idempotencia y concurrencia.

#### Backend Maven

```
mvn --batch-mode --no-transfer-progress test
→ 422 pruebas, 0 fallas, 0 errores, 3 omitidas
```

Tests relevantes para el sprint:
- `AuthServiceIsolatedRefreshTest` — refresh token con routing por tenant
- `SubscriptionLifecycleServiceTest` — ciclo de vida sin Stripe
- `TenantAddonServiceTest` — complementos y límites

#### Frontend

```
pnpm run typecheck && pnpm test
→ typecheck correcto; 211 pruebas (210 OK, 1 omitida)
```

Tests relevantes:
- `report-query.test.mjs` — consultas QBE y filtros de voz
- `subscription-lifecycle.test.mjs` — ciclo de vida en el cliente

### Estado por HU

| HU | Resultado | Límites conocidos |
|---|---|---|
| **HU-19** Multitenant por ID | ✅ Verificado localmente | Tenants legacy siguen con base compartida + RLS; no es auditoría de producción |
| **HU-20** Usuarios y permisos | ⚠️ Parcial | Falta matriz de integración por permiso × rol × módulo |
| **HU-21** Logs SaaS | ⚠️ Parcial | Cubre errores HTTP; no es explorador completo de JVM/infraestructura |
| **HU-22** Reportes y voz | ✅ Verificado | QBE y voz limitados a entidades/campos permitidos; sin consultas arbitrarias |
| **HU-23** Backups | ⚠️ Parcial | Creación, restauración y retención OK localmente; falta cifrado y multi-réplica |
| **HU-24** Asistente | ⚠️ Parcial | Allowlist de intenciones implementada; falta recorrido con Gemini API real |

### Hallazgos prioritarios cerrados (2026-11-06)

1. ✅ Migraciones de tenants aislados — `TenantDatabaseMigrationService` recorre bases `ISOLATED`
2. ✅ Refresh con routing — cubierto por `AuthServiceIsolatedRefreshTest`
3. ✅ Backups en tmpfs — 21 tablas vaciadas, 35 usuarios anonimizados, auditoría intacta
4. ✅ RLS en `auth_sessions` y `password_recovery_requests` — verificado en central y 3 DBs aisladas
5. ⚠️ Recuperación de contraseña tenant-scoped — falta recorrido SMTP real
6. ⚠️ Credenciales administrativas `CREATEDB/BYPASSRLS` — pendiente reducir antes de producción

---

## Parte 6 — Documentación

**Estado: 100 % — Completado en esta sesión**

### Artefactos generados

| Archivo | Descripción |
|---|---|
| [`docs/wiki/04-dominio-y-negocio/suscripciones-y-pagos-stripe.md`](docs/wiki/04-dominio-y-negocio/suscripciones-y-pagos-stripe.md) | Nueva sección «Pagos simulados» añadida |
| [`docs/wiki/04-dominio-y-negocio/poblado-datos-demo.md`](docs/wiki/04-dominio-y-negocio/poblado-datos-demo.md) | Nueva página: guía de scripts Playwright y PDFs sintéticos |
| [`implementation_plan.md`](implementation_plan.md) | Plan de implementación reproducible con 6 partes |
| [`progress_report.md`](progress_report.md) | Este documento |
| `docs/wiki/verification.json` | Actualizado con nuevas páginas de wiki |

---

## Archivos JSON generados

> Los siguientes archivos **no existen aún** en el repositorio porque los scripts no los generan automáticamente. Se deben producir con los comandos indicados:

| Archivo esperado | Cómo generarlo |
|---|---|
| `tenants.json` | `psql $DATABASE_URL -c "COPY (SELECT id,name,subscription_status FROM tenants) TO STDOUT (FORMAT json)" > tenants.json` |
| `users.json` | `psql $DATABASE_URL -c "COPY (SELECT id,email,full_name FROM users WHERE tenant_id=\'<uuid>\') TO STDOUT (FORMAT json)" > users.json` |
| `data.json` | `psql $DATABASE_URL -c "COPY (SELECT id,name,status FROM documents WHERE tenant_id=\'<uuid>\') TO STDOUT (FORMAT json)" > data.json` |

---

## Pendientes globales antes de certificar al 100 %

- [ ] Generar y versionar `tenants.json`, `users.json`, `data.json`.
- [ ] Capturas de pantalla: notificación de pago en `/planes/exito` y chatbot respondiendo.
- [ ] Recorrido SMTP real para recuperación de contraseña (HU-20).
- [ ] Reducir `CREATEDB/BYPASSRLS` del usuario administrativo antes de producción.
- [ ] Encapsular `revoked_access_tokens` y `audit_anchors` en RLS.
- [ ] Cifrado de archivos de backup y validación multi-réplica del scheduler (HU-23).
- [ ] Recorrido con Gemini API key real (HU-24).
- [ ] Validación en dispositivo físico Android (Mobile/APK).
- [ ] Despliegue y validación en AWS/producción.

---

*Reporte generado el 2026-11-23 sobre la revisión `43398312`.*
