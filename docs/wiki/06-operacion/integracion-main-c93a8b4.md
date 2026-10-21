# Integración de main y acceso por permisos

**Nota histórica:** el estado de Respaldos sin backend fue sustituido posteriormente por [la implementación operativa](../04-dominio-y-negocio/respaldos-y-restauracion.md). Conservar esta página como antecedente de la sesión.

> Revisión documental: 2026-10-21. Revisión `c93a8b4` más cambios locales sin commit. Revisión de fuentes y pruebas locales, no despliegue a EC2.

## Commits integrados

Se incorporaron 15 commits desde `8c3dcb8` hasta `c93a8b4` por fast-forward, preservando cambios locales mediante stash. Se resolvieron conflictos en mapeos Java, wiki y pruebas de scaffold. Los mapeos CHAR corregidos localmente ya vinieron corregidos en main. La interfaz de Respaldos y su entrada en sidebar siguen siendo cambios locales, sin backend de respaldos.

| Commit | Cambio registrado en el historial |
|---|---|
| `855ffff`, `5114b7e`, `f458eeb` | Evolución y revisión de la aplicación móvil; revisar contratos Flutter antes de afirmar paridad web |
| `e5e05d8` | Nombre NexoDocs e icono de la aplicación móvil |
| `c0ef14c` | Permisos por formulario/componente y evolución de administración de usuarios |
| `e2af49a` | Asistente contextual con Gemini; retiro de Botpress del shell |
| `baa218b` | Lectura mínima de la cadena de auditoría antes de escrituras auditadas |
| `161c4f5` | Respuestas del asistente en pasos, manual con acentos y conservación de sugerencia OCR ante errores |
| `f98d4fa` | Normalización de IPv6 en verificación de auditoría |
| `7b33d45` | Moneda CHAR y migración de solicitudes Enterprise |
| `d3bae18` | Instrucciones README de desarrollo y demostración; no copiar credenciales a documentación adicional |
| `b4ded4b`, `e1969f2` | Segmentación de planes, onboarding, límites y defaults; integración de la rama Mauricio |
| `edcbbf3` | Cambios de OCR y móvil offline según commit; no se certificó aquí el flujo offline |
| `c93a8b4` | Subentradas de auditoría visibles y acceso de página basado en permiso |

Esta tabla identifica alcance por historial y fuentes. No significa que se hayan probado todas las funciones de los commits. Consultar `git show <commit>` y las páginas de dominio afectadas antes de cambiarlas.

## Causa del menú vacío de Laura

El frontend nuevo usa [PermissionService](../../../frontend/src/app/core/auth/permission.service.ts) y [permission-rules](../../../frontend/src/app/core/auth/permission-rules.ts) para filtrar el sidebar según `AuthService.user().permissions`. El backend antiguo no entregaba ese contrato nuevo. El resultado eran menús ocultos aunque la base conservara asignaciones de roles. El rol mostrado como administrador no reemplaza la lista de permisos efectivos.

Se verificó antes de migrar que Laura tenía 93 asignaciones por roles y plan PRO activo con funcionalidades habilitadas. No se le asignó un rol nuevo, no se modificó su contraseña y no se agregó un bypass al frontend. Esos números describen la comprobación local, no una garantía futura de permisos.

Se reconstruyeron backend y frontend con el checkout actual. [UserService](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/UserService.java) ahora entrega permisos en `/auth/me`. Tras la actualización, recargar el navegador y, si conserva una sesión antigua, cerrar y volver a iniciar sesión para obtener permisos actuales.

## Migraciones y respaldo local

Antes de migrar se detuvo el backend y se guardaron base y almacenamiento en `C:\Users\andre\nexodocs-backups\pre-c93a8b4-20261021-072700`. Se verificó legibilidad del dump mediante `pg_restore --list`. No se realizó una restauración integral de ese dump.

- 042: permisos por componente.
- 043: permisos de inserción de columnas del perfil de usuario.
- 044_current_role_names: grupos activos del usuario autenticado sin exigir lectura general de roles. Coexiste con nuestra 044_enterprise_inquiries_schema: el runner identifica nombres completos.
- 045: SELECT de columnas de cadena de auditoría para `nexodocs_security`. Se aplicó antes de migraciones que pudieran producir auditoría.
- 046: regionalización del tenant, preferencias del usuario y función de contadores mensuales.
- 047_enterprise_inquiries y 047_subscription_payments: dos migraciones distintas, ambas registradas; la tabla Enterprise existente no se recreó. Los pagos simulados no acreditan integración de cobros reales.
- 048: elimina asignaciones incompatibles con funcionalidades del plan y agrega comprobación de plan en `app.has_permission`. No asumir permisos clínicos o workflows en todos los planes.
- 049 local: permiso mínimo SELECT sobre catálogo `plan_features` para `nexodocs_security`, necesario para la función introducida por 048. No amplía permisos funcionales del usuario.

**Defecto pendiente de upstream en 048:** el archivo no registra su versión en `app.schema_migrations`; el runner normal aborta tras ejecutarlo al comprobar historial. En esta actualización local se ejecutó su SQL añadiendo el registro antes del COMMIT, dentro de la misma transacción, sin editar la migración del repositorio. El runner posteriormente comprobó todo aplicado. Una instalación nueva o EC2 sin 048 registrada todavía requiere corregir el procedimiento antes de ejecutarlo automáticamente. No basta agregar 049 para resolver ese defecto del historial.

El primer chequeo después de 048 falló con `permission denied for table plan_features`. Se agregó [049_security_plan_feature_select.sql](../../../database/init/049_security_plan_feature_select.sql). No se desactivó RLS ni la validación de esquema. Se conservaron los valores de configuración de los contenedores sin imprimirlos; persiste la necesidad de alinear Compose con la configuración real antes de recreaciones futuras.

## Evidencia y límites

- Backend: 166 pruebas correctas al compilar la revisión nueva; arranque posterior correcto.
- Frontend: 115 pruebas correctas, 1 omitida, sin fallos. Se actualizó una expectativa de menú para reconocer Respaldos como vista previa visible sin operaciones.
- API pública a través de frontend Docker: HTTP 200. No equivale a probar todas las páginas autenticadas.
- Comprobación SQL transaccional con rol `nexodocs_app` y contexto de Laura: contexto válido; `document:read`, `expedient:read`, `workflow:read` y `audit:read` verdaderos; un grupo activo visible. La transacción terminó con ROLLBACK.
- Pendiente: confirmar visualmente la sesión de Laura después de recargar; pruebas integrales de planes, onboarding, asistente Gemini, OCR/móvil offline y auditoría IPv6 no se ejecutaron aquí.

Los contenedores locales no actualizan AWS. No se hizo push ni despliegue remoto. Las funciones operativas de Respaldos siguen pendientes según [cambios locales](cambios-locales-2026-10-21.md).
