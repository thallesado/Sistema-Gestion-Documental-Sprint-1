# Contexto permanente de NexoDocs

Antes de proponer o modificar código, lee íntegramente
[docs/CONTEXTO_PROYECTO.md](docs/CONTEXTO_PROYECTO.md), que conserva el documento
proporcionado por el usuario, y revisa los archivos reales relacionados con la tarea.
Aplica sus reglas de desarrollo, verificación y comunicación en cada trabajo sobre
este repositorio, junto con las instrucciones posteriores del usuario.

El documento combina decisiones del producto, requisitos futuros y una descripción
del estado inicial. Comprueba siempre la implementación y las versiones actuales;
no interpretes una capacidad contemplada como una funcionalidad existente. Conserva
el contexto al evolucionar el proyecto y documenta las decisiones que lo actualicen.

Prioridades: núcleo documental independiente del módulo clínico opcional,
aislamiento multitenant, autenticación y RBAC, versiones y auditoría inmutables.
Reutiliza la arquitectura y la identidad visual existentes. Antes de implementar,
explica los hallazgos, archivos afectados e inconsistencias; al terminar, informa
los cambios, las verificaciones realizadas y las limitaciones reales.

## Estado vigente de base de datos (2026-09-14)

Antes de cambiar SQL, lee también [docs/database/DISEÑO_Y_OPERACION.md](docs/database/DISEÑO_Y_OPERACION.md)
y [database/README.md](database/README.md). La migración `004_saas_hardening` añade
RBAC y contexto de usuario a RLS, integridad de versiones y workflows, auditoría
automática e índices. Conserva los 49 modelos públicos y las 45 tablas con RLS.
Los archivos 001..003 son la base histórica; los cambios posteriores se incorporan
como migraciones nuevas. No edites 004 una vez aplicada. Valida mediante
`powershell -NoProfile -File database/tests/run.ps1`, que usa Docker aislado.

Las consultas del backend necesitan `app.tenant_id` y `app.user_id` autenticados.
El frontend sigue simulado. Las limitaciones y responsabilidades pendientes están
documentadas en el diseño de base de datos; no infieras que existe autenticación.

## Estructura vigente (2026-09-15)

La aplicación activa está en `frontend/` y fue migrada a Angular 20 LTS. El backend
actual está en `backend/` y usa Spring Boot 3.2.4 con Java 21. Las rutas
se definen en `frontend/src/app/core/routes/app.routes.ts` desde el catálogo
`frontend/src/app/core/data/nexodocs-data.ts`; el layout principal vive en
`frontend/src/app/shell/app.html`, `frontend/src/app/shell/app.css` y la pantalla reutilizable
en `frontend/src/app/features/workspace/workspace-page.ts`. Consulta
[docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) para localizar cada pantalla.
Los comandos de raíz delegan al workspace: `pnpm dev`, `pnpm build`,
`pnpm typecheck` y `pnpm test`. El backend está en fase inicial y todavía no
implementa el contexto RLS ni todos los módulos documentales.

## Contraste inicial, anterior a la migración 004 (2026-09-13)

- La navegación y el rol se controlan mediante estado local en `app/page.tsx`.
  `TenantSelector` muestra "Acme Consulting" de forma fija; todavía no implementa
  un cambio de organización. Los datos y las acciones del frontend son simulados.
- Existen los scripts de PostgreSQL y Docker Compose, pero no hay un backend que
  conecte la interfaz con la base de datos.
- Las políticas RLS filtran por tenant; aún no aplican RBAC ni aislamiento por
  usuario para notificaciones. Los triggers protegen la inmutabilidad, pero no
  actualizan automáticamente `documents.current_version` ni generan la auditoría
  de las acciones de negocio. Esas operaciones siguen pendientes de implementación.
- La revisión estática de los scripts identifica 49 tablas y 45 tablas con RLS.
  Esto no sustituye ejecutar `database/tests/validate.sql`: esa prueba exige al
  menos 40 tablas y comprueba casos concretos de lectura RLS, una relación cruzada
  y el rechazo de UPDATE de versiones. No cubre todos los casos de aislamiento ni
  todas las operaciones sobre las tablas inmutables. No se ejecutó SQL en esta
  revisión documental.
