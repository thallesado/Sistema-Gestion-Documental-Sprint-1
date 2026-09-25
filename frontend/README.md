# NexoDocs - Frontend (Angular 20 LTS)

Frontend del sistema de gestión documental SaaS multitenant. Construido con **Angular 20**, arquitectura basada en dominios (**Feature-Driven Architecture**) y componentes autónomos (**Standalone Components**) con carga diferida (**Lazy Loading**).

---

## 🏛️ Arquitectura y Estructura de Directorios

El código está estructurado para maximizar la modularidad y facilitar el trabajo colaborativo en equipo sin conflictos de fusión en Git:

```text
src/app/
├── core/                       # Lógica singleton y servicios globales de la aplicación
│   ├── api/                    # Servicios cliente HTTP hacia la API REST
│   ├── auth/                   # Guards (authGuard, platformAdminGuard), interceptores y AuthService
│   ├── config/                 # appConfig y proveedores principales
│   ├── data/                   # Catálogos de rutas funcionales y datos estáticos
│   ├── routes/                 # app.routes.ts (enrutador raíz que integra feature routes)
│   └── state/                  # Estado global reactivo
│
├── shared/                     # UI Kit y utilidades reutilizables entre features
│   ├── components/             # Componentes comunes (Pagination, UserSelector, etc.)
│   ├── directives/             # Directivas compartidas
│   ├── pipes/                  # Pipes de transformación
│   └── index.ts                # Barrel export para importaciones limpias
│
├── shell/                      # Layout y cascarón estructural de la aplicación
│   ├── app.ts                  # Componente raíz con header, sidebar y router-outlet
│   ├── app.html                # Plantilla de layout con sidebar y barra superior
│   └── app.css                 # Estilos específicos del layout shell
│
└── features/                   # Módulos de negocio independientes (Autocontenidos)
    ├── administration/         # Gestión de usuarios del tenant y organizaciones (tenants)
    │   ├── administration.routes.ts
    │   └── administration-page.ts
    ├── audit/                  # Registro de auditoría y visor de eventos
    │   ├── audit-page.ts
    │   └── components/         # Filtros, paginación y drawer de eventos
    ├── auth/                   # Autenticación y recuperación de credenciales
    │   ├── auth.routes.ts
    │   ├── login-page.ts
    │   ├── forgot-password-page.ts
    │   └── reset-password-page.ts
    ├── clinical/               # Expediente clínico y notas médicas (módulo opcional)
    │   ├── clinical.routes.ts
    │   └── clinical-page.ts
    ├── documents/              # Gestión documental, ciclo de vida y versiones
    │   ├── documents.routes.ts
    │   └── document-page.ts
    ├── expedients/             # Gestión de expedientes administrativos
    │   ├── expedients.routes.ts
    │   ├── expedients-page.ts
    │   ├── expedients-page.html
    │   └── expedients-page.css
    ├── not-found/              # Páginas de error 404 y acceso restringido (403)
    ├── reports/                # Reportes analíticos y gráficos
    │   ├── reports-page.ts
    │   └── components/         # KPIs, gráficos, filtros y tablas de reporte
    └── workspace/              # Dashboard de trabajo del usuario
        └── workspace-page.ts
```

---

## 👥 Guía para el Trabajo en Equipo

### 1. Enrutamiento Modular y Lazy Loading
- **No agregues rutas directamente en `app.routes.ts`**.
- Cada módulo de `features/` posee su propio archivo `[feature].routes.ts` (por ejemplo, `documents.routes.ts`).
- Agrega tu nueva pantalla en el archivo de rutas de tu feature usando `loadComponent: () => import(...)`.
- `app.routes.ts` únicamente importa y concatena las rutas de cada feature, evitando colisiones de Git cuando varios desarrolladores agregan pantallas simultáneamente.

### 2. Dónde colocar un nuevo componente
- **¿Es exclusivo de una funcionalidad específica?**
  Colócalo dentro de `src/app/features/[nombre-feature]/components/`.
- **¿Se utiliza o reutilizará en dos o más features?**
  Colócalo dentro de `src/app/shared/components/` y expórtalo en `src/app/shared/index.ts`.
- **¿Es un servicio global, guard o interceptor?**
  Colócalo en `src/app/core/`.

### 3. Reactividad con Angular Signals
- Prefiere el uso de **Signals** (`signal()`, `computed()`) para el manejo de estado reactivo local en lugar de suscripciones manuales a RxJS.
- Cuando consumas llamadas HTTP de `api/`, suscríbete y asigna el resultado a una señal (`this.items.set(response)`).

### 4. Estándar de Componentes Standalone
- Todos los componentes son **Standalone** (`standalone: true`).
- Importa explícitamente en el arreglo `imports: [...]` los módulos o componentes que necesite la plantilla (`CommonModule`, `FormsModule`, `RouterLink`, etc.).

---

## 🛠️ Comandos de Desarrollo

Desde la raíz del repositorio o dentro de `frontend/`:

```powershell
# Iniciar servidor de desarrollo con proxy hacia el backend
pnpm dev

# Compilar para producción (genera bundles con lazy loading)
pnpm build

# Validar tipos de TypeScript sin emitir código
pnpm typecheck

# Ejecutar pruebas automatizadas de rutas y navegación
pnpm test
```
