# Despliegue, HTTPS y recuperación

> Revisión documental: 2026-10-16. Base de código `a590a6d`; los antecedentes históricos se identifican por separado. No certifica producción.

## Alcance de esta guía

Antecedente de la instalación del usuario, **no inspección actual**: Ubuntu EC2, repo /opt/nexodocs, proyecto Compose infrastructure, .env en /opt/nexodocs/.env, configuración externa en /opt/nexodocs-config. No asumir que otro servidor usa estos nombres. No es una orden para desplegar.

Antes de cualquier acción: identificar commit, cambios locales, proyecto, mounts, respaldo reciente y servicios actuales. Conservar el volumen PostgreSQL real; un proyecto distinto puede crear otro volumen.

## Composición conocida

Los tres archivos usados en esa instalación:

1. /opt/nexodocs/infrastructure/docker-compose.yml
2. /opt/nexodocs-config/gemini.compose.yml
3. /opt/nexodocs-config/https.compose.yml

Ejemplo de función Bash de operación, solo para ese servidor una vez confirmados sus archivos:

```bash
dc() {
  docker compose \
    --project-name infrastructure \
    --project-directory /opt/nexodocs \
    --env-file /opt/nexodocs/.env \
    -f /opt/nexodocs/infrastructure/docker-compose.yml \
    -f /opt/nexodocs-config/gemini.compose.yml \
    -f /opt/nexodocs-config/https.compose.yml "$@"
}
dc config --quiet
dc ps -a
```

No imprimir `dc config` sin --quiet: puede expandir valores sensibles. Las rutas relativas de volúmenes se resuelven según el directorio de proyecto, no necesariamente el archivo override; preferir ruta absoluta para Caddyfile.

## HTTPS informado

Caddy en puertos 80/443, reverse_proxy frontend:80; frontend publicado solo en 127.0.0.1:8081. Datos de certificados en volúmenes caddy_data/config. FRONTEND_URL usa HTTPS y afecta enlaces/CORS. Conservar configuración/volúmenes; no ejecutar down para detener solo Caddy.

El DNS debe coincidir con IP pública vigente y los puertos ser alcanzables. Stop/start EC2 puede cambiar IP; confirmar DNS. Tener HTTPS 200 en / no demuestra que login/API/OCR funcionen. [Caddy](https://caddyserver.com/docs/automatic-https), [Compose merge](https://docs.docker.com/compose/how-tos/multiple-compose-files/merge/).

## Actualización y migración

- No sobrescribir cambios locales con reset/pull forzado.
- Inspeccionar cambios SQL y datos incompatibles antes de aplicar.
- Respaldar base y archivos; verificar que el respaldo es legible y ensayar restauración aislada.
- Reconstruir migrate además de backend/frontend cuando cambie SQL.
- Comprobar finalización de migrate e historial app.schema_migrations antes de servir backend nuevo.
- La 035 agrega campos/restricciones de ocr_jobs; jobs INDEXED sin documento o FAILED sin motivo pueden bloquearla.
- No usar --no-deps para omitir una migración necesaria; solo reiniciar imágenes cuando sus prerrequisitos estén confirmados.
- El Dockerfile frontend local tiene una copia adicional de nginx.conf para pruebas; no asumir que se subió a main.

## Datos y configuración

pg_dump respalda PostgreSQL, no volumen documental. Archivos, originales OCR y certificados tienen ciclos de respaldo distintos. No borrar volúmenes ni ejecutar datos sintéticos para recuperar errores.

Documentar nombres, no valores: FRONTEND_URL/PORT, DB/POSTGRES_*, STORAGE_LOCAL_PATH, MAIL_*, GEMINI_*. Configuración real permanece fuera de Git; respetar Secret Safety de instrucciones de agente y no solicitar valores en chat. Esta guía no cambia ni extrae credenciales.

## Verificación y reversión

Verificar HTTPS/redirect, login, lista/descarga, OCR ficticio y errores del backend. Registrar commit/imagenes/migraciones. Si una migración ya se aplicó, revertir imágenes no revierte el esquema; revisar compatibilidad y no improvisar SQL inverso. Una recuperación requiere base y archivos de la misma situación consistente.

Costos: detener contenedores no detiene EC2; revisar facturación por servicio/tipo de uso y requisitos de disponibilidad antes de cambios de capacidad.
