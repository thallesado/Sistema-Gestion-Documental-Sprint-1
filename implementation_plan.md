# Plan de implementación — Sprint HU-19 a HU-24

> Fecha: 2026-11-23. Revisión local: `91fb767` + cambios sin commit. Este documento describe los pasos exactos para reproducir la tarea completa en un entorno limpio.

---

## Parte 1 — Pagos simulados (sin Stripe)

### Objetivo
Permitir el alta pública y la compra de plan sin necesidad de claves Stripe, para demo y desarrollo.

### Pasos

1. **Verificar que `STRIPE_API_KEY` no esté en `.env`** (o dejarla vacía). `BillingService` detecta la ausencia y activa el modo simulado automáticamente.

2. **Revisar `SimulatedSubscriptionService.java`** (archivo nuevo, aún sin commit):
   ```
   backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/SimulatedSubscriptionService.java
   ```
   Este servicio:
   - Llama a `PublicSignupService.signupForCheckout()` para crear tenant, usuario y roles.
   - Inserta una fila en `tenant_signups` con `status = 'COMPLETED'` y `stripe_checkout_id = 'sim_<uuid>'`.
   - Inserta una fila en `billing_transactions` con `payment_method = 'STRIPE_CARD'`, `status = 'COMPLETED'` y `metadata_json = '{"mode":"simulated","kind":"tenant_signup"}'`.
   - Devuelve `checkoutUrl = <FRONTEND_URL>/planes/exito?session_id=sim_<uuid>`.

3. **Verificar `PublicSubscriptionController.java`**: debe inyectar exclusivamente `SimulatedSubscriptionService`.

4. **Aplicar migración `086_secure_subscription_maintenance.sql`**:
   ```bash
   # Con psql apuntando a la base central
   psql $DATABASE_URL -f database/init/086_secure_subscription_maintenance.sql
   ```
   Crea las funciones `SECURITY DEFINER`:
   - `app.finish_nonrenewed_subscriptions(p_retention_days)`
   - `app.apply_scheduled_subscription_changes()`
   - `app.record_tenant_lifecycle_audit(p_tenant_id, p_actor_id, p_action, p_details)`

5. **Probar el flujo completo**:
   ```bash
   curl -X POST http://localhost:8080/api/v1/public/subscriptions/checkout \
     -H "Content-Type: application/json" \
     -d '{"tenantName":"Demo","adminEmail":"a@b.com","adminPassword":"Test1234!","administratorName":"Admin","planCode":"BASIC","billingPeriod":"MONTHLY"}'
   ```
   Verificar que `sessionId` empiece con `sim_` y que `checkoutUrl` apunte a `/planes/exito`.

---

## Parte 2 — Creación de tenants

### Pasos

1. Arrancar el backend: `cd backend && mvn spring-boot:run -Dspring.profiles.active=local`
2. Arrancar el frontend: `cd frontend && pnpm start`
3. Navegar a `http://localhost:4200/planes`.
4. Completar el formulario de alta (nombre de organización, correo, contraseña, plan).
5. Verificar redirección a `/planes/exito?session_id=sim_...` y mensaje de confirmación.
6. Verificar en la base de datos:
   ```sql
   SELECT id, name, subscription_status, plan_id FROM public.tenants ORDER BY created_at DESC LIMIT 5;
   ```

### Tenants de demo recomendados

| Nombre | Plan | Ciclo |
|---|---|---|
| Clínica Demo | PRO | MONTHLY |
| Hospital Prueba | ENTERPRISE | ANNUAL |
| Consultorio Test | BASIC | MONTHLY |

---

## Parte 3 — Creación de usuarios

### Pasos

1. Login con el administrador del tenant creado.
2. Ir a `/settings/users` → «Nuevo usuario».
3. Crear al menos:
   - Un operador documental (con permisos `document:read`, `document:upload`).
   - Un auditor (con permisos `audit:read`).
   - Un usuario sin permisos (para validar control de acceso HU-20).

4. Verificar mediante la API:
   ```bash
   curl http://localhost:8080/api/v1/users -H "Authorization: Bearer <TOKEN>" | jq '.content[].email'
   ```

5. Para prueba de aislamiento multitenant (HU-19): repetir login con credenciales del segundo tenant y verificar que los usuarios del primero no sean visibles.

---

## Parte 4 — Carga de datos demo

### Pasos

1. Instalar dependencias de Playwright:
   ```powershell
   pnpm exec playwright install chromium
   ```

