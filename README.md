# NexoDocs - Sistema de Gestión Documental

Plataforma integral y modularizada para la gestión, control y trazabilidad de documentos clínicos y organizacionales. Diseñada bajo principios de **Arquitectura Limpia / Hexagonal**, **Feature-Driven Frontend**, **Flutter Clean Architecture** y orquestación con **Docker**.

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
│   ├── bootstrap/              # Punto de entrada de la aplicación Spring Boot
│   ├── shared/                 # DTOs, excepciones, JwtUtils y utilitarios comunes
│   └── modules/                # Módulos de dominio desacoplados
│       ├── autenticacion/      # Seguridad, JWT, roles y permisos
│       ├── usuarios/           # Gestión de usuarios y organizaciones
│       ├── documentos/         # Repositorio y gestión documental
│       ├── expedientes/        # Expedientes clínicos y administrativos
│       ├── clinico/            # Historias clínicas y notas médicas
│       ├── auditoria/          # Trazabilidad y registro de eventos
│       ├── tablero/            # Espacios de trabajo y resúmenes
│       └── reportes/           # KPIs y reportes analíticos
├── frontend/                   # Angular 20 (Feature-Driven / Lazy Loading)
│   ├── src/app/core/           # Servicios singleton, interceptores, guards y modelos
│   ├── src/app/layout/         # Componentes estructurales (Header, Sidebar, Main Layout)
│   ├── src/app/shared/         # Componentes, directivas y pipes reutilizables
│   └── src/app/features/       # Módulos de negocio (Auth, Users, Documentos, etc.)
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
- **Java 21+**
- **Node.js 22+** y **pnpm** (`npm install -g pnpm`)
- **Flutter 3.24+** (para desarrollo móvil)
- **Docker Desktop** (para la base de datos y despliegues)

---

### Paso 1: Levantar la Base de Datos (PostgreSQL)
Desde la **raíz del proyecto**, ejecuta:

```powershell
docker compose -f infrastructure/docker-compose.yml up -d postgres
```
> La base de datos queda accesible en el puerto local `5432` (o configurado en `.env`).

---

### Paso 2: Ejecutar el Backend (Spring Boot)
En una terminal:

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```
*(En Linux/macOS/Git Bash: `./mvnw spring-boot:run`)*

- **API Base:** `http://localhost:8080/api/v1`
- **Documentación Swagger / OpenAPI:** `http://localhost:8080/swagger-ui.html`

---

### Paso 3: Ejecutar el Frontend (Angular)
En otra terminal, desde la **raíz del proyecto**:

1. Instalar dependencias:
   ```powershell
   pnpm install
   ```

2. Compilar el paquete compartido (si aplica):
   ```powershell
   pnpm run build:shared
   ```

3. Iniciar el servidor de desarrollo:
   ```powershell
   pnpm dev
   ```

- **Acceso web:** `http://localhost:4200`

---

### Paso 4: Ejecutar la App Móvil (Flutter)
En una terminal:

```powershell
cd mobile
flutter pub get
flutter run
```

---

## 🐳 Despliegue Completo con Docker Compose

Para levantar toda la infraestructura (Base de Datos + Backend + Frontend con Nginx):

```powershell
# 1. Copiar variables de entorno
Copy-Item .env.example .env

# 2. Construir y levantar
docker compose -f infrastructure/docker-compose.yml up -d --build
```

Para detener los contenedores:
```powershell
docker compose -f infrastructure/docker-compose.yml down
```

---

## 🛠️ Comandos Frecuentes y Makefile

Si dispones de `make`, puedes usar los siguientes atajos desde la raíz:

| Tarea | Con Make | Comando Manual |
| :--- | :--- | :--- |
| **Levantar contenedores** | `make up` | `docker compose -f infrastructure/docker-compose.yml up -d` |
| **Detener contenedores** | `make down` | `docker compose -f infrastructure/docker-compose.yml down` |
| **Reconstruir imágenes** | `make build` | `docker compose -f infrastructure/docker-compose.yml build` |
| **Ver logs en vivo** | `make logs` | `docker compose -f infrastructure/docker-compose.yml logs -f` |
| **Pruebas Backend** | `make backend-test` | `cd backend && .\mvnw.cmd clean test` |
| **Pruebas Frontend** | `make frontend-test` | `cd frontend && pnpm test -- --watch=false` |
| **Pruebas Mobile** | `make mobile-test` | `cd mobile && flutter test` |
| **Limpiar volúmenes** | `make clean` | `docker compose -f infrastructure/docker-compose.yml down -v` |

---

## 📌 URLs y Servicios

| Servicio | URL / Puerto | Descripción |
| :--- | :--- | :--- |
| **Frontend Web** | `http://localhost:4200` | Interfaz web de usuario (Angular) |
| **Backend REST API** | `http://localhost:8080` | Endpoints y servicios de negocio |
| **Swagger / OpenAPI** | `http://localhost:8080/swagger-ui.html` | Explorador y documentación de la API |
| **PostgreSQL** | `127.0.0.1:5432` | Base de datos relacional con RLS |

### Credenciales de Demostración
- **Usuario:** `laura@acme.com`
- **Contraseña:** `DemoPass123!`
- **Tenant ID:** `20000000-0000-0000-0000-000000000001`
