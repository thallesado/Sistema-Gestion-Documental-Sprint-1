# Cambios locales y módulo de respaldos

**Nota histórica:** el estado de Respaldos sin backend fue sustituido posteriormente por [la implementación operativa](../04-dominio-y-negocio/respaldos-y-restauracion.md). Conservar esta página como antecedente de la sesión.

> Revisión documental: 2026-10-21. Checkout `main` en `8c3dcb8` más cambios locales sin commit. Complementa el snapshot histórico `a590a6d`; no certifica GitHub ni EC2. Las comprobaciones de ejecución descritas son antecedentes de esta sesión, no monitoreo permanente.

## Acceso y puertos locales

| Dirección | Servicio | Actualización |
|---|---|---|
| http://localhost:4200 | Frontend compilado, contenedor `nexodocs-frontend-1` | Reconstruir imagen y recrear únicamente frontend |
| http://localhost:4201 | Angular de desarrollo, proceso de Windows | Recarga al editar archivos; puede no estar iniciado |
| http://localhost:8080 | Backend `nexodocs-backend-1` | Reconstruir imagen; verificar esquema antes de recrear |
| localhost:5434 | PostgreSQL `nexodocs-postgres-1` | Puerto publicado; no es una página web |

Los dos frontends usan el mismo backend y la misma base. El puerto 4200 no implica una versión antigua: depende de cuándo se compiló su imagen. En el último arranque se verificaron frontend y API pública con HTTP 200, y PostgreSQL saludable. Esto no demuestra que todas las rutas autenticadas funcionen.

Hay un solo backend de NexoDocs. `nexodocs-migrate-1` es un servicio separado que termina con código 0 al completar migraciones, no un segundo backend. Otros proyectos Docker presentes en la máquina no forman parte de NexoDocs.

Proyecto Compose local: `nexodocs`. Volumen PostgreSQL observado: `nexodocs_nexodocs_postgres_data`. No confundir con el proyecto `infrastructure` de EC2. No cambiar de nombre ni borrar volúmenes para solucionar errores.

El proxy Angular de desarrollo reenvía `/api` a `localhost:8080` y utiliza el origen local autorizado `http://localhost:4200`. Corrige el rechazo CORS al utilizar 4201, sin modificar CORS de producción. No usar esta configuración como ejemplo de proxy público.

## Respaldos: lo implementado

La opción **Respaldos** aparece en el sidebar junto a Workflows y abre `/settings/backups`. La página exige sesión, pero permite revisión visual a usuarios como Laura sin exigir rol administrador. No se ampliaron permisos de base ni se habilitaron operaciones de respaldo. Antes de integrar API, revisar autorización específica en frontend y servidor.

La pantalla usa el shell existente y el nombre de la organización de `AuthService.user`. Incluye diseño responsive, filtros en memoria, historial expresamente no disponible y paneles de configuración, detalle, confirmación y progreso. No contiene respaldos ficticios. Los filtros todavía no consultan una API ni hay paginación de resultados reales.

Crear, guardar configuración, descargar y restaurar están deshabilitados. La configuración es un borrador en memoria: no persiste, no programa trabajos y no representa la configuración del servidor. Las etapas del seguimiento están pendientes y etiquetadas como vista previa; no son una operación en ejecución. Los paneles admiten Escape, control del foco y regreso al elemento que los abrió. La accesibilidad visual y móvil completa aún requiere revisión en navegador.

`/preview/backups` existe solamente en desarrollo mediante `isDevMode()`. El enlace normal para Docker es `/settings/backups`, porque la imagen de producción no registra la ruta de preview.

Fuentes: [rutas](../../../frontend/src/app/features/backups/backups.routes.ts), [componente](../../../frontend/src/app/features/backups/pages/backups-page.ts), [plantilla](../../../frontend/src/app/features/backups/pages/backups-page.html), [estilos](../../../frontend/src/app/features/backups/pages/backups-page.css), [menú](../../../frontend/src/app/core/data/nexodocs-data.ts).

## Alcance acordado y trabajo pendiente

Se acordó un respaldo completo automático diario y un botón manual por tenant. Deben incluirse todos sus datos operativos persistidos y archivos: usuarios/permisos, documentos, expedientes, workflows y extensión clínica cuando corresponda. No afirmar soporte de recetas u otras entidades sin inventariar su persistencia real.

Pendiente de implementar:

