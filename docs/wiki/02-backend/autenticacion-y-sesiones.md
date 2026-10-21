# Autenticación, sesiones y permisos

> Revisión documental: 2026-10-21. Base de código: `c93a8b4` más cambios locales; ver [estado verificado](../05-guias-ia/estado-verificado-y-pendientes.md). Descripción del código inspeccionado, no certificación de producción.

## Contratos exactos

- Login API: `POST /api/v1/auth/login`; DTO con `usernameOrEmail`, `password` y organización por `tenantId` o `tenantName`. Son nombres de campos, no valores a guardar en documentación.
- Respuesta: `token`, `tokenType`, `refreshToken`, `expiresIn` y `permissions` (los mismos códigos que las authorities del JWT). No existe un campo de respuesta llamado accessToken.
- `GET /auth/me` devuelve también `permissions`: las authorities del JWT de la sesión (`UserService.sessionPermissions`, sin `ROLE_*`), las mismas que aplican `@PreAuthorize`. No se recalculan con `findAuthorityCodes` bajo el contexto RLS porque `user_roles`, `roles` y `role_permissions` solo son legibles con `role:read`: un perfil como *Médico Especialista* recibía una lista vacía y la web le ocultaba todo el menú salvo Inicio. `roleIds` y `roleNames` del usuario actual se leen con `app.current_role_ids()` y `app.current_role_names()` (SECURITY DEFINER, 042 y 044). Las cuentas de plataforma reciben las authorities fijas de `PlatformAuthorities`. Las respuestas de `PUT /auth/me` y sus variantes no lo informan.
- JWT de acceso: `userId`, `tenantId` cuando corresponde, `authorities`, `tokenType=access`; `sub` contiene username; jti, emisión, expiración y firma HS256.
- Refresh: tipo refresh, hash en auth_sessions y rotación con bloqueo pesimista.
- Valores predeterminados configurables: acceso 8 h y refresh 7 días. No equivalen al cierre UI por inactividad.
- Filtro valida firma/tipo/expiración, blacklist y existencia de sesión activa mediante AccessTokenRevocationService.
- Logout revoca access token recibido y refresh indicado. No describirlo como sesiones puramente stateless.

## Permisos reales y fuentes

| Operación | Permisos/ubicación |
|---|---|
| Crear documento | document:create |
| Cargar versión | document:update |
| Consultar historia | patient:read |
| Crear/actualizar historia | patient:create / patient:update |
| Notas | medical_note:read/create/update |
| Iniciar workflow | workflow:start y workflow:create en el motor |
| Aprobar workflow | workflow:approve y reglas de asignación/jerarquía |
| Plantillas | workflow_template:read/create/update/delete |
| Administración global | platform:tenant:manage |

El frontend usa `permissions` solo para decidir qué mostrar (menú, botones y guards); la autorización sigue en `@PreAuthorize` y RLS. Los nombres visibles de roles no sustituyen permisos; revisar los catálogos/migraciones y controladores. No inventar `clinical:history:read` o `workflow:task:approve`.

## Límites conocidos

### Login fallido y bloqueo local (2026-10-21)

`LoginAttemptRateLimitFilter` limita `POST /api/v1/auth/login` a cinco solicitudes por ventana de 60 segundos por IP y por identificador de cuenta/organización enviada. Cuenta también los inicios correctos. El sexto intento recibe 429 con `Retry-After`; la ventana se libera sin intervención. Los contadores están en memoria, se reinician con el backend y no coordinan réplicas. Distintos alias de organización o username/email representan claves de cuenta distintas; el límite por IP se aplica igualmente. La capacidad del mapa está acotada y al saturarse rechaza claves nuevas hasta que caduquen entradas.

El controlador registra credenciales inválidas, organización inexistente y acceso denegado. Los rechazos del filtro también registran `LOGIN_FAILED`/`FAILURE`, IP, agente e identificador intentado. No se entrega la contraseña al servicio de auditoría. La migración `052_login_failure_audit.sql` habilita una función restringida de inserción previa a la autenticación, conservando los triggers de hash. Si falla la auditoría, se registra una advertencia: requiere vigilancia operativa y no hay cola de reintentos.

El proxy Nginx sustituye `X-Forwarded-For` por la IP del socket y elimina `Forwarded`. El puerto Docker del backend se publica solo en loopback; debe accederse desde el proxy para preservar IP por cliente. No exponer directamente un backend configurado con `forward-headers-strategy: framework`. Detrás de otro proxy hay que configurar explícitamente su confianza antes de cambiar este esquema.

La comprobación de sesión de acceso es por usuario, no sesión específica. La revocación en la ruta de reutilización de refresh puede revertirse con rollback. Cambio de contraseña desde perfil y logout UI por inactividad requieren pruebas de revocación. Son hallazgos abiertos de la revisión, no garantías corregidas por esta wiki.

El frontend guarda los tokens en sessionStorage. No registrar ni compartir tokens de sesión. Esta página describe contratos, no procedimientos para extraer credenciales.

Fuentes: [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/dto/AuthRequest.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/dto/AuthRequest.java), [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/dto/AuthResponse.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/dto/AuthResponse.java), [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/security/JwtService.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/security/JwtService.java), [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/AuthSessionService.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/AuthSessionService.java), [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/AccessTokenRevocationService.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/AccessTokenRevocationService.java), [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/config/SecurityConfig.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/config/SecurityConfig.java). Ver [estado y pendientes](../05-guias-ia/estado-verificado-y-pendientes.md).

## Corrección local del perfil tras integrar 046 (2026-10-21)

En `c93a8b4` más cambios locales, la migración 046 concede UPDATE pero omite SELECT sobre `users.preferred_language` y `users.must_change_password`. Hibernate incluye ambas columnas al cargar `GET /api/v1/auth/me`; PostgreSQL devuelve `permission denied for table users`. El login puede emitir tokens, pero el perfil falla y el sidebar muestra los valores por defecto (Usuario, organización sin asignar y pocas opciones). No demuestra que se hayan eliminado los roles.

La migración [051_user_profile_select_privileges.sql](../../../database/init/051_user_profile_select_privileges.sql) concede únicamente SELECT sobre esas dos columnas a `nexodocs_app`, sin cambiar roles de usuarios ni políticas RLS. Se aplicó en Docker local después de un respaldo PostgreSQL verificado. Con el rol de aplicación y contexto de Laura se verificaron lectura de todas las columnas de usuario, nombre Laura Martínez, organización FinoCode, rol Administrador de tenant y permisos document:read, expedient:read y backup:read. Esta prueba SQL no sustituye una comprobación visual de la sesión del navegador. Recargar fuerza una nueva consulta del perfil; si el JWT conserva permisos anteriores, cerrar sesión e ingresar de nuevo.
