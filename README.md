# NexoDocs - Sistema de Gestion Documental

NexoDocs es una aplicacion web para organizar y controlar documentos de empresas,
clinicas, universidades e instituciones. Esta version sigue siendo un prototipo
visual en varios modulos, con un backend Spring Boot inicial y PostgreSQL local.

## Inicio rapido local

La aplicacion se ejecuta en tres niveles. Abre tres terminales de PowerShell
desde la raiz del repositorio y mantenlas abiertas mientras trabajas.

### 1. PostgreSQL con Docker

```powershell
docker compose up -d --wait
```

Comprueba que el contenedor este saludable:

```powershell
docker compose ps
```

PostgreSQL queda publicado en `127.0.0.1:5434`. Este puerto evita el conflicto
con instalaciones locales de PostgreSQL que suelen utilizar `5433`.

### 2. Backend Spring Boot

En la segunda terminal:

```powershell
$env:DB_URL = "jdbc:postgresql://127.0.0.1:5434/nexodocs"
$env:DB_USERNAME = "nexodocs"
$env:DB_PASSWORD = "nexodocs_dev"
$env:JWT_SECRET = "change-this-development-secret-at-least-32-bytes"
$env:CORS_ALLOWED_ORIGINS = "http://localhost:4200"

Set-Location ".\backend"
mvn spring-boot:run
```

El backend queda disponible en `http://localhost:8080`.

### 3. Frontend Angular

En la tercera terminal:

```powershell
pnpm dev
```

Abre el navegador en:

```text
http://localhost:4200
```

La primera pagina es el login. Credenciales de demostracion:

```text
Tenant:       20000000-0000-0000-0000-000000000001
Usuario:      laura@acme.com
Contrasena:   DemoPass123!
```

Tambien puedes usar el usuario `laura.martinez` con la misma contrasena.

Para detener PostgreSQL sin borrar los datos:

```powershell
docker compose stop
```

No ejecutes `docker compose down --volumes` salvo que quieras eliminar
intencionalmente el volumen local y todos sus datos.

## 1. Que necesitas instalar

1. **Node.js 22.12 o superior**
2. **Visual Studio Code**
3. **pnpm 12**

Para instalar pnpm:

```bash
npm install --global pnpm
```

## 2. Instalar librerias

Desde la raiz del proyecto:

```bash
pnpm install
```

## 3. Encender solo el frontend

```bash
pnpm dev
```

Abre:

```text
http://localhost:4200
```

Si el puerto esta ocupado:

```bash
pnpm dev -- --port 4201
```

## 4. Comandos importantes

| Comando | Que hace |
| --- | --- |
| `pnpm install` | Instala las dependencias del workspace. |
| `pnpm dev` | Inicia Angular en modo desarrollo. |
| `pnpm build` | Compila la app para publicacion. |
| `pnpm typecheck` | Verifica TypeScript de la interfaz. |
| `pnpm test` | Verifica el mapa de rutas Angular. |
| `pnpm start` | Sirve la app con configuracion de produccion. |

## 5. Tecnologia actual

- **Angular 20 LTS**: framework del frontend.
- **TypeScript 5.9**: tipado y compilacion.
- **CSS propio**: conserva el estilo turquesa, blanco y gris claro del prototipo.
- **pnpm workspaces**: los comandos de raiz delegan a `frontend/`.
- **PostgreSQL 17 con Docker Compose**: base local documentada en `database/`.
- **Spring Boot 3.2.4 / Java 21**: backend API en `backend/`, incorporado como
  backend oficial actual del proyecto.

La migracion reemplazo Next.js/React como tecnologia activa del frontend.
El backend actual usa Spring Boot/Java; NestJS se conserva como una alternativa
futura de Node.js, no como tecnologia implementada en este repositorio.

## 6. Archivos principales

- `frontend/src/app/core/routes/app.routes.ts`: rutas reales de Angular.
- `frontend/src/app/core/data/nexodocs-data.ts`: menu, roles, URLs y datos simulados.
- `frontend/src/app/features/workspace/workspace-page.ts`: pantalla reutilizable del panel.
- `frontend/src/app/shell/app.html`: shell visual con sidebar, topbar y asistente.
- `frontend/src/app/shell/app.css`: identidad visual y responsive.
- `frontend/src/app/features/auth/login-page.ts`: login visual de demostracion.
- `frontend/src/app/core/config/app.config.ts`: proveedor de Angular Router.
- `docs/ARQUITECTURA.md`: mapa tecnico del frontend.
- `database/`: esquemas, migraciones, datos iniciales y pruebas de PostgreSQL.

