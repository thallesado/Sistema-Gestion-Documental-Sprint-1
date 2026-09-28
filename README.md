# NexoDocs - Sistema de Gestion Documental

NexoDocs es una aplicacion web para organizar y controlar documentos de empresas,
clinicas, universidades e instituciones. Esta version sigue siendo un prototipo
visual en varios modulos, con un backend Spring Boot inicial y PostgreSQL local.

## Inicio rapido con Docker Compose

Docker Compose levanta PostgreSQL, el backend Spring Boot y el frontend Angular
en conjunto. Es la forma recomendada para probar el sistema completo sin abrir
tres terminales.

### Requisitos

Instala Docker Desktop para Windows y asegúrate de que el motor Linux esté
iniciado. Comprueba la instalación con:

```powershell
docker --version
docker compose version
```

### 1. Crear la configuración local

Desde la raíz del repositorio, copia el archivo de ejemplo:

```powershell
Copy-Item .env.example .env
```

Edita `.env` y cambia como mínimo `POSTGRES_PASSWORD` y `JWT_SECRET`. El secreto
JWT debe tener al menos 32 bytes. No subas `.env` a Git ni compartas sus valores.

### 2. Construir y levantar todo

```powershell
docker compose up -d --build --wait
```

Este comando construye las imágenes si es necesario, crea los contenedores,
espera a que PostgreSQL y Spring Boot estén saludables y deja el frontend
disponible en:

```text
http://localhost:4200
```

Los servicios quedan disponibles en:

| Servicio | URL o puerto |
| --- | --- |
| Frontend Angular/Nginx | `http://localhost:4200` |
| Backend Spring Boot/OpenAPI | `http://localhost:8080/v3/api-docs` |
| PostgreSQL | `127.0.0.1:5434` |

El frontend proxifica `/api/` hacia el backend dentro de la red de Compose. El
navegador no se conecta directamente a PostgreSQL.

### 3. Comprobar el estado y consultar logs

```powershell
docker compose ps
docker compose logs -f
```

Para consultar un servicio concreto:

```powershell
docker compose logs -f postgres
docker compose logs -f backend
docker compose logs -f frontend
```

Para detener los servicios sin borrar datos:

```powershell
docker compose stop
```

Para detener y eliminar los contenedores conservando los volúmenes:

```powershell
docker compose down
```

No ejecutes `docker compose down --volumes` salvo que quieras eliminar
intencionalmente PostgreSQL y el almacenamiento documental local.

### Migraciones y datos existentes

Las migraciones de `database/init/` se aplican automáticamente solamente cuando
PostgreSQL se inicializa con un volumen vacío. Si ya existe el volumen
`nexodocs_postgres_data`, utiliza el migrador incremental:

```powershell
powershell -NoProfile -File .\database\migrate.ps1
```

No edites migraciones ya aplicadas ni elimines el volumen para “forzar” cambios.

### Credenciales de demostración

```text
Tenant:       20000000-0000-0000-0000-000000000001
Usuario:      laura@acme.com
Contrasena:   DemoPass123!
```

La recuperación de contraseña requiere configurar SMTP en `.env`. Las
credenciales de Mailtrap no deben guardarse en Git.

## Inicio rapido local con hot reload

Este modo es útil para desarrollar porque Angular y Spring Boot se recompilan
sin reconstruir las imágenes en cada cambio. Mantén PostgreSQL en Docker:

```powershell
docker compose up -d postgres
```

En una terminal de PowerShell, inicia Spring Boot desde `backend/`:

```powershell
$env:DB_URL = "jdbc:postgresql://127.0.0.1:5434/nexodocs"
$env:DB_USERNAME = "nexodocs"
$env:DB_PASSWORD = "nexodocs_dev"
$env:JWT_SECRET = "change-this-development-secret-at-least-32-bytes"
$env:CORS_ALLOWED_ORIGINS = "http://localhost:4200"
$env:FRONTEND_URL = "http://localhost:4200"

# Mailtrap SMTP (completa el token sin guardarlo en Git)
$env:MAIL_HOST = "live.smtp.mailtrap.io"
$env:MAIL_PORT = "587"
$env:MAIL_USERNAME = "api"
$env:MAIL_PASSWORD = "reemplaza-con-un-token-nuevo-de-mailtrap"
$env:MAIL_SMTP_AUTH = "true"
$env:MAIL_SMTP_STARTTLS = "true"
$env:MAIL_FROM = "hello@demomailtrap.co"

Set-Location ".\backend"
mvn spring-boot:run
```

En otra terminal, inicia Angular desde la raíz:

```powershell
pnpm dev
```

Abre el navegador en `http://localhost:4200`.

El modo Docker Compose completo es el recomendado para demos, validación
integrada y preparación del despliegue. El modo local con hot reload es más
cómodo para modificar código diariamente.

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
