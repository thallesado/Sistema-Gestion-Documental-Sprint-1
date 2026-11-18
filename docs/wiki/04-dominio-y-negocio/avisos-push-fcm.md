# Avisos push (FCM)

> Revisión documental: 2026-11-17. Base de código: `cc5c7f3` más cambios locales sin commit (HU de avisos push). Descripción del código inspeccionado; no verificada en un teléfono real ni contra un proyecto Firebase.

Los avisos de workflow (tarea asignada, revisión, aprobación) llegan al teléfono como notificación push de Firebase Cloud Messaging (FCM). El sondeo existente de la app se mantiene como respaldo. Este sprint solo cubre **Android**.

## Estado

| Parte | Estado |
|---|---|
| Registro y baja de tokens (`/api/v1/push-tokens`) | Implementado y probado con JUnit |
| Envío tras el commit desde el motor de workflows | Implementado y probado con cliente FCM simulado |
| Desactivación de tokens inválidos (`UNREGISTERED`, `INVALID_ARGUMENT`) | Implementado y probado |
| Sin credenciales: servicio desactivado con una advertencia | Implementado y probado |
| App Android: token, permiso, `onTokenRefresh`, baja al cerrar sesión | Implementado; pruebas con interfaz simulada |
| Deduplicación entre push y sondeo (`notificationId`) | Implementado y probado |
| Aviso guardado como `workflow` abre el trámite; `workflow_task` abre la tarea | Implementado en la lista y en la notificación local |
| Prueba en teléfono con Firebase real | **Pendiente**: requiere `google-services.json` y la cuenta de servicio |
| Avisos de vencimiento (`Tarea por vencer`) | **Pendiente**: se generan en SQL (`app.process_workflow_deadlines`) y no pasan por el código Java |
| iOS y web | Fuera de alcance |

## Configuración

**Backend.** Una de estas dos variables (documentadas en `.env.example` y `infrastructure/.env.example`, sin valores):

- `FIREBASE_CREDENTIALS_PATH`: ruta **dentro del contenedor** al JSON de la cuenta de servicio. Hay que montar el archivo desde fuera del repositorio.
- `FIREBASE_CREDENTIALS_JSON`: contenido completo del JSON, como alternativa.

Sin ninguna, `PushService` queda desactivado y el backend registra una sola advertencia al arrancar. Nada falla. Las propiedades se leen en `nexodocs.push.firebase.*` (`backend/bootstrap/src/main/resources/application.yml`). El cliente real es `FirebasePushMessageSender`; las pruebas usan un cliente simulado.

