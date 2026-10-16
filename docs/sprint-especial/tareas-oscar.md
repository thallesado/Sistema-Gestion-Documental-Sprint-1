# Tareas de Oscar: usuarios, grupos y privilegios

Carga estimada: 8 días. Migraciones reservadas: 036 y 037. Lee antes `README.md`.

Orden recomendado: B3, luego B1 y por último B2. B2 depende de B3.

## Qué pide el docente

Tres niveles de usuario:

1. **Superadministrador:** cuentas del fabricante.
2. **Administrador:** la cuenta que se entrega a cada cliente.
3. **Un tercer nivel que el sistema no trae definido:** el administrador de cada empresa crea sus propios grupos o perfiles y los usuarios pertenecen al menos a uno. El sistema no puede venir con "profesor" o "alumno" fijos.

Los privilegios se asignan en **dos niveles**: por función y por componente de formulario. Cada botón, etiqueta o campo tiene tres estados: visible y editable, visible solo lectura, o no visible. Lo configura el administrador sobre el mismo formulario, "no un formulario por grupo".

## B3. Permisos en el frontend (P1, 1 día)

### Qué ya existe

- El backend aplica permisos por función con 58 `@PreAuthorize` y con la función SQL `app.has_permission` en las políticas RLS.
- El catálogo tiene 75 permisos (tabla `permissions`).
- En el frontend, `AuthUser` no recibe los permisos, `shell/app.ts` reduce el rol a cuatro textos fijos (`Superadministrador`, `Administrador de tenant`, `Supervisor`, `Usuario basico`) y filtra el menú por esos textos. Un rol personalizado cae en `Usuario basico`. No hay guard ni directiva por permiso.
- En `administracion-page.ts` la pestaña "Roles y permisos" no tiene botón "Crear rol": el modal `RoleFormModal` solo se abre desde la pantalla genérica.

### Qué implementar

1. Backend: añadir `permissions: string[]` a `AuthResponse` y a la respuesta de `/auth/me`, calculado desde `user_roles` y `role_permissions`.
2. Frontend: `AuthUser.permissions`, `PermissionService.can('document:create')` (el servicio vacío lo deja el PR 0), `hasPermissionGuard` y la directiva `*appHasPermission`.
3. Filtrar el menú por permiso y no por los cuatro textos. Para eso, añadir un campo opcional `permission` a las entradas de menú.
4. Añadir el botón "Crear rol" en `administracion-page.ts`.

### Criterio de aceptación

Un rol creado por un administrador, con solo `document:read`, ve en el menú únicamente lo que ese permiso habilita, sin pasar por los cuatro roles fijos.

## B1. Grupos o perfiles del tenant (P1, 2 días)

### Qué ya existe

- Los administradores de tenant ya pueden crear roles (`RoleController`, `RoleService`) y asignarles permisos, con interfaz.
- Las tablas `user_groups` y `user_group_members` existen en el esquema pero no tienen código. La ruta `/users/groups` está desactivada.
- El sistema trae roles predefinidos de tercer nivel (`Supervisor`, `Usuario operativo`) en `003_seed.sql`, que contradicen la regla del docente.
- No se valida que un usuario tenga al menos un rol.

### Decisión recomendada

El docente usa "grupos o perfiles" como sinónimos. Recomendamos tratar **grupo = perfil = rol del tenant**, sin tocar `app.has_permission` ni las políticas RLS (cambiarlas es de alto riesgo). Confirmar con el docente que no pide una entidad distinta.

### Qué implementar

1. Renombrar en la interfaz "Roles" a "Grupos de usuarios (perfiles)".
2. Exigir al menos un grupo al crear o editar un usuario (`UserService`: una sola llamada a un validador propio, porque Mauricio también añade una llamada ahí).
3. Un tenant nuevo debe nacer solo con el rol `Administrador de tenant`. Los datos de demostración del tenant actual se mantienen. Coordinar con Mauricio (A1, alta de tenant).
4. Dejar `user_groups` sin usar o, si hay tiempo, usarlo para agrupaciones organizativas, sin relación con los permisos.

### Criterio de aceptación

Un tenant nuevo no tiene grupos predefinidos salvo el administrador. El administrador crea un grupo "Profesores", le asigna funciones y le añade usuarios. No se puede crear un usuario sin grupo.

## B2. Privilegios por componente con tres estados (P1, 5 días)

### Qué ya existe

Nada. No hay tabla, API ni directiva. Los formularios (`create-user-modal.ts`, documentos, notas médicas) pintan sus campos sin consultar ningún estado.

### Qué implementar

1. **Modelo** (migración 036), con RLS por tenant:
   `component_permissions(tenant_id, role_id, form_key, component_key, state)` con `state` en `VISIBLE_EDITABLE`, `VISIBLE_READONLY`, `HIDDEN`, y único por tenant, rol, formulario y componente. Si no hay fila, el estado por defecto es `VISIBLE_EDITABLE`. Si un usuario tiene varios roles, gana el estado más permisivo; documentar la regla.
2. **Backend:**
   - `GET /api/v1/component-permissions/me?form=<clave>` devuelve los estados efectivos del usuario;
   - endpoints de administración para leer y guardar la matriz por rol y formulario (permiso nuevo `component_permission:manage`);
   - **aplicar la regla también en el servidor** en al menos tres formularios: ignorar o rechazar campos de solo lectura y no devolver los ocultos. Ocultar solo en pantalla no es seguridad.
3. **Frontend:**
   - catálogo `form-registry.ts` con cada formulario, sus componentes y sus etiquetas;
   - directiva `[appField]="'documento.nuevo.codigo'"` que oculta, deshabilita o deja editable según el estado;
   - pantalla de administración "Privilegios por formulario": elegir rol, elegir formulario y marcar el estado de cada componente;
   - aplicarlo a `create-user-modal`, al formulario de creación de documentos y a un formulario clínico.

### Ejemplo del docente

En un formulario de productos (código, nombre, costo, precio): un grupo lo hace todo, otro todo menos borrar y modificar, otro solo lo ve y otro no lo ve. Se demuestra con el formulario de documentos y varios roles.

### Criterio de aceptación

Con un rol con `codigo = HIDDEN` y `nombre = VISIBLE_READONLY` en el formulario de documentos: el campo código no aparece, el nombre se ve bloqueado, y una llamada directa a la API intentando cambiar el nombre es rechazada o ignorada.

## Dependencias y coordinación

- B3 antes que B2. Cuando B3 esté integrado, avisa para que Mauricio, Cruz y los demás usen `PermissionService`.
- `UserService.java` lo editan también Mauricio (límite de usuarios) y tú (validar grupo): una sola llamada cada uno.
- `AuthController`/`AuthResponse`: Andres modifica el camino de login fallido, tú el contenido de la respuesta. Son métodos distintos.
- Revisor cruzado: Mauricio.
