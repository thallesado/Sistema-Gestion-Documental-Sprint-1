# NexoDocs - Sistema de Gestión Documental

Plataforma integral y modularizada para la gestión, control y trazabilidad de documentos clínicos y organizacionales. Diseñada bajo principios de **Arquitectura Limpia / Hexagonal**, **Frontend Angular Modular (Feature-Driven)**, **Flutter Clean Architecture** y orquestación con **Docker**.

---

## 📁 Estructura del Monorepo

```text
Sistema-Gestion-Documental-Sprint-1/
├── .github/workflows/          # Pipelines de CI/CD (Backend, Frontend, Mobile)
├── Makefile                    # Atajos de orquestación y pruebas
├── infrastructure/             # Docker Compose, Dockerfiles y configuración de Nginx
│   ├── docker-compose.yml
│   └── docker/
│       ├── backend.Dockerfile
│       ├── frontend.Dockerfile
│       └── nginx.conf
├── backend/                    # Spring Boot 3 (Java 21) - Multi-módulo Hexagonal
│   ├── bootstrap/              # Punto de entrada y configuración principal (Spring Boot Main)
│   ├── shared/                 # DTOs, excepciones, JwtUtils y utilitarios comunes
│   └── modules/                # Módulos de dominio desacoplados
│       ├── autenticacion/      # Seguridad, JWT, roles y permisos
│       ├── usuarios/           # Gestión de usuarios, perfiles y organizaciones (Tenants)
│       ├── documentos/         # Repositorio y gestión documental (versionado, OCR)
│       ├── expedientes/        # Expedientes clínicos y administrativos
│       ├── clinico/            # Historias clínicas, notas médicas y diagnósticos
│       ├── auditoria/          # Trazabilidad inmutable y registro de eventos
│       ├── tablero/            # Espacios de trabajo, resúmenes y métricas
│       └── reportes/           # KPIs, exportación y reportes analíticos
├── frontend/                   # Angular 19+ (Standalone Components, Feature-Driven)
│   ├── src/app/core/           # Servicios singleton, auth, interceptores, guards y modelos
│   ├── src/app/shell/          # Layout maestro (Sidebar Dark Forest, Topbar, User Menu)
│   ├── src/app/shared/         # Componentes, directivas y pipes reutilizables
│   └── src/app/features/       # Módulos de negocio (Auth, Tablero, Documentos, Expedientes, etc.)
├── mobile/                     # Flutter (Feature-First + Clean Architecture + BLoC)
│   └── lib/
│       ├── injection/          # Contenedor de inyección de dependencias (GetIt)
│       ├── core/               # Configuración, cliente HTTP (Dio), temas y router
│       └── features/           # Funcionalidades por capas (Data, Domain, Presentation)
├── database/                   # Scripts SQL, esquemas modulares y semillas PostgreSQL
└── packages/
    └── shared/                 # Modelos, DTOs y utilidades TypeScript compartidas
```

---

## 🚀 Inicio Rápido (Modo Desarrollo)

### Requisitos previos
- **Java 21+** y Maven Wrapper (`mvnw`)
- **Node.js 20+** y **pnpm** (`npm install -g pnpm`)
- **Docker Desktop** (para la base de datos PostgreSQL y servicios de soporte)
- **Flutter 3.24+** (opcional para el cliente móvil)

---

### Paso 1: Levantar la Base de Datos (PostgreSQL)
Desde la **raíz del proyecto**, inicia el contenedor de base de datos:

```powershell
docker compose -f infrastructure/docker-compose.yml up -d postgres
```
> La base de datos se inicializa con los esquemas y datos semilla para todos los módulos.

---

### Paso 2: Compilar y Ejecutar el Backend (Spring Boot Multi-Módulo)
En una terminal:

1. **Compilar e instalar los módulos en el repositorio local:**
   ```powershell
   cd backend
   .\mvnw.cmd clean install -DskipTests
   ```

