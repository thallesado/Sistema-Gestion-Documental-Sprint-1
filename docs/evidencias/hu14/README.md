# HU-14: estados documentales y versionado

Verificación local del 2026-11-06 sobre el checkout `91fb767` más cambios locales. Se usó Docker Compose local y el tenant sintético `HU09 - Demostracion sintetica`; las capturas no contienen pacientes ni documentos reales. No demuestra el estado de AWS.

## Recorrido observado

1. [Documento con versión 1 y estado borrador](01-documento-v1-borrador.png).
2. [Cambio de estado a pendiente](02-estado-actualizado.png), ejecutado desde el panel del documento.
3. [Confirmación de carga de una versión posterior](03-confirmacion-version-v2.png), con motivo requerido.
4. [Documento después de guardar la versión 2](04-documento-v2-persistido.png). PostgreSQL local confirmó `current_version = 2`, estados de archivo v1 y v2, y estado `DRAFT` tras crear v2.

[Resultados HTTP](api-results.json).

## Criterios contrastados

| Criterio | Resultado observado |
|---|---|
| Spring Boot genera un ETag para el documento | GET y respuestas de mutación devolvieron ETag |
| Cambiar el estado requiere la versión vigente | PATCH desde la interfaz devolvió HTTP 200 y un ETag nuevo |
| Cambiar el estado sin la revisión vigente se rechaza | Reutilizar una revisión anterior devolvió HTTP 412 y no cambió el documento |
| Versiones posteriores conservan historial | PostgreSQL contiene version_number 1 y 2 para el documento sintético |
| Cargar una nueva versión actualiza estado y puntero | Después de v2, `current_version=2` y estado `DRAFT` |
| Angular vuelve a consultar el detalle y conserva el ETag | Observado en GET de detalle posterior a mutaciones; cliente envía `If-Match` en PATCH y multipart |
| Token faltante | `DocumentStateToken.requireMatch` responde HTTP 428 |

El token se calcula con SHA-256 sobre id, estado, número de versión y `updatedAt`. No es un token de autenticación. Las operaciones de estado y carga bloquean la fila tenant-scoped con `FOR UPDATE`, validan `If-Match` dentro de la transacción y actualizan el ETag al responder.

## Verificaciones

- `DocumentStateTokenTest`: token diferente ante cambios de estado/versión; ausencia 428 y token obsoleto 412.
- Docker build del backend: 458 pruebas, 0 fallas, 0 errores, 4 omitidas.
- Angular `typecheck` y build de producción: correctos.
- Flutter `analyze` y suite `mobile_features_test.dart`: correctos.
- En navegador Chromium se ejecutó login, consulta, cambio de estado y carga multipart real contra Angular y Spring Boot en Docker.

No hay migración SQL de HU-14. La persistencia de binarios usa el almacenamiento ya configurado, no la base PostgreSQL.