Ejemplos de URLs:

- `/`
- `/documents/new`
- `/documents/upload`
- `/workflows/designer`
- `/settings/security`
- `/tenants/branding`
- `/login`

## 7. Base de datos

La base de datos sigue separada del frontend. No hay conexion directa desde el
navegador a PostgreSQL.

Para levantar solo PostgreSQL:

```bash
docker compose up -d --wait postgres
```

La validacion de base de datos se mantiene en:

```powershell
powershell -NoProfile -File database/tests/run.ps1
```

## 8. Backend

El backend se ejecuta desde `backend/`:

```powershell
Set-Location backend
mvn test
mvn spring-boot:run
```

La configuración sensible se obtiene desde variables de entorno:

```text
DB_URL
DB_USERNAME
DB_PASSWORD
JWT_SECRET
JWT_EXPIRATION_MS
```

El backend debe utilizar la base PostgreSQL oficial y sus migraciones. Todavía
no se debe considerar completa la integración multitenant: el contexto RLS,
RBAC general y los módulos documentales siguen pendientes.

## 9. Estado real del sistema

El frontend conserva modulos de demo visual. Por eso:

- El login Angular consume la API de autenticacion JWT inicial.
- El rol seleccionado solo filtra el menu.
- Las acciones muestran comportamiento de demo.
- Los documentos, workflows, auditoria y tenants no se guardan desde el frontend.
- La revocacion de tokens se mantiene en memoria durante la vida del backend.
- El backend aun no establece de forma completa el contexto `tenant_id` y
  `user_id` de PostgreSQL.
- El registro explicativo de cambios se mantiene en `docs/REGISTRO_CAMBIOS.md`.

## 10. Agentes del proyecto

Los agentes personalizados del repositorio se encuentran en
`.github/agents/`. Cada uno tiene un alcance específico para reducir solapamientos,
mantener el contexto del proyecto y usar la asistencia de IA de forma organizada.

| Agente | Trabajo principal |
| --- | --- |
| `nexodocs-coordinador` | Entiende el objetivo general, divide tareas por responsabilidad, deriva el trabajo al agente adecuado, evita que varios agentes modifiquen los mismos archivos e integra las validaciones. |
| `nexodocs-frontend-angular` | Mantiene el frontend Angular: componentes standalone, rutas, shell, sidebar, estilos, responsive, estado local de la demo, TypeScript y accesibilidad. |
| `nexodocs-base-datos` | Mantiene PostgreSQL, migraciones nuevas, RLS, RBAC, aislamiento multitenant, integridad de versiones, auditoría y pruebas SQL. No modifica migraciones ya aplicadas, especialmente `004_saas_hardening`. |
| `nexodocs-documentacion` | Actualiza `README.md`, `docs/ARQUITECTURA.md`, `docs/CONTEXTO_PROYECTO.md` y las decisiones técnicas usando únicamente capacidades comprobadas en el código. |
| `nexodocs-revisor` | Revisa cambios existentes sin editar archivos: lógica, imports, rutas, tipos, regresiones, separación de responsabilidades y cumplimiento de las reglas del proyecto. |
| `nexodocs-pruebas` | Ejecuta las validaciones existentes, como `pnpm typecheck`, `pnpm test`, `pnpm build` y las pruebas PostgreSQL cuando corresponda. Reporta errores sin corregirlos automáticamente. |
| `nexodocs-explorador` | Inspecciona una solicitud sin modificar archivos, localiza el área afectada, identifica riesgos y recomienda qué agente debe realizar el trabajo. |

### Flujo recomendado

Para una tarea que afecte varias áreas:

```text
nexodocs-explorador
        ↓
nexodocs-coordinador
        ↓
agente especializado
        ↓
nexodocs-revisor
        ↓
nexodocs-pruebas
```

Para tareas pequeñas se puede utilizar directamente el agente especializado.
Los agentes no sustituyen la revisión humana y no deben asumir que existe
backend, autenticación o persistencia real mientras esas partes no estén
implementadas.
