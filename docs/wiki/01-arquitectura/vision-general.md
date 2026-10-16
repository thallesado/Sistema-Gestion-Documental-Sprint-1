# Visión general y límites de NexoDocs

> Revisión documental: 2026-10-16. Base de código: `a590a6d`; ver [estado verificado](../05-guias-ia/estado-verificado-y-pendientes.md). Descripción del código inspeccionado, no certificación de producción.

NexoDocs es un gestor documental SaaS para organizaciones de distintos rubros. El núcleo incluye documentos, versiones, expedientes, usuarios, roles, workflows y auditoría. Pacientes e historias son una extensión clínica; no deben convertirse en requisitos de todos los tenants.

## Estructura real

| Ruta | Implementación |
|---|---|
| `backend/bootstrap` | Código funcional principalmente por capas; no asumir arquitectura hexagonal completa. |
| `backend/shared` | Utilidades compartidas Java; no confundir con módulos de negocio. |
| `backend/modules` | Scaffold Maven, sin implementación funcional de los módulos anunciados. |
| `frontend/src/app/features` | Funciones Angular standalone con lazy loading. |
| `frontend/src/app/shell` | Layout activo, sidebar, topbar y perfil. |
| `mobile/lib/screens` | Cliente Flutter MVP con limitaciones; no BLoC completo. |
| `packages/shared` | Tipos/utilidades TS; no hay generación automática de DTOs Java. |
| `database/init` | SQL versionado e inicialización histórica. |
| `infrastructure` | Compose, Dockerfiles y Nginx. |

## Versiones y entornos

- Java 21 / Spring Boot **3.2.12** en [backend/pom.xml](../../../backend/pom.xml).
- Angular 20.3 y scripts en [frontend/package.json](../../../frontend/package.json); consultar lockfile para versiones resueltas.
- PostgreSQL 17 en Compose. Flutter: consultar `mobile/pubspec.yaml` y el SDK instalado.
- Raíz declara pnpm 9.15.0; frontend declara 12.3.4: discrepancia pendiente, no garantía de uniformidad.
- API: `/api/v1`. Backend interno 8080, Postgres interno 5432.
- Desarrollo Angular 4200; su proxy apunta actualmente a **8085**, no al 8080 predeterminado del backend.
- JDBC local predeterminado usa 5434. Los puertos publicados de Compose dependen del entorno.
- La revisión de código a590a6d contiene SQL hasta 035. No deducir el estado de una base por la lista de archivos.
- Swagger usa `springdoc.swagger-ui.use-root-path`; comprobar el entorno antes de prometer una URL pública.

## Datos demo

El seed contiene FinoCode, slug `acme`, UUID `20000000-0000-0000-0000-000000000001`. Son datos de demostración, no evidencia de cuentas ni datos en producción. No copiar credenciales a esta wiki.

Fuentes: [database/init/003_seed.sql](../../../database/init/003_seed.sql), [database/init/016_finocode_tenant_name.sql](../../../database/init/016_finocode_tenant_name.sql), [frontend/proxy.conf.json](../../../frontend/proxy.conf.json), [infrastructure/docker-compose.yml](../../../infrastructure/docker-compose.yml). El estado de EC2 se documenta como antecedente en [operación](../06-operacion/despliegue-y-recuperacion.md), no como configuración universal.
