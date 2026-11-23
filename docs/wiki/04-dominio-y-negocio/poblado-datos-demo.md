# Poblado de datos demo

> Revisión documental: 2026-11-23. Base `91fb767` más cambios locales sin commit. Describe el proceso de carga de datos sintéticos para entornos de desarrollo y demo; no aplica a producción.

## Propósito

El poblado de datos demo permite arrancar NexoDocs con tenants, usuarios y documentos preconfigurados sin necesidad de Stripe ni de SMTP real. Se usa en:

- Demostraciones al equipo / stakeholders.
- Pruebas de historia de usuario (HU-19 a HU-24).
- Validación de la UI de reportes y del chatbot asistente.

---

## Scripts Playwright disponibles

Todos los scripts se encuentran en [`scripts/tests/`](../../../scripts/tests/). Se ejecutan con Node.js ≥ 20 y Playwright instalado (`pnpm exec playwright install chromium`).

| Script | Propósito | Comando |
|---|---|---|
| `document-operations-browser.cjs` | Sube documentos de demo, ejecuta operaciones documentales (recepción, traducción, revisión) y verifica descarga | `node scripts/tests/document-operations-browser.cjs` |
| `mail-intake-receive-browser.cjs` | Prueba el buzón documental: recibe correo y descarga el archivo adjunto (`solo-recepcion.pdf`) | `node scripts/tests/mail-intake-receive-browser.cjs` |
| `test-sprint3-all.ps1` | Orquesta todas las pruebas del sprint en secuencia: base de datos, backend Maven y scripts de browser | `pwsh scripts/tests/test-sprint3-all.ps1` |

> [!NOTE]
> Los scripts de browser requieren que el backend y el frontend estén corriendo localmente (`http://localhost:8080` y `http://localhost:4200`). Ver [despliegue local](../06-operacion/despliegue-y-recuperacion.md).

---

## PDFs sintéticos

Los PDFs usados por los scripts y para la carga manual de datos demo se encuentran en:

```
backend/bootstrap/src/main/resources/docs/
├── Historia_Clinica_20_Pacientes-1.pdf
├── Historia_Clinica_20_Pacientes-2.pdf
│   …
└── Historia_Clinica_20_Pacientes-20.pdf
```

Son 20 historias clínicas sintéticas (sin datos de pacientes reales) generadas para demostración del módulo clínico y de OCR. Cada archivo tiene estructura de formulario médico con campos de texto para que el extractor OCR pueda reconocer entidades.

> [!CAUTION]
> No usar datos clínicos reales en los entornos de demo. Estos PDFs son completamente ficticios.

---

## Proceso de poblado paso a paso

### 1. Crear tenants de demo (pago simulado)

Con el backend corriendo **sin** `STRIPE_API_KEY` configurada:

```bash
# Crear tenant BASIC mensual
curl -s -X POST http://localhost:8080/api/v1/public/subscriptions/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "tenantName": "Clínica Demo",
    "adminEmail": "admin@demo.local",
    "adminPassword": "Demo1234!",
    "administratorName": "Administrador Demo",
    "planCode": "BASIC",
    "billingPeriod": "MONTHLY"
  }'
```

La respuesta incluye `sessionId` con prefijo `sim_` y `checkoutUrl` apuntando a `/planes/exito`. El tenant queda `ACTIVE` de inmediato; no se requiere confirmación de Stripe.

> [!TIP]
> Puedes crear múltiples tenants cambiando `tenantName`, `adminEmail` y `planCode` (`BASIC`, `PRO`, `ENTERPRISE`). Cada uno recibe su propio esquema de base de datos si el routing de tenant aislado está activo.

### 2. Crear usuarios adicionales

Después de hacer login con el administrador creado en el paso anterior:

```bash
# Login para obtener token
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"usernameOrEmail":"admin@demo.local","password":"Demo1234!","tenantName":"Clínica Demo"}' \
  | jq -r '.token')

# Crear usuario operador
curl -s -X POST http://localhost:8080/api/v1/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Operador Demo",
    "email": "operador@demo.local",
    "password": "Demo1234!",
    "roleId": "<uuid-rol-operador>"
  }'
```

### 3. Cargar documentos con Playwright

```powershell
# Desde la raíz del proyecto
node scripts/tests/document-operations-browser.cjs
```

El script:
1. Hace login como administrador del tenant demo.
2. Sube cada PDF de `backend/bootstrap/src/main/resources/docs/`.
3. Aplica operaciones (clasificación, traducción si está habilitada, revisión de OCR).
4. Verifica que el documento quede en estado `PUBLISHED`.
5. Emite `DOCUMENT_OPERATIONS_BROWSER_OK` al finalizar sin errores.

### 4. Verificar datos cargados

```bash
# Listar documentos del tenant
curl -s http://localhost:8080/api/v1/documents \
  -H "Authorization: Bearer $TOKEN" | jq '.totalElements'

# Ver transacciones de facturación simuladas
curl -s http://localhost:8080/api/v1/billing/transactions \
  -H "Authorization: Bearer $TOKEN" | jq '.[0].metadata'
# Esperado: {"mode":"simulated","kind":"tenant_signup"}
```

---

## Archivos de salida esperados

Los scripts generan los siguientes artefactos locales al ejecutarse (no versionados):

| Archivo | Contenido |
|---|---|
| `tenants.json` *(si se genera)* | Lista de IDs y nombres de tenants creados en la sesión |
| `users.json` *(si se genera)* | Lista de usuarios creados con sus roles |
| `data.json` *(si se genera)* | Resumen de documentos subidos y su estado final |

> [!NOTE]
> Los scripts actuales (`document-operations-browser.cjs`, `mail-intake-receive-browser.cjs`) imprimen resultados por consola y no escriben JSON a disco. Si se necesita persistencia, agregar `fs.writeFileSync('data.json', JSON.stringify(results))` al final de cada script.

---

## Integración con pruebas HU

| HU | Script relacionado | Señal de éxito |
|---|---|---|
| HU-19 Multitenant | Creación de múltiples tenants con pago simulado | Tenants aislados, sin acceso cruzado |
| HU-20 Usuarios y permisos | Login con distintos roles creados en paso 2 | Acceso restringido por permiso |
| HU-21 Logs SaaS | Revisión de `GET /api/v1/platform/technical-logs` | Errores HTTP registrados, sin datos clínicos |
| HU-22 Reportes y voz | `report-query.test.mjs` + UI de voz | Filtros reconocidos, exportación OK |
| HU-23 Backups | `backup-full.test.sh` | `DATABASE_TESTS_OK` |
| HU-24 Asistente | Chatbot en `/help` con prompt de demo | Respuesta de intención fija, sin datos clínicos enviados a Gemini |

---

Fuentes: [document-operations-browser.cjs](../../../scripts/tests/document-operations-browser.cjs), [mail-intake-receive-browser.cjs](../../../scripts/tests/mail-intake-receive-browser.cjs), [test-sprint3-all.ps1](../../../scripts/tests/test-sprint3-all.ps1), [Historia_Clinica PDFs](../../../backend/bootstrap/src/main/resources/docs/), [SimulatedSubscriptionService.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/SimulatedSubscriptionService.java).
