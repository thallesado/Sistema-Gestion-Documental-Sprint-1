# Pruebas y verificación por tipo de cambio

> Revisión documental: 2026-10-16. Base de código `a590a6d`; los antecedentes históricos se identifican por separado. No certifica producción.

## Documentación

Desde la raíz, sin instalar dependencias:

```powershell
node scripts/validate-wiki.mjs
node --test scripts/tests/validate-wiki.test.mjs
```

El verificador comprueba enlaces locales (también anchors de Markdown), metadatos de revisión y contratos seleccionados en verification.json. Por defecto valida fuentes del checkout local. `--include-remote` comprueba también snapshots git; necesita esos objetos en el clon. No hace fetch, no lee .env ni modifica archivos.

El campo reviews registra fecha y revisión por página: se puede revisar una página sin redatar las demás. La fecha general del manifiesto identifica la revisión del conjunto, no obliga a afirmar que todas las páginas se revisaron nuevamente.

Un fallo de contrato requiere revisar fuente y página. No cambiar asserts solo para silenciar un fallo. Los links dentro de bloques de código de ejemplo no se validan.

## Frontend

```powershell
pnpm --filter @nexodocs/frontend test
pnpm --filter @nexodocs/frontend typecheck
pnpm --filter @nexodocs/frontend build
```

Las pruebas Node locales leen archivos y patrones en numerosos casos: no prueban persistencia. La prueba HTTP de routes requiere APP_URL. Tests nuevos deben validar comportamiento relevante, no repetir implementación para inflar cobertura.

La suite de OCR actual importa utilidades TypeScript directamente. En Node 22.16 local, el comando sin flags falla con ERR_UNKNOWN_FILE_EXTENSION; desde frontend funciona `node --experimental-strip-types --test tests/*.test.mjs`. Usar un runtime compatible o esa opción explícita sin desactivar pruebas. En esta publicación, esa ejecución dio 69 pruebas aprobadas y una HTTP omitida; la ejecución sin flag dio dos fallos de carga. Son resultados de entorno, no prueba de la API desplegada.

## Backend

```powershell
Set-Location backend
mvn --batch-mode --no-transfer-progress test
```

Volver a la raíz para comandos siguientes. La compilación/pruebas de servicio con mocks no demuestran RLS o concurrencia transaccional real.

## SQL y workflows

`database/tests/run.ps1` crea PostgreSQL aislado con tmpfs y sin puertos/red, aplica SQL y valida; leer el script antes de ejecutarlo y comprobar Docker. No sustituirlo por pruebas sobre base real.

`scripts/test-workflows.ps1` y `scripts/test-workflows-ui.cjs` necesitan API/usuarios/Playwright y pueden crear registros. Leer configuración y usar entorno aislado, no producción ni cuentas demo productivas. No publicar sus parámetros sensibles.

## Móvil

Desde mobile: `flutter analyze --no-pub --no-fatal-infos` y `flutter test --no-pub`, cuando dependencias ya estén disponibles. Las pruebas actuales de widgets no acreditan todo el contrato HTTP ni paridad web.

## Matriz mínima

| Cambio | Qué verificar |
|---|---|
| Documento/carga | Archivo y versión persisten, error recuperable, límites proxy y permisos. |
| SQL/RLS | Instalar/actualizar/repetir en aislamiento, dos tenants, RBAC y rollback. |
| Workflow | Asignación, jerarquía, doble decisión, versión revisada y publicación. |
| OCR | Revisión exacta, error explícito, job/archivo, indexación y recarga. |
| Sesión | Login, refresh/reutilización, logout/inactividad, cambios de permisos. |
| Clínica | Identidad, vínculo documental, baja/estado y concurrencia. |
| Interfaz | Carga/error/vacío, teclado/foco y protección de cambios. |

Fuentes: [frontend/package.json](../../../frontend/package.json), [backend/pom.xml](../../../backend/pom.xml), [database/tests/run.ps1](../../../database/tests/run.ps1), [scripts/test-workflows.ps1](../../../scripts/test-workflows.ps1). No ejecutar pruebas con escrituras sin revisar su destino.
