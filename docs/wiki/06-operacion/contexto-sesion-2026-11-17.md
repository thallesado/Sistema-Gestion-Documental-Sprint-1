# Contexto de integración local y pruebas EC2

> Revisión documental: 2026-11-17. Fuente local: `c0c49ab` más cambios sin commit. Los hechos de EC2 proceden de salidas aportadas por el usuario el 2026-11-14; no son inspección remota ni garantía de disponibilidad actual.

## Punto de entrada para continuar

El checkout local, la instancia anterior y la nueva EC2 son tres entornos distintos. Actualizar Git en Windows no actualiza imágenes, migraciones ni contenedores de EC2. Confirmar qué instancia está seleccionada antes de ejecutar comandos. No borrar volúmenes ni reutilizar una configuración local sin contrastarla con los usuarios PostgreSQL existentes.

## Integración local del 17 de noviembre

Se hizo `git fetch origin` y avance rápido de `main` desde `b19cbfb` a `c0c49ab`, con 18 commits nuevos. No había commits locales por delante. Se preservaron cambios en documentos, su wiki y `verification.json` mediante un stash de resguardo, conservado tras reaplicarlo. Los archivos no versionados `SI2.eapx` y `database/exports/` se dejaron intactos.

El conflicto en `documentos-page.ts` se resolvió combinando el catálogo de expedientes activos y la comprobación local de `expedient:read` con el filtro/orden de `linkableExpedients` recibido de main. Se quitaron importaciones, inyecciones y consultas duplicadas producidas por la combinación. Los campos clínicos condicionados por `clinicalEnabled` se conservaron. El resultado sigue sin commit; no atribuirlo íntegramente a origin/main.

| Cambios recibidos | Fuentes y alcance |
|---|---|
| ETag documental | `DocumentStateToken`: normalización temporal a UTC/microsegundos con redondeo equivalente a PostgreSQL. |
| Archivo documental | `DocumentStorageService` valida firma binaria frente al tipo declarado. No equivale a antivirus. |
| Contrato | Migración `091_contract_metadata_schema`: títulos y fecha estructurada en el esquema de metadatos; no sustituye una personalización previa distinta. |
| Documentos y expedientes | Selector de expedientes, campos clínicos condicionales, validación del primer paso y mensajes de duplicidad en expedientes. |
| Usuarios | `RoleGrantPolicy` impide conceder grupos con permisos que el actor no posee y rechaza grupos de tenant con nombre de superadmin. |
| Reportes | Recuentos por estado sobre el filtro completo, no sobre la página visible. |
| Plataforma y errores | Contexto del administrador autenticado al consultar logs técnicos; errores de privilegios como 403 y respuestas de autenticación UTF-8. |
| Validación y presentación | Correo de paciente, slug de tenant, características de planes desde catálogo y página no encontrada. |
| Instalación SQL | Ajuste de compatibilidad en 044 respecto de la tabla que también crea 047; no afirmar que se ejecutó en una base por haber descargado el archivo. |

Fuentes: [documentos](../04-dominio-y-negocio/documentos-y-almacenamiento.md), [usuarios](../04-dominio-y-negocio/usuarios-grupos-y-privilegios.md), [reportes](../04-dominio-y-negocio/reportes-y-analitica.md), [migraciones](../02-backend/base-de-datos-y-migraciones.md).

Al integrar se ejecutaron TypeScript sin emisión, `git diff --check` y el verificador de wiki: 31 páginas, 135 contratos y 224 enlaces. No se ejecutó una regresión completa Maven, navegador, Flutter ni SQL; los tests recibidos en los commits no constituyen evidencia de ejecución en esta sesión. No se reconstruyó Docker ni se aplicó 091 a bases locales o remotas como parte de la descarga.

## Dos instancias: evidencia aportada

