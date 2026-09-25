# NexoDocs - Sistema de Gestión Documental

Plataforma integral para la gestión, control y trazabilidad de documentos clínicos y organizacionales.

---

## 📁 Estructura del Proyecto (Monorepo)

```text
Sistema-Gestion-Documental-Sprint-1/
├── apps/
│   ├── backend/         # API REST Spring Boot 3 (Java 21) modularizado
│   ├── frontend/        # Aplicación Web Angular 20 modularizada
│   └── mobile/          # Aplicación móvil clínica (Flutter)
├── packages/
│   └── shared/          # Modelos y contratos TypeScript compartidos
├── database/            # Scripts SQL, esquemas y migraciones PostgreSQL
└── docker-compose.yml   # Orquestación de contenedores
```

---

## 🚀 Inicio Rápido (Modo Desarrollo)

### Requisitos previos
- **Java 21+**
- **Node.js 22+** y **pnpm** (`npm install -g pnpm`)
- **Docker Desktop** (para la base de datos)

---

### Paso 1: Levantar la Base de Datos (PostgreSQL)
Desde la **raíz del proyecto**, ejecuta:

```powershell
docker compose up -d postgres
```
> La base de datos queda accesible en el puerto local `5434`.

---

### Paso 2: Ejecutar el Backend (Spring Boot)
En una terminal:

```powershell
cd apps/backend
.\mvnw.cmd spring-boot:run
```
*(En Linux/Mac/Git Bash: `./mvnw spring-boot:run`)*

- **API Base:** `http://localhost:8080/api/v1`
- **Documentación Swagger / OpenAPI:** `http://localhost:8080/swagger-ui.html`

---

### Paso 3: Ejecutar el Frontend (Angular)
En otra terminal, desde la **raíz del proyecto**:

1. Instalar dependencias (solo la primera vez):
   ```powershell
   pnpm install
   ```

2. Iniciar el servidor de desarrollo:
   ```powershell
   pnpm dev
   ```

- **Acceso web:** `http://localhost:4200`

---

## 🐳 Alternativa: Levantar todo con Docker Compose

Si prefieres levantar PostgreSQL, Backend y Frontend juntos en contenedores:

```powershell
# 1. Copiar variables de entorno
Copy-Item .env.example .env

# 2. Construir y levantar
docker compose up -d --build
```

Para detener los contenedores:
```powershell
docker compose down
```

---

## 📌 URLs y Servicios

| Servicio | URL / Puerto | Descripción |
| :--- | :--- | :--- |
| **Frontend** | `http://localhost:4200` | Interfaz web de usuario |
| **Backend API** | `http://localhost:8080` | Endpoints REST |
| **Swagger UI** | `http://localhost:8080/swagger-ui.html` | Explorador interactivo de la API |
| **PostgreSQL** | `127.0.0.1:5434` | Base de datos relacional con RLS |

### Credenciales de Demostración
- **Usuario:** `laura@acme.com`
- **Contraseña:** `DemoPass123!`
- **Tenant ID:** `20000000-0000-0000-0000-000000000001`

---

## 🛠️ Comandos Frecuentes

| Tarea | Comando | Dónde ejecutarlo |
| :--- | :--- | :--- |
| Iniciar frontend | `pnpm dev` | Raíz |
| Compilar frontend | `pnpm build` | Raíz |
| Verificar TypeScript | `pnpm typecheck` | Raíz |
| Pruebas frontend | `pnpm test` | Raíz |
| Compilar backend | `.\mvnw.cmd compile -DskipTests` | `apps/backend/` |
| Pruebas backend | `.\mvnw.cmd test` | `apps/backend/` |
| Ejecutar backend | `.\mvnw.cmd spring-boot:run` | `apps/backend/` |