**Móvil.** `mobile/android/app/google-services.json` no se versiona (ignorado en `.gitignore`). El plugin `com.google.gms.google-services` solo se aplica si ese archivo existe, así que sin él la app compila y funciona como antes. Cómo obtenerlo: [mobile/README.md](../../../mobile/README.md#avisos).

**Base de datos.** Migración `098_push_token_registration.sql`: índice parcial sobre `user_push_tokens(tenant_id, user_id) WHERE is_active`. La tabla, su RLS y sus grants vienen de las migraciones anteriores y no cambian.

## Endpoints

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| `POST /api/v1/push-tokens` | `{ "token": "...", "platform": "ANDROID" }` | 204. Upsert por token. 409 si el token ya pertenece a otra cuenta. |
| `DELETE /api/v1/push-tokens/{token}` | - | 204. Idempotente: borra solo el token del usuario autenticado. |

Tenant y usuario salen siempre del JWT validado, nunca del cuerpo.

## Flujo del servidor

1. `WorkflowEngineService.notify` genera el `id` del aviso en Java e inserta la fila en `notifications`. No usa `RETURNING`: la política RLS de SELECT solo deja ver los avisos propios, así que `RETURNING` fallaría al avisar a otro usuario.
2. Si el destinatario no es quien ejecutó la acción, llama a `PushService.notifyAfterCommit`. Dentro de una transacción, el envío se registra como sincronización `afterCommit`: si la transacción revierte, no sale ningún aviso.
3. El envío corre en el ejecutor `pushExecutor` (1 a 2 hilos, cola de 200). Si la cola se llena, el aviso se omite y el sondeo lo muestra.
4. El trabajo fija el contexto del **destinatario** (`TenantDatabaseContext` y `SET LOCAL ROLE nexodocs_app` con `app.tenant_id` y `app.user_id`). Así la RLS de `user_push_tokens` y `users` deja leer sus tokens e idioma.
5. Si `users.push_notifications` es `false` (switch «Notificaciones push» del perfil, mismo campo que la web), no se envía nada a ninguno de sus dispositivos. El idioma sale de `users.preferred_language`: si empieza por `en`, el texto va en inglés; en otro caso, en español.
6. Contenido visible, siempre genérico: título `Nueva tarea asignada` (tipos `TASK_ASSIGNED`, `REVIEW_REQUIRED`, `APPROVAL_REQUIRED`) o `Nuevo aviso de workflow`; cuerpo `Abre NexoDocs para ver los detalles.`. El mensaje lleva el canal Android `workflow_tasks`.
7. Datos: `notificationId` y, si el aviso es de una tarea, `taskId`. No viajan nombres de documentos, pacientes, etapas ni datos clínicos.
8. `UNREGISTERED` o `INVALID_ARGUMENT` marcan el token con `is_active = false` en una transacción aparte. Otros errores se registran sin el token y no se reintentan.

## Flujo de la app

1. `main()` llama a `PushService.prepare()`: inicializa Firebase y el aislado de segundo plano. Si falla, el servicio queda inactivo.
2. La pantalla principal llama a `start()` tras iniciar sesión o restaurarla. Pide el permiso `POST_NOTIFICATIONS`, obtiene el token y lo registra. Escucha la renovación del token: registra el nuevo y borra el anterior.
3. **Primer plano:** el mensaje se muestra con `flutter_local_notifications` si su `notificationId` no se ha visto. Al tocarlo se abre la tarea indicada por `taskId`.
4. **Segundo plano o app cerrada:** el sistema muestra el aviso por el bloque `notification`. El aislado de segundo plano marca el `notificationId` como visto. Al tocarlo, la app abre la tarea (`onOpenedApp`, o `getInitialMessage` si estaba cerrada).
5. **Sondeo:** sigue igual (cada minuto con la app abierta, WorkManager cada 15 minutos en Android). Omite los identificadores ya vistos (`SeenNotifications`, últimos 200 en almacenamiento seguro).
6. **Cierre de sesión:** la app borra el token en el servidor **antes** de revocar la sesión, y después borra la lista de vistos.

## Límites conocidos

- Un token pertenece a una sola cuenta. Si el dispositivo conserva el token de otra cuenta que no cerró sesión, el registro devuelve 409 y la nueva cuenta no recibe push hasta que ese token se borre. El sondeo sí muestra sus avisos. En PostgreSQL ese caso no lanza error: el `WHERE` del `ON CONFLICT` descarta la actualización y la sentencia afecta 0 filas, por eso `PushTokenService` también responde 409 cuando no se escribió ninguna fila (comprobado en PostgreSQL 17 con el rol `nexodocs_app`, 2026-11-17).
- Si la sesión caduca sin cerrarla, el token queda en el servidor hasta que el usuario vuelva a iniciar sesión o FCM lo invalide.
- Los avisos generados en SQL (vencimientos de `030_workflow_approvals_deadlines.sql`) no envían push.
- No se envía push cuando el destinatario es quien ejecutó la acción; el aviso sí queda en la bandeja.
- La entrega de FCM no está garantizada. El sondeo es el respaldo.
- `firebase_messaging` 17 marca como obsoletos `getToken` y `onTokenRefresh` (con una anotación `ignore` en el código). Migrar al identificador de instalación exige cambiar también el envío del servidor.

## Pruebas

- Backend (JUnit): `PushServiceTest` (registro, aislamiento por tenant mediante el contexto del destinatario, envío tras commit y no antes, token inválido desactivado, sin credenciales) y `PushTokenServiceTest` (upsert, conflicto 409, baja limitada al usuario y tenant del JWT).
- Móvil (Flutter): `test/push_notifications_test.dart`, con `PushMessagingClient` y `PushPresenter` simulados.
- No cubierto por pruebas automáticas: la RLS real en PostgreSQL y el envío real a FCM. Requieren una base de datos y un proyecto Firebase.

Fuentes: [PushService](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/PushService.java), [PushTokenService](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/PushTokenService.java), [motor de workflows](motor-de-workflows.md), [mobile/lib/core/push](../../../mobile/lib/core/push/), [despliegue y recuperación](../06-operacion/despliegue-y-recuperacion.md).