| Entorno | Instancia anterior | Instancia nueva |
|---|---|---|
| Identificación histórica | Host privado `ip-172-31-6-221` | Host privado `ip-172-31-21-248` |
| Proyecto / ruta | `infrastructure`, `/opt/nexodocs` | `infrastructure`, `/opt/nexodocs` |
| Datos | Conserva su volumen existente; no se trasladaron a la nueva instancia | El usuario decidió iniciar con semillas del repositorio, sin migrar los datos anteriores |
| Revisión | No se volvió a comprobar HEAD en la prueba por IP | Clon en `b19cbfb`; no hay evidencia de actualización a `c0c49ab` |
| Recursos | No medidos en esta sesión | Aproximadamente 909 MiB RAM y 2 GiB swap activado/persistido; volumen raíz de 19 GiB |
| Servicios | Frontend, backend y PostgreSQL encendidos; migrador con salida 0 | Imágenes migrate/backend/frontend construidas; PostgreSQL healthy, backend iniciado y migrador con salida 0 |

Las IP públicas pueden cambiar: no tomar las de la conversación como destino vigente. No se certifica suficiencia de 1 GB para backend, PostgreSQL, worker y carga simultánea; swap ayudó a completar la compilación y no reemplaza RAM ni una prueba de capacidad.

## Nueva EC2: realizado y pendiente

Se instaló Docker con el repositorio oficial para Ubuntu y se comprobó `hello-world`. Se compilaron migrate, backend y frontend por separado. El build del frontend completó su paso `pnpm test && pnpm run build`. El usuario informó «Migraciones al día»; no se recibió un inventario completo del historial SQL.

Se generó un archivo de entorno restringido y credenciales aleatorias en el servidor, sin imprimirlas. Se indicó crear `nexodocs_runtime` con LOGIN y pertenencia a `nexodocs_app`, sin SUPERUSER, CREATEDB, CREATEROLE ni BYPASSRLS. El backend luego inició y respondió a la consulta pública; no se recibió una auditoría independiente del catálogo de roles.

Evidencia HTTP: frontend 200 en `127.0.0.1:8081/` y API 200 en `/api/v1/tenants/public`. No demuestra login, OCR, restauración ni alta de bases aisladas.

Después el usuario reemplazó todo el archivo de entorno por su configuración local y reportó credenciales inválidas. Se proporcionó un procedimiento para recuperar las variables esenciales desde los contenedores existentes, con copia privada previa. **No llegó confirmación de ejecución ni de login corregido.** No recrear servicios suponiendo que esa reparación ocurrió. Cambiar POSTGRES_PASSWORD en el archivo no cambia la contraseña de una base ya inicializada; lo mismo aplica al usuario runtime. Los usuarios creados en el servidor anterior o en localhost no aparecen por clonar Git.

Routing y aislamiento estaban habilitados en la configuración generada, pero no hay evidencia de worker `tenant-isolation` arrancado ni de cuenta aprovisionadora preparada en esa EC2. El Compose separa aprovisionamiento del backend: este lleva `TENANT_DATABASE_PROVISIONING_ENABLED: "false"`; el worker requiere perfil y credenciales propias. Revisar [límites del aprovisionador](../04-dominio-y-negocio/aislamiento-bases-por-tenant.md) antes de reutilizar el script local en AWS.

Se dieron instrucciones para HTTPS, pero no hubo resultado que certifique Caddy, DNS o certificado en la nueva instancia. Correo, Gemini y pagos tampoco quedaron comprobados. No publicar las contraseñas demo ni utilizarlas como credenciales de producción.

## Instancia anterior: acceso temporal por IP

La salida inicial mostró frontend en `127.0.0.1:8081`, Caddy en 80/443, backend publicado en 8000 y PostgreSQL en 5434. Que Docker publique estos dos últimos puertos no demuestra que el grupo de seguridad permita acceso externo: comprobar reglas antes de afirmar exposición pública.

Persistían además contenedores `nexodocs-*` en estado Created, distintos del proyecto activo `infrastructure`. No se borraron contenedores ni volúmenes.

A petición del usuario se detuvo `infrastructure-caddy-1` y se inició `nexodocs-ip-test` con imagen `caddy:2-alpine`, `--network host`, `--restart unless-stopped` y comando:

```bash
caddy reverse-proxy --from http://:80 --to 127.0.0.1:8081
```