2. Ejecutar el script de operaciones documentales:
   ```powershell
   node scripts/tests/document-operations-browser.cjs
   ```
   Señal de éxito: imprime `DOCUMENT_OPERATIONS_BROWSER_OK`.

3. Ejecutar el script de buzón documental:
   ```powershell
   node scripts/tests/mail-intake-receive-browser.cjs
   ```
   Señal de éxito: imprime `HU28_RECEIVE_BROWSER_OK` y descarga `solo-recepcion.pdf`.

4. Los PDFs sintéticos utilizados se encuentran en:
   ```
   backend/bootstrap/src/main/resources/docs/Historia_Clinica_20_Pacientes-{1..20}.pdf
   ```

---

## Parte 5 — Validación de historias de usuario HU-19 a HU-24

### Pruebas de base de datos

```powershell
./database/tests/run.ps1
```
Resultado esperado: `DATABASE_TESTS_OK`

### Pruebas de backend (Maven)

```powershell
cd backend
mvn --batch-mode --no-transfer-progress test
```
Resultado esperado (referencia 2026-11-06): 422 pruebas, 0 fallas, 0 errores, 3 omitidas.

### Pruebas de frontend

```powershell
cd frontend
pnpm run typecheck
pnpm test
```
Resultado esperado: typecheck correcto; 211 pruebas (210 correctas, 1 omitida).

### Pruebas integradas del sprint

```powershell
pwsh scripts/tests/test-sprint3-all.ps1
```

### Criterios por HU

| HU | Criterio de aceptación | Cómo verificar |
|---|---|---|
| HU-19 Multitenant | Dos tenants no ven datos del otro bajo FORCE RLS | `database/tests/run.ps1` + acceso cruzado denegado |
| HU-20 Usuarios y permisos | Endpoints devuelven 403 sin el permiso requerido | `@PreAuthorize` en controladores + RLS en PostgreSQL |
| HU-21 Logs SaaS | `GET /api/v1/platform/technical-logs` retorna logs sin datos clínicos | Revisión manual de respuesta + migración 083 |
| HU-22 Reportes y voz | QBE y voz producen resultados filtrados correctamente | `frontend/tests/report-query.test.mjs` |
| HU-23 Backups | Backup creado, restaurado y verificado por checksum | `scripts/tests/backup-full.test.sh` |
| HU-24 Asistente | Chatbot responde con intención fija sin enviar pregunta original a Gemini | `AssistantService` mapea a allowlist; revisar logs de Gemini |

---

## Parte 6 — Documentación y entrega

### Pasos

1. Actualizar `docs/wiki/04-dominio-y-negocio/suscripciones-y-pagos-stripe.md` con la sección «Pagos simulados» ✅ (ya hecho).
2. Crear `docs/wiki/04-dominio-y-negocio/poblado-datos-demo.md` ✅ (ya hecho).
3. Agregar las nuevas páginas a `docs/wiki/verification.json` bajo `"pages"`.
4. Ejecutar el validador de wiki:
   ```powershell
   node scripts/validate-wiki.mjs
   ```
5. Hacer commit y push de todos los cambios, excluyendo `.env`:
   ```powershell
   cd "c:\Users\andre\Desktop\SI2\Sprint 1 Grupal\Dise-o-Visual-para-Sprint-1---Sistema-de-Gestion-Documental"
   git add -A
   git reset HEAD .env
   git commit -m "docs: wiki pagos simulados, poblado demo, plan implementacion y reporte progreso

   - Agrega seccion 'Pagos simulados' en suscripciones-y-pagos-stripe.md
   - Nueva pagina poblado-datos-demo.md con guia de scripts Playwright y PDFs sinteticos
   - implementation_plan.md con pasos reproducibles para las 6 partes del sprint
   - progress_report.md con estado por HU y resultados de pruebas
   - Actualiza verification.json con nuevas paginas de wiki
   - Commit de SimulatedSubscriptionService.java (nuevo servicio sin Stripe)
   - Commit de scripts/tests/test-sprint3-all.ps1"
   git push origin main
   ```

---

## Referencias

- [Wiki: suscripciones y pagos](docs/wiki/04-dominio-y-negocio/suscripciones-y-pagos-stripe.md)
- [Wiki: poblado de datos demo](docs/wiki/04-dominio-y-negocio/poblado-datos-demo.md)
- [Wiki: HU-19 a HU-24](docs/wiki/04-dominio-y-negocio/sprint-hu19-24.md)
- [SimulatedSubscriptionService.java](backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/SimulatedSubscriptionService.java)
- [migración 086](database/init/086_secure_subscription_maintenance.sql)