1. Inventario explícito de tablas, dependencias, datos globales y archivos; contrato versionado del paquete, manifiesto y comprobaciones de integridad.
2. Servicio/API de generación, historial persistido, consulta y descarga con permisos específicos y aislamiento tenant.
3. Configuración persistida, programación diaria, zona horaria y retención expresada en días; conservar registro de respaldos eliminados.
4. Restauración selectiva, respaldo de seguridad previo, preparación temporal de archivos, recuperación ante interrupciones y bloqueo de escrituras del tenant.
5. Evidencia histórica y auditoría: preservar acciones posteriores al punto recuperado, versiones exactas y sus referencias; registrar restauración, actor y resultado sin reemplazar la cadena de hashes.
6. Progreso real en segundo plano, reconsulta, avisos globales y protección de formularios abiertos.
7. Pruebas de restauración, fallos e independencia de otros tenants, y revisión de interfaz en escritorio/móvil.

Un respaldo completo del tenant es distinto de una versión documental. Solo se podrá recuperar un punto para el cual exista un respaldo válido y compatible. Recuperar datos operativos no debe borrar evidencia de una aprobación médica posterior. La estrategia de tablas inmutables y sus FKs sigue pendiente: no basta conservar hijos y borrar sus padres, ni usar `ON CONFLICT DO NOTHING` indiscriminadamente. Una transacción SQL tampoco revierte archivos del disco automáticamente.

## Correcciones de navegación y backend

- El menú de usuario apuntaba a `/settings/general`, inexistente. Ahora apunta a `/settings`, y la URL anterior redirige a ella. No se agregó persistencia de configuración general.
- El HTTP 500 de expedientes provenía de la consulta antigua con parámetro opcional nulo. La corrección ya estaba en el checkout, pero el backend Docker del 9 de octubre aún ejecutaba la consulta anterior. Se reconstruyó con las consultas separadas de [ExpedientRepository](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/repository/ExpedientRepository.java).
- La validación de Hibernate detectó `CHAR` frente a `VARCHAR`. Se corrigió Java con `@JdbcTypeCode(SqlTypes.CHAR)` en hashes de `AuditEvent`/`AuditAnchor` y moneda de `BillingTransaction`; no se desactivó validación ni se cambiaron esos tipos SQL.
- Faltaba la tabla usada por `EnterpriseInquiry`. Se agregó [044_enterprise_inquiries_schema.sql](../../../database/init/044_enterprise_inquiries_schema.sql), con relaciones tenant/usuario y RLS restrictivo más SELECT/INSERT del propietario. No se conceden UPDATE/DELETE al rol de aplicación. Se dejaron 042/043 libres por coordinación del trabajo de respaldos; verificar ramas antes de nuevas migraciones.

## Operación y evidencias registradas

Antes de aplicar 034–041 se guardaron base y almacenamiento bajo `C:\Users\andre\nexodocs-backups\local-20261019-153823`. El dump se comprobó con `pg_restore --list`; esto confirma legibilidad, no una restauración integral ensayada. Después se aplicó 044 y se comprobó su reejecución sin cambios. El migrador reconstruido terminó con código 0 y “Migraciones al día”. No se borraron volúmenes ni se ejecutaron seeds.

Se detectó diferencia entre las credenciales configuradas en Compose y las del contenedor existente. Se conservaron los valores existentes sin imprimirlos ni cambiar contraseñas; las primeras migraciones se aplicaron mediante la conexión interna de PostgreSQL. No asumir que un `compose up` futuro reproduce esa configuración: verificar su alineación sin revelar secretos. Esta nota no contiene valores sensibles.

Resultados históricos de esta sesión:

- Backend: 111 pruebas, sin fallos ni omisiones; arranque final y API pública HTTP 200.
- Frontend tras habilitar sidebar: 86 pruebas pasan y 1 se omite; compilación de producción correcta. La prueba de scaffold se adaptó porque Respaldos ya no es un placeholder.
- Consulta SQL de expedientes bajo contexto válido de tenant: 5 registros; transacción de lectura revertida. No equivale a verificar el endpoint con la sesión del navegador del usuario.
- La consulta de solicitudes comerciales de otros tenants devolvió 0, pero sin filas de contraste esto no prueba aislamiento completo. Faltan pruebas con datos representativos.

No se hizo push ni despliegue de estos cambios en EC2. El estado de Git y del servidor debe verificarse por separado. Las pruebas documentales vigentes se ejecutan con `node scripts/validate-wiki.mjs` y `node --test scripts/tests/validate-wiki.test.mjs`.