La página respondió HTTP 200 tanto desde EC2 como desde PowerShell externo. El usuario confirmó que abrió por IP después de escribir HTTP explícitamente. Opera había mostrado conexión rechazada; no se confirmó si la causa era actualización a HTTPS, caché o proxy. La prueba externa confirma acceso HTTP en ese momento, no disponibilidad actual ni funcionamiento de todas las API.

El proxy temporal funciona fuera de Compose. Consultar `docker ps -a` antes de ejecutar futuros despliegues: reactivar el Caddy original mientras el temporal ocupa 80 genera conflicto. Para volver al proxy original, primero detener `nexodocs-ip-test` y luego iniciar `infrastructure-caddy-1`. Confirmar dominio, IP pública y certificado antes de dar HTTPS por recuperado. HTTP de prueba no cifra sesiones y no sustituye HTTPS para datos reales.

La nueva instancia también recibió instrucciones para publicar frontend directamente en 80; no hubo confirmación de aplicación. No confundir ese procedimiento con el proxy temporal efectivamente ejecutado en la anterior.

## Cómo comprobar una base por tenant

Un amigo informó haber creado una organización; aún no aportó salida SQL. No afirmar que se creó una base aislada por ver el tenant en el login.

Comprobar primero columnas y luego consultar una proyección mínima del registro, evitando imprimir configuraciones completas o credenciales:

1. Identificar tenant por nombre/ID y fecha de alta en la base de control.
2. Consultar su entrada en `app.tenant_database_registry`: modalidad, nombre de base y estado real de aprovisionamiento según el esquema instalado.
3. Confirmar que la base indicada existe en `pg_database`.
4. Verificar el worker y el enrutamiento: login y lectura/escritura en la base del tenant con runtime, y rechazo de acceso cruzado. La existencia física sola no acredita aislamiento funcional.

Los tenants `LEGACY_SHARED` conservan datos en la base compartida; los nuevos requieren routing, worker y aprovisionamiento válidos. No cambiar estados manualmente para aparentar éxito. pgAdmin puede listar las bases usando una conexión autorizada mediante túnel SSH; no abrir PostgreSQL a Internet para mostrar el diagrama o las bases.

## HU-23: correcciones documentales acordes al código

En la revisión del PDF se detectó que los diagramas F1/F2 mezclaban respaldo por tenant con respaldo completo de plataforma. El código actual usa `POST /api/v1/backups` y `POST /api/v1/backups/{id}/restore`, ambos con respuesta 202; la confirmación se envía como `organizationName` en JSON. Las operaciones continúan en segundo plano y la interfaz consulta el estado.

El programador de `TenantBackupService` revisa la configuración cada minuto por defecto, con hora/zona y control de ejecución diaria. El paquete ZIP contiene snapshot y archivos del tenant con hashes SHA-256; los hashes no cifran. Se almacena bajo `.backups/{tenantId}` en el volumen documental. La captura mantiene un bloqueo que puede hacer esperar escrituras del mismo tenant. Restauración crea antes copia de seguridad y preserva auditoría/evidencia; no es una restauración general del clúster.

No se modificó el PDF. HU-23 no queda certificada como respaldo completo cifrado ni sin impacto operativo. El respaldo de plataforma tiene otra ruta y operador del host, pendientes de instalación/ensayo según [respaldo completo](respaldo-completo.md). Ver [respaldos por tenant](../04-dominio-y-negocio/respaldos-y-restauracion.md) para contratos y límites.

## Próximos pasos según el entorno elegido

- Local: conservar los cambios sin commit y verificar la integración funcional antes de reconstruir; respaldar/inspeccionar bases antes de aplicar 091.
- Nueva EC2: resolver consistencia del archivo de entorno y login, revisar rol aprovisionador, levantar y probar worker, y comprobar HTTPS y servicios externos.
- Anterior: verificar configuración del proxy temporal, login/API por IP y el registro/base del tenant nuevo; no dar por desplegados los commits del día 17.
- Antes de compartir capturas o salidas: no imprimir entorno completo, `docker inspect` completo ni `docker compose config` expandido; usar proyecciones mínimas y `config --quiet`.
