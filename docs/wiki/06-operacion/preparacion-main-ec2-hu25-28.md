# Correspondencia de contenedores y preparacion de HU-25 a HU-28

> Revisión documental: 2026-11-18. Checkout `4d7c663` mas cambios locales sin commit. Docker local inspeccionado en esta revision. EC2 no inspeccionada ni modificada.

## Donde esta aplicado

| Entorno | Servicio/contenedor | Imagen en ejecucion | Estado observado |
|---|---|---|---|
| Pruebas localhost:4201 | `nexodocs-pruebas-frontend-1` | `nexodocs-hu28-frontend`, ID prefijo `97d150a3309e` | Interfaz de las cuatro HU y buzon solo recepcion. |
| Pruebas API localhost:8081 | `nexodocs-pruebas-backend-1` | `nexodocs-hu28-backend`, ID prefijo `cdbd77ef6e05` | Backend actualizado; modo recepcion y worker habilitados. |
| Pruebas PostgreSQL localhost:5435 | `nexodocs-pruebas-postgres-1` | `postgres:17-alpine` | Migraciones 091 a 101 registradas, incluidas las dos 098 de nombres distintos. |
| Principal localhost:4200 | `nexodocs-frontend-1` | `nexodocs-frontend`, ID prefijo `707f541de9a4` | Imagen anterior; no se actualizo con esta entrega. |
| Principal API localhost:8080 | `nexodocs-backend-1` | `nexodocs-backend`, ID prefijo `8c77379961ee` | Imagen anterior. Recrear el contenedor antes no reconstruyo el codigo. |
| Principal PostgreSQL localhost:5434 | `nexodocs-postgres-1` | `postgres:17-alpine` | La ultima migracion registrada del rango 090-101 es la 090. |
| Principal worker | `nexodocs-tenant-worker-1` | `nexodocs-backend`, ID prefijo `db0735d82c21` | Imagen anterior, diferente incluso de su backend principal actual. |

Los IDs son una fotografia, no una etiqueta de release. Los contenedores `migrate` terminados con codigo 0 son procesos de una sola ejecucion; su existencia no acredita que incorporen SQL agregado despues. Reconstruir y ejecutar el migrador de la revision a publicar.

Pruebas usa proyecto Compose `nexodocs-pruebas`, volumen documental `nexodocs-pruebas_nexodocs_document_storage` y PostgreSQL `nexodocs-pruebas_nexodocs_postgres_data`. Principal usa proyecto `nexodocs` y volumenes distintos. No renombrar proyectos ni compartir volumenes para intentar transferir cambios.

## Que viaja por Git

El checkout esta en rama `main`, HEAD `4d7c663`, con cambios sin commit. HEAD y el snapshot local `origin/main` coinciden; no se hizo fetch para afirmar el estado remoto actual. Las cuatro HU no estan publicadas por el hecho de tener contenedores actualizados.

El commit debe incluir el conjunto revisado: backend, frontend, configuracion, tests, scripts, wiki y evidencia sintetica pertinente. Hay cuatro migraciones nuevas que aun no estaban bajo seguimiento al revisar:

- `database/init/098_translation_restore_references.sql`.
- `database/init/099_translation_review_concurrency.sql`.
- `database/init/100_physical_archive_recovery.sql`.
- `database/init/101_mail_intake_receive_only.sql`.

Tambien incluir los nuevos tests, el script [mail-intake-receive-browser.cjs](../../../scripts/tests/mail-intake-receive-browser.cjs), paginas de HU-26/27/auditoria y capturas sinteticas usadas por la wiki. La migracion `098_push_token_registration` ya existe y tiene otro nombre completo: el registro de migraciones distingue el nombre, no solo el numero.

No agregar indiscriminadamente todo el directorio. `.env` esta ignorado; `SI2.eapx` y `database/exports/nexodocs-ea-schema.sql` son artefactos locales pendientes de clasificacion, no necesarios para ejecutar estas HU. No se inspecciono su contenido ni se incluyen automaticamente. Revisar los archivos staged antes del commit.

## Que no viaja y como reproducirlo

Las pruebas locales usan overrides y un archivo de entorno bajo el directorio temporal de Windows. Esos archivos cambian puertos, nombres de imagen y configuracion privada; no se necesitan en EC2. Los Dockerfiles versionados construyen las mismas fuentes desde el checkout publicado:

- [backend.Dockerfile](../../../infrastructure/docker/backend.Dockerfile) incluye backend y todas las migraciones del checkout.
- [frontend.Dockerfile](../../../infrastructure/docker/frontend.Dockerfile) compila Angular y ejecuta sus pruebas.
- [migrations.Dockerfile](../../../infrastructure/docker/migrations.Dockerfile) incluye SQL y bootstrap tenant.
- [docker-compose.yml](../../../infrastructure/docker-compose.yml) define las variables y monta almacenamiento persistente.

La configuracion real debe existir por separado en el servidor. No copiar el .env de pruebas entero ni sus nombres de base, puertos o URL localhost.