2. **Ejecutar el módulo `bootstrap`:**
   ```powershell
   .\mvnw.cmd -pl bootstrap spring-boot:run
   ```
   *(En Linux/macOS/Git Bash: `./mvnw clean install -DskipTests && ./mvnw -pl bootstrap spring-boot:run`)*

- **API Base:** `http://localhost:8080/api/v1`
- **Documentación Swagger / OpenAPI:** `http://localhost:8080/swagger-ui.html`
- **Health Check Actuator:** `http://localhost:8080/actuator/health`

---

### Paso 3: Ejecutar el Frontend (Angular)
En otra terminal, desde la **raíz del proyecto**:

1. Instalar dependencias del monorepo:
   ```powershell
   pnpm install
   ```

2. Compilar el paquete TypeScript compartido:
   ```powershell
   pnpm run build:shared
   ```

3. Iniciar el servidor de desarrollo:
   ```powershell
   pnpm dev
   ```
   *(o `cd frontend && pnpm start`)*

- **Acceso Web:** `http://localhost:4200`

---

### Paso 4: Ejecutar la App Móvil (Flutter)
En una terminal:

```powershell
cd mobile
flutter pub get
flutter run
```

---

## 🔑 Credenciales de Demostración

| Rol | Usuario / Correo | Contraseña | Organización (Tenant ID) |
| :--- | :--- | :--- | :--- |
| **Administrador de Tenant** | `laura@acme.com` | `DemoPass123!` | `20000000-0000-0000-0000-000000000001` |
| **Super Administrador** | `carlos@nexodocs.com` | `DemoPass123!` | *(Vacío / Global)* |
| **Supervisor** | `marcos@acme.com` | `DemoPass123!` | `20000000-0000-0000-0000-000000000001` |

---

## 🐳 Despliegue Completo con Docker Compose

Para levantar toda la solución orquestada (PostgreSQL + Backend + Frontend Nginx):

```powershell
# 1. Crear archivo de variables de entorno
Copy-Item .env.example .env

# 2. Construir y levantar servicios
docker compose -f infrastructure/docker-compose.yml up -d --build
```

Para detener los contenedores:
```powershell
docker compose -f infrastructure/docker-compose.yml down
```

---

## 🛠️ Comandos Frecuentes (Makefile)

Si dispones de la utilidad `make`, puedes usar los atajos:

| Tarea | Con Make | Comando Manual |
| :--- | :--- | :--- |
| **Levantar contenedores** | `make up` | `docker compose -f infrastructure/docker-compose.yml up -d` |
| **Detener contenedores** | `make down` | `docker compose -f infrastructure/docker-compose.yml down` |
| **Reconstruir imágenes** | `make build` | `docker compose -f infrastructure/docker-compose.yml build` |
| **Ver logs en vivo** | `make logs` | `docker compose -f infrastructure/docker-compose.yml logs -f` |
| **Compilar Backend** | `make backend-build` | `cd backend && .\mvnw.cmd clean install -DskipTests` |
| **Pruebas Backend** | `make backend-test` | `cd backend && .\mvnw.cmd clean test` |
| **Pruebas Frontend** | `make frontend-test` | `cd frontend && pnpm test -- --watch=false` |
| **Pruebas Mobile** | `make mobile-test` | `cd mobile && flutter test` |
| **Limpiar volúmenes** | `make clean` | `docker compose -f infrastructure/docker-compose.yml down -v` |

---

## 📌 URLs y Servicios

| Servicio | URL / Puerto | Descripción |
| :--- | :--- | :--- |
| **Frontend Web** | `http://localhost:4200` | Interfaz de usuario (Angular 19+ Dark Forest Theme) |
| **Backend REST API** | `http://localhost:8080/api/v1` | Endpoints modulares de negocio |
| **Swagger / OpenAPI** | `http://localhost:8080/swagger-ui.html` | Explorador interactivo de la API REST |
| **PostgreSQL** | `127.0.0.1:5432` | Base de datos relacional con RLS |
