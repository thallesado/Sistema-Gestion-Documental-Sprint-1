# Arquitectura Angular

> Revisión documental: 2026-10-16. Base de código: `a590a6d`; ver [estado verificado](../05-guias-ia/estado-verificado-y-pendientes.md). Descripción del código inspeccionado, no certificación de producción.

## Directorios reales

| Ruta dentro de frontend/src/app | Responsabilidad |
|---|---|
| core/auth | AuthService, interceptor, guards y tipos de sesión |
| core/api | Clientes HTTP por dominio |
| core/routes | app.routes.ts |
| core/config, data, state, utils | Configuración y auxiliares; parte de data/state sigue siendo demo |
| shell | Layout activo, perfil y navegación |
| shared y core/components | Componentes reutilizables; inspeccionar duplicados antes de crear otro |
| features | auth, documentos, expedientes, clinico, workflows, users, auditoria, reportes y tablero |

No crear automáticamente core/services, interceptors o guards por una estructura genérica de Angular. La carpeta layout no es el shell operativo.

## Convenciones

Componentes standalone, imports explícitos, servicios por inyección y signals/computed para estado de UI. RxJS para solicitudes, errores y cancelación. Reutilizar formularios y componentes existentes; no agregar NgModule ni un store externo sin necesidad.

Rutas por feature con loadComponent. El menú viene de datos y aplica permisos de función y banderas (`sprintEnabled`, `visible`); no es la autoridad del backend ni un gate uniforme de capacidades tenant.

## Permisos por función en la interfaz

- `AuthUser.permissions` llega de `/auth/me`. `PermissionService.can('document:create')` acepta un código o una lista (basta cualquiera, como `hasAnyAuthority`).
- Las reglas puras están en `core/auth/permission-rules.ts` para probarlas con `node --test` (`frontend/tests/permissions.test.mjs`).
- Entradas de menú (`core/data/nexodocs-data.ts`): campo opcional `permission`; los hijos heredan el del padre. Debe copiar el `@PreAuthorize` del endpoint que usa la pantalla. Ya no hay filtro por los cuatro nombres de rol fijos.
- Rutas: `hasPermissionGuard('codigo')`; `userAdminGuard` equivale a `hasPermissionGuard('user:read')`.
- Plantillas: `*appHasPermission="'role:create'"` (`HasPermissionDirective`).
- Privilegios por componente: `[appField]="'documento.nuevo.codigo'"` (`FieldPermissionDirective`) oculta o deshabilita el control según `ComponentPermissionService`; catálogo en `core/auth/form-registry.ts`. Ver [usuarios y privilegios](../04-dominio-y-negocio/usuarios-grupos-y-privilegios.md).
- La etiqueta de rol del encabezado todavía se calcula con los cuatro textos de `Role`; es solo informativa.

## Rutas que no deben confundirse

| Ruta web | Pantalla |
|---|---|
| /login | Login; distinto del endpoint /api/v1/auth/login |
| /clinical/patients | Pacientes |
| /clinical/history | Antecedentes |
| /expedients/clinical/history | Historia clínica amplia |
| /clinical/notes | Notas médicas |
| /documents y /expedients | Listados documentales y expedientes |
| /workflows | Motor documental |
| /digitization/ocr | Flujo de digitalización con trabajos persistidos |

Las rutas dinámicas reutilizan WorkspacePage en varias secciones; no asumir una feature independiente por cada opción. Verificar ruta, carga de componente y contratos antes de editar.

Fuentes: [frontend/src/app/core/routes/app.routes.ts](../../../frontend/src/app/core/routes/app.routes.ts), [frontend/src/app/features/clinico/clinico.routes.ts](../../../frontend/src/app/features/clinico/clinico.routes.ts), [frontend/src/app/shell/app.ts](../../../frontend/src/app/shell/app.ts). [Comunicación API](estado-y-comunicacion-api.md).