| Configuracion | Necesidad |
|---|---|
| `MAIL_INTAKE_RECEIVE_ONLY=true` | Alcance aprobado de HU-28, sin escaner ni revision. |
| `DOCUMENT_OPERATIONS_WORKER_ENABLED=true` | Recepcion automatica y cola de envios. |
| `MAILBOX_PROFILES_JSON` | Perfil Gmail/IMAP, con tenantId del servidor, host, puerto, TLS y autorizacion privada. No se publica en Git. |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM`, opciones TLS | SMTP para HU-25. IMAP no configura SMTP ni viceversa. |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_TIMEOUT_SECONDS` | Proveedor de HU-27; confirmar disponibilidad desde el servidor. |
| `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS` | Dominio HTTPS final; no localhost para enlaces a destinatarios externos. |
| Configuracion de routing/aislamiento y usuario runtime | Mantener el modo real del servidor; no copiar el routing desactivado de 4201. |

No se necesita desplegar ClamAV en este alcance. El Compose guarda la clave de operaciones en `/data/storage/.operations/key`; se verifico su existencia en el volumen de pruebas sin leer su contenido. En EC2 conservar su propio volumen y clave: perderla invalida enlaces/codigos cifrados existentes. Las conexiones, documentos y adjuntos de las bases de pruebas no se copian al subir codigo; crear/probar la conexion IMAP en el tenant del servidor.

## Secuencia de despliegue que debe respetarse

1. Publicar el commit completo revisado. En EC2 identificar primero checkout/commit, archivos Compose, proyecto, volumenes y modo tenant reales. La [guia de operacion](despliegue-y-recuperacion.md) contiene antecedentes, no una inspeccion actual.
2. Respaldar base central, bases tenant si corresponden, almacenamiento y claves; comprobar que el respaldo es legible y existe un plan de recuperacion. No usar `down -v` ni crear otro proyecto sobre los mismos datos.
3. Actualizar el checkout sin descartar cambios del servidor. Validar la composicion con `config --quiet`, conservando overrides HTTPS/Gemini y perfiles necesarios. No imprimir configuracion expandida con secretos.
4. Construir imagenes de la revision publicada para `migrate`, `backend` y `frontend`. El `tenant-worker`, si esta activo, debe recrearse tambien con la imagen nueva del backend; no dejarlo con una imagen antigua. Tener un contenedor arrancado no prueba que use codigo nuevo.
5. Ejecutar el migrador actualizado y comprobar codigo 0 e historial de nombres completos. Las bases tenant aisladas requieren su migracion tenant-safe mediante el mecanismo existente, no solo aplicar SQL a la central. No iniciar un backend que use `RECEIVED` sin la migracion 101.
6. Recrear servicios con las imagenes nuevas despues de cumplir sus prerrequisitos. Conservar el nombre de proyecto y los volumenes existentes. No usar `--no-deps` para saltarse migraciones pendientes.
7. Verificar publicamente HTTPS, salud, login tenant, lista y descarga documental; luego HU-25 con destinatario autorizado y acceso OTP, HU-26 con dos roles, HU-27 con consentimiento y dos personas, HU-28 con correo real y descarga. Registrar commit, IDs de imagen y migraciones del servidor.
8. Solo entonces aceptar el despliegue. Revertir imagenes no revierte las migraciones; revisar compatibilidad y recuperar base/archivos de manera consistente si es necesario.

La EC2 de 1 GB indicada por el usuario no fue medida en esta revision. Retirar ClamAV elimina esa dependencia de memoria, pero no acredita capacidad suficiente para compilar las imagenes ni atender carga. No se ejecutaron comandos de despliegue ni se modifico el entorno principal local.

## Validacion disponible

### Integracion para publicar en main (2026-11-18)

Despues de la inspeccion anterior, el usuario autorizo publicar. Se consulto el remoto y se integraron sus 12 commits hasta `2fee34bd`, conservando controles de autorizacion documental, normalizacion MIME y limpieza de archivos ante rollback. La traduccion deja de estar deshabilitada porque esta entrega implementa extraccion, proveedor y publicacion reales; la interfaz mantiene permisos, estados editables y prohibicion de autorrevision. Las pruebas antiguas del estado deshabilitado se adaptaron al contrato implementado y las de permisos se conservaron.

Verificaciones posteriores a esa integracion: Maven backend **583 pruebas, cero fallos/errores, 27 omitidas** por condiciones de ejecucion; frontend **235 aprobadas, cero fallos, una omitida**; compilacion Angular correcta; integracion `-Browser` **24 pruebas, cero fallos/errores/omitidas**, incluido control de lectura documental del remoto y descarga del buzon con API real. Wiki con snapshots disponibles correcta. Los comandos y logs finales usan el prefijo temporal `nexodocs-main-*`.

Las referencias anteriores a cambios sin commit y a `origin/main` como snapshot corresponden a la inspeccion inicial. El SHA publicado se obtiene del historial Git de la entrega; no cambia por publicar el estado de los contenedores locales ya descritos ni se despliega automaticamente en EC2. Los artefactos `SI2.eapx` y `database/exports/` se conservan localmente fuera de la entrega funcional, al igual que las credenciales privadas.

La [auditoria de las cuatro HU](../04-dominio-y-negocio/auditoria-hu25-28.md) registra pruebas funcionales, SQL y navegador. La composicion base local se valida sin expandir secretos. Esto demuestra que la entrega puede construirse desde fuentes; no acredita la configuracion privada ni la salud de EC2.
