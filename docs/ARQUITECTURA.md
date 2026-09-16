# Arquitectura y mapa de pantallas

Actualizacion: 2026-09-15. El frontend activo fue migrado de Next.js/React a
Angular 20 LTS. La base de datos PostgreSQL y sus migraciones no cambiaron.

## Estructura

```text
nexodocs/
├── frontend/
│   ├── angular.json
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/
│   │   │   │   ├── config/
│   │   │   │   │   └── app.config.ts      # Proveedores de Angular
│   │   │   │   ├── data/
│   │   │   │   │   └── nexodocs-data.ts   # Menu, roles, URLs y datos demo
│   │   │   │   └── routes/
│   │   │   │       └── app.routes.ts       # Rutas reales de Angular
│   │   │   ├── features/
│   │   │   │   ├── auth/
│   │   │   │   │   └── login-page.ts       # Login visual
│   │   │   │   ├── not-found/
│   │   │   │   │   └── not-found-page.ts   # Ruta no encontrada
│   │   │   │   └── workspace/
│   │   │   │       └── workspace-page.ts   # Pantalla reutilizable del panel
│   │   │   └── shell/
│   │   │       ├── app.ts                  # Componente principal del shell
│   │   │       ├── app.html                # Sidebar, topbar, asistente
│   │   │       └── app.css                 # Identidad visual y responsive
│   │   ├── main.ts
│   │   ├── index.html
│   │   └── styles.css
│   ├── public/
│   └── tests/
├── database/
├── docs/
├── compose.yaml
├── package.json
└── pnpm-lock.yaml
```

La carpeta `frontend/src/app/(workspace)` y los antiguos componentes `.tsx`
pueden aparecer en el historial de Git o en editores abiertos, pero ya no son la
entrada activa de la aplicacion Angular.

## Donde editar

Para agregar o cambiar una ruta, edita `frontend/src/app/core/data/nexodocs-data.ts`.
`navigationRoutes` se genera desde el menu y `frontend/src/app/core/routes/app.routes.ts`
lo convierte en rutas Angular. Esto conserva URLs directas, recarga y navegacion con
Atras/Adelante.

Para cambiar el layout general, edita `frontend/src/app/shell/app.html` y
`frontend/src/app/shell/app.css`.

Para cambiar la pantalla comun de modulos, edita
`frontend/src/app/features/workspace/workspace-page.ts`. Actualmente compone
listados, formularios de demo, KPIs y notas de persistencia simulada.

Para cambiar el login visual, edita `frontend/src/app/features/auth/login-page.ts`.

## Navegacion y estado

El shell usa Angular Router y componentes standalone. El rol visual se guarda en
estado local con signals y filtra el menu como demo. Las URLs no implementan
autenticacion ni autorizacion real.

La app conserva 78 rutas funcionales:

- Inicio: `/`, `/dashboard/activity`, `/dashboard/tasks`, `/dashboard/indicators`
- Expedientes: `/expedients`, `/expedients/new`, `/expedients/active`, `/expedients/closed`, `/expedients/archived`
- Documentos: `/documents`, `/documents/new`, `/documents/upload`, `/documents/mine`, `/documents/shared`, `/documents/recent`, `/documents/pending`, `/documents/in-review`, `/documents/approved`, `/documents/archived`, `/documents/trash`
- Digitalizacion: `/digitization`, `/digitization/upload`, `/digitization/ocr`, `/digitization/validation`, `/digitization/indexing`, `/digitization/metadata`
- Workflows: `/workflows`, `/workflows/tasks`, `/workflows/pending-review`, `/workflows/pending-approval`, `/workflows/active`, `/workflows/completed`, `/workflows/templates`, `/workflows/designer`
- Usuarios: `/users`, `/users/new`, `/users/active`, `/users/blocked`, `/users/roles`, `/users/permissions`, `/users/areas`, `/users/groups`
- Auditoria: `/audit`, `/audit/access`, `/audit/document-creation`, `/audit/modifications`, `/audit/downloads`, `/audit/approvals`, `/audit/deletions`, `/audit/permissions`
- Reportes: `/reports`, `/reports/users`, `/reports/workflows`, `/reports/storage`, `/reports/audit`, `/reports/productivity`, `/reports/by-area`
- Notificaciones: `/notifications`, `/notifications/unread`, `/notifications/tasks`, `/notifications/approvals`, `/notifications/mentions`
- Configuracion: `/settings`, `/settings/document-types`, `/settings/statuses`, `/settings/metadata`, `/settings/tags`, `/settings/templates`, `/settings/retention`, `/settings/security`, `/settings/appearance`
- Tenants: `/tenants`, `/tenants/new`, `/tenants/active`, `/tenants/suspended`, `/tenants/plans`, `/tenants/storage`, `/tenants/branding`

## Limites y persistencia

El backend inicial está implementado en `backend/` con Spring Boot 3.2.4 y Java 21.
Las operaciones documentales, login completo, roles, OCR, reportes y datos
siguen siendo simulados. Un futuro backend debe encapsular persistencia, resolver
tenant/usuario autenticados, aplicar RBAC y establecer el contexto RLS descrito en
el diseño de base de datos.

El navegador no se conecta a PostgreSQL.

## Desarrollo y pruebas

Desde la raiz:

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm test
pnpm build
```

Para verificar respuestas HTTP de las rutas, inicia `pnpm dev` y ejecuta:

```powershell
$env:APP_URL = 'http://localhost:4200'
pnpm test
Remove-Item Env:APP_URL
```

Sin `APP_URL`, la prueba HTTP se omite y solo se valida la integridad del mapa de
rutas.
