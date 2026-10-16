# Autenticación, sesiones y permisos

> Revisión documental: 2026-10-16. Base de código: `a590a6d`; ver [estado verificado](../05-guias-ia/estado-verificado-y-pendientes.md). Descripción del código inspeccionado, no certificación de producción.

## Contratos exactos

- Login API: `POST /api/v1/auth/login`; DTO con `usernameOrEmail`, `password` y organización por `tenantId` o `tenantName`. Son nombres de campos, no valores a guardar en documentación.
- Respuesta: `token`, `tokenType`, `refreshToken`, `expiresIn`. No existe un campo de respuesta llamado accessToken.
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

Los nombres visibles de roles no sustituyen permisos; revisar los catálogos/migraciones y controladores. No inventar `clinical:history:read` o `workflow:task:approve`.

## Límites conocidos

La comprobación de sesión de acceso es por usuario, no sesión específica. La revocación en la ruta de reutilización de refresh puede revertirse con rollback. Cambio de contraseña desde perfil y logout UI por inactividad requieren pruebas de revocación. Son hallazgos abiertos de la revisión, no garantías corregidas por esta wiki.

El frontend guarda los tokens en sessionStorage. No registrar ni compartir tokens de sesión. Esta página describe contratos, no procedimientos para extraer credenciales.

Fuentes: [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/dto/AuthRequest.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/dto/AuthRequest.java), [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/dto/AuthResponse.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/dto/AuthResponse.java), [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/security/JwtService.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/security/JwtService.java), [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/AuthSessionService.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/AuthSessionService.java), [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/AccessTokenRevocationService.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/AccessTokenRevocationService.java), [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/config/SecurityConfig.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/config/SecurityConfig.java). Ver [estado y pendientes](../05-guias-ia/estado-verificado-y-pendientes.md).
