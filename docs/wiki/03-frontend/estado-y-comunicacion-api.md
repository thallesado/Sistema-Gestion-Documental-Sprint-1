# Estado y comunicación API

> Revisión documental: 2026-10-16. Base de código: `a590a6d`; ver [estado verificado](../05-guias-ia/estado-verificado-y-pendientes.md). Descripción del código inspeccionado, no certificación de producción.

## Conexión

Clientes bajo core/api, API relativa /api/v1. Proxy de desarrollo [frontend/proxy.conf.json](../../../frontend/proxy.conf.json) apunta actualmente a localhost:8080 (puerto por defecto del backend, BACKEND_PORT). Docker usa Nginx hacia backend:8080; HTTPS se termina en Caddy en el despliegue documentado.

## Sesión e interceptor

AuthService almacena `nexodocs.access_token` y `nexodocs.refresh_token` en **sessionStorage**, tomando `response.token`. Al recargar consulta identidad/roles con /auth/me.

El interceptor añade Bearer si encuentra token; en el código local no limita ese agregado exclusivamente a /api/v1 ni excluye todos los endpoints públicos. Para 401 excluye login/logout/refresh de reintentos, usa refreshOnce y reintenta con response.token; si falla ejecuta logout. La ruta web de login es /login.

Distinguir regla deseada de comportamiento: no documentar un filtrado de URLs que todavía no existe.

## Estado y errores

Signals para carga/listas/selección; computed para derivados; RxJS para debounce/cancelación. No usar vacío/cero como prueba de que no hay registros tras fallar una API. Mostrar errores y reintentos sin datos inventados.

Filtros locales sobre una página no equivalen a filtrado global del backend. Evitar conservar datos del paciente/documento anterior al cambiar selección.

## Contratos TS/Java

packages/shared contiene utilidades/tipos, pero las API también declaran interfaces locales. No hay sincronización automática con Java ni evidencia de que todos los clientes importen shared. Alinear campos/alias con DTO real y validar el comportamiento de HTTP, no solo compilación TS.

Fuentes: [frontend/src/app/core/auth/auth.service.ts](../../../frontend/src/app/core/auth/auth.service.ts), [frontend/src/app/core/auth/auth.interceptor.ts](../../../frontend/src/app/core/auth/auth.interceptor.ts), [frontend/src/app/core/api/document-api.service.ts](../../../frontend/src/app/core/api/document-api.service.ts), [packages/shared/src/index.ts](../../../packages/shared/src/index.ts). [Pruebas](../05-guias-ia/pruebas-y-validacion.md).
