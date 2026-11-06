# HU-17 - Transferencia documental

Verificación local del 2026-11-06. Rama main / 91fb767 más cambios locales. Pantalla: http://localhost:4200/documents/transfers. Todos los documentos son sintéticos y pertenecen al tenant de demostración HU09.

## Flujo visual completo

1. [Documento apto y selección del destino](01-seleccionar-apto-y-destino.png): HU17-APTO cumplió su conservación anual; desde Gestión el destino permitido es Central. Motivo obligatorio de 10 a 1000 caracteres.
2. [Solicitud registrada](02-solicitud-registrada.png): POST 201 y estado Solicitada. El nivel sigue siendo Gestión. El documento deja de aparecer entre candidatos mientras la solicitud está pendiente.
3. [Aprobar](03-transferencia-aprobada.png): confirmación del usuario y HTTP 200. El nivel todavía sigue en Gestión; aparece Ejecutar transferencia.
4. [Ejecutar a Central](04-transferencia-ejecutada-central.png): HTTP 200. Solo esta acción cambia el nivel y reinicia su fecha de conservación. No se permite iniciar de inmediato otro movimiento bajo la política anual.
5. [Seleccionar Central → Histórico](05-seleccionar-central-a-historico.png): para demostrarlo el mismo día, se asignó explícitamente una política sintética de cero meses. No se cambiaron las fechas ni se simularon respuestas.
6. [Segunda aprobación](06-historico-aprobado.png): el movimiento sigue pendiente de ejecución.
7. [Ambos movimientos ejecutados](07-transferencias-ejecutadas-historico.png): Gestión → Central y Central → Histórico quedan en el historial con fechas y motivos.
8. [Usuario sin permiso de archivo](08-lector-no-puede-aprobar.png): consulta el historial y una solicitud pendiente preparada para permisos; no ve Aprobar ni Ejecutar. Sus intentos directos reciben 403.
9. [Persistencia al recargar](09-historial-persistente-y-solicitud-pendiente.png): se recuperan los dos movimientos y una solicitud sintética adicional que puede usarse para probar manualmente la aprobación con el administrador.

Capturas completas obtenidas del navegador real, sin recortar ni modificar imágenes.

## Qué se completó

La migración 090 añade el nivel y la fecha de ingreso a documents, y document_transfers con tenant, documento, política, copia del plazo y cumplimiento, origen/destino, motivo, estados, actores y fechas. Claves foráneas compuestas impiden cruzar tenants. RLS restrictivo limita el alcance; un índice único impide dos solicitudes pendientes para el mismo documento.

DocumentRetentionService bloquea el documento y después tipo/política/solicitud. Cada etapa vuelve a validar política TRANSFER activa, plazo cumplido, estado APPROVED/CURRENT/ARCHIVED, ausencia de workflow y destino inmediato. Aprobación y ejecución también comprueban que no cambió la política ni la fecha de cumplimiento desde la solicitud. Ejecutar actualiza documento, transferencia y auditoría en la misma transacción.

Se reutiliza document:archive para operar, junto con document:read y configuration:read. Consultar el historial requiere document:read. La interfaz limita sus acciones con los mismos permisos y preserva los campos ocultos de nombre/código. No se impone que solicitante, aprobador y ejecutor sean personas distintas.

## Resultados comprobados

[Resultados HTTP completos](api-results.json). [PDF utilizado](hu17-informe.pdf).

| Verificación | Resultado |
| --- | --- |
| Solicitar / aprobar / ejecutar | 201 / 200 / 200 |
| Nivel tras solicitar / aprobar / ejecutar | Gestión / Gestión / Central |
| Segundo movimiento a Histórico | 201 / 200 / 200 |
| Transferir antes del vencimiento | 409 |
| Saltar Gestión → Histórico | 400 |
| Motivo insuficiente | 400 |
| Política ausente o inactiva | 409 |
| Ejecutar antes de aprobar | 409 |
| Segunda solicitud pendiente | 409 |
| Política modificada tras solicitar | 409 |
| Cambiar acción a Conservar antes de ejecutar | 409 |
| Repetir ejecución | 409 |
| Mover de nuevo sin cumplir el plazo del nivel nuevo | 409 |
| Regresar desde Histórico | 400 |
| Lector intenta aprobar o ejecutar | 403 |
| Versión tras ambos movimientos | v1, mismo SHA-256 |

SHA-256 original y descarga final: `5a05ab593d6ddfafe0030aaa7149f573ada5035095723969087e848c4aa96dfb` (HTTP 200). Se conserva la referencia HU17-TRANSFER. Consulta directa a PostgreSQL: HU17-APTO está en HISTORICAL, archive_level_since=2026-11-06, current_version=1. Los dos movimientos guardan los tres actores y sus fechas. Auditoría: dos TRANSFER_REQUESTED, dos TRANSFER_APPROVED y dos TRANSFER_EXECUTED para ese documento.

[Prueba SQL de integridad y aislamiento](../../../database/tests/hu16_17_retention_transfers.sql) aprobada: bloquea cambiar un movimiento ejecutado, modificar su motivo y borrarlo; confirma v1 y ambos movimientos, impide modificaciones al lector y devuelve cero transferencias al cambiar a otro contexto de tenant. Toda la prueba termina con ROLLBACK.

49 pruebas seleccionadas de backend y seis comprobaciones de frontend aprobadas. Build Angular y paquete Java correctos. La migración final se probó desde un respaldo anterior y de nuevo sobre la misma base para comprobar idempotencia. No se ejecutó toda la suite ni una restauración funcional completa de respaldos.

## Límites y estado final

La transferencia clasifica el documento entre niveles de archivo; los binarios siguen en el volumen central y sus versiones/metadatos en PostgreSQL. El nivel HISTORICAL es independiente del estado de vigencia CURRENT/ARCHIVED de HU-15; no se cambia automáticamente la vigencia al transferir.

Candidatos e historial muestran hasta 500 registros. No hay cancelación de solicitudes ni transferencias programadas: si cambia la política de una solicitud pendiente, debe restablecerse la política original antes de continuar. El tipo HU16-RET terminó con la política anual restituida; la política de cero meses quedó exclusivamente asociada al tipo sintético HU17-PERM, con una solicitud pendiente preparada para permisos.

Se conservaron respaldos previos fuera del repositorio. El sistema queda ejecutándose en localhost con los cambios y datos sintéticos. No hubo commit, push ni despliegue en AWS. Settings del tenant de prueba conserva un aviso previo ajeno al circuito que se cerró desde la interfaz.
