# Revisión de pendientes del sprint especial

Fecha: 2026-10-21. Checkout `main`, revisión `c93a8b4` más cambios locales sin commit, incluidos respaldos y migraciones 049–051. Esta revisión no hizo fetch ni comprobó ramas de colegas, protección de GitHub o estado de EC2. Es una comparación del plan con fuentes locales y pruebas seleccionadas, no una certificación funcional completa.

## Cómo interpretar los estados

- **Implementado en fuentes:** existe el recorrido principal; quedan verificaciones de integración o interfaz indicadas.
- **Parcial:** existe una implementación, pero falta parte del criterio o se encontraron defectos.
- **Pendiente:** el recorrido requerido no está implementado en las fuentes revisadas.
- **Operativo no comprobado:** depende del servidor, GitHub, proveedor o dispositivo y no se inspeccionó aquí.

Las secciones «Qué ya existe» de los archivos originales son históricas. No usar sus números reservados de migración para cambios nuevos: varios ya se emplearon en otros módulos. Los respaldos locales no están publicados en GitHub ni desplegados en AWS.

## Andrés

| Tarea | Estado | Qué falta para cerrarla |
|---|---|---|
| F1: respaldo/restauración por tenant | Implementado localmente para tenant; plataforma preparada, pendiente de ensayo operativo | Existe ZIP con datos/archivos, verificación, respaldo de seguridad, aislamiento y evidencia histórica. El endpoint de respaldo completo de plataforma delega a un worker del host; requiere instalarlo con disco independiente y probar recuperación. Confirmar el recorrido visual con sesión real y recuperación después de reinicios. No rehacerlo por no usar la entidad histórica `BackupHistory`: la adaptación está documentada. |
| F2: programación y pantalla | Implementado localmente; operación de infraestructura pendiente | Copia diaria configurable, manual, retención en días e historial funcionan en la implementación local. Timer diario del host preparado para infraestructura completa; falta instalarlo con destino independiente y definir capacidad para evidencia fijada, que no caduca. El scheduler tenant actual es para un backend único. La retención en días fue acordada después del plan original que hablaba de N copias. |
| C2: fallos de login y bloqueo temporal | Implementado localmente y verificado con pruebas seleccionadas | Filtro de cinco solicitudes por minuto, 429/Retry-After, auditoría de fallos sin contraseña y migración 052. Probados HTTP con servicio simulado, expiración, separación de organizaciones y escritura real de auditoría en base aislada. Falta aplicar 052 y reconstruir backend/proxy en el entorno de trabajo; memoria local sin coordinación entre réplicas. |
| G3: APK en CI | Implementado en workflow; ejecución remota no comprobada | Compila debug APK y publica artefacto durante 14 días; Java 17 explícito y ejecución manual. README móvil actualizado. La publicación del artefacto requiere que el workflow corra en GitHub tras enviar los cambios. |
| Infraestructura y GitHub | Operativo no comprobado | No se verificaron protección de main, despliegue por etiquetas, configuración real de producción ni un ensayo de recuperación de infraestructura. |

Fuentes: [servicio de respaldos](../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/TenantBackupService.java), [controlador](../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/controller/BackupController.java), [diseño operativo y pruebas previas](../wiki/04-dominio-y-negocio/respaldos-y-restauracion.md), [auditoría de login](../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/AuthenticationAuditService.java), [filtro público](../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/security/PublicEndpointRateLimitFilter.java), [CI móvil](../../.github/workflows/mobile-ci.yml).

### Continuación local de Andrés

**APK local generado y firma verificada:** `mobile/build/app/outputs/flutter-apk/app-debug.apk`, 162755571 bytes. Se instaló Android SDK 36 y Gradle generó el APK, pero `flutter build apk --debug` terminó con error al duplicarlo a la carpeta final porque C: se quedó sin espacio. Se trasladó el APK completo sobre la copia incompleta, dentro de `mobile/build`, verificando igualdad de SHA-256; `apksigner verify` pasó. El comando completo no se informa como exitoso. Tras el traslado quedaban aproximadamente 145 MiB libres: liberar capacidad antes de repetir builds. No se borraron volúmenes ni datos de la aplicación.

Pruebas de esta continuación: suite backend de 174 casos (173 correctos y una integración opt-in omitida); después de agregar plataforma, ocho casos seleccionados de login/plataforma correctos. Frontend Angular compiló; 20 pruebas de permisos/scaffold correctas. Verificador documental con snapshots disponible correcto y nueve pruebas del validador correctas. Nginx validó la configuración nueva en un archivo temporal sin reemplazar la configuración activa. Las pruebas aisladas de scripts, con Docker simulado en un contenedor Linux sin red, confirman que un fallo de dump vuelve a arrancar el backend y no publica una copia completa ficticia, y que el worker persiste FAILED, detecta operaciones interrumpidas y publica su heartbeat. La compilación del APK se registra al finalizar, sin confundir el build local con una ejecución de Actions.

Se repitió el escenario SQL de respaldos en `nexodocs_backup_release_test`: recuperación operativa completa, modificaciones de otro tenant conservadas, mantenimiento, auditoría, evidencia inmutable y denegación transversal. El script termina en ROLLBACK. Se aplicó 052 solo en esa base aislada y se comprobó la inserción de LOGIN_FAILED ejecutada con `SET LOCAL ROLE nexodocs_app`, incluyendo hash y ausencia de contraseña. No se aplicó a la base de trabajo ni al servidor.

El [respaldo completo del host](../wiki/06-operacion/respaldo-completo.md) tiene endpoint de plataforma, cola persistente, worker separado, validación de archivos/checksums y timer diario preparados para Linux. Requiere disco independiente y pausa del backend. No se ejecutó contra el host real; faltan el ensayo de recuperación, la política de capacidad de evidencia y la activación de los timers. F1/F2 siguen pendientes de esas comprobaciones operativas. No se configuró protección de main ni se desplegó: no hay una conexión administrativa de GitHub/servidor disponible en esta sesión. Los cambios siguen sin commit.

## Diego

| Tarea | Estado | Qué falta para cerrarla |
|---|---|---|
| PR 0 | Implementado en fuentes | El andamiaje existe. No mantener como pendientes sus servicios y rutas; las funciones posteriores reemplazan sus placeholders cuando corresponde. |
| G0: cliente Gemini compartido | Implementado en fuentes | Existe `GeminiClient`, reutilizado por OCR y asistente, con pruebas. La integración real con el proveedor no se ejecutó aquí. |
| C1: auditoría detallada | Parcial | Existe `DefaultAuditRecorder`, hora de cliente, detalles y llamadas desde servicios. Revisar exhaustividad antes/después: por ejemplo UPDATE de usuario conserva antes solo el estado y después estado/email, aunque también se editan nombres/apellidos. Sus fallos de escritura se capturan y quedan en logs; definir detección/reintento de eventos importantes para no perder detalle tras confirmar negocio. |
| C3: bitácora contra manipulación | Parcial | Existen cadena y verificación. `AuditAnchorService.createAnchor` guarda el sello en el repositorio de la misma base: no se encontró publicación externa ni programación allí. Falta anclaje fuera del control del DBA y comprobar la amenaza de reescritura completa. No afirmar que ya se publica en S3; la wiki menciona ese destino, pero no está implementado en este servicio. |
| H2: asistente contextual | Implementado en fuentes, pendiente de validación real | Widget propio, contexto saneado, manual y límite por usuario existen. Probar respuestas con Gemini y permisos de distintos perfiles; mantener manual sincronizado con las funciones reales. |

Fuentes: [GeminiClient](../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/GeminiClient.java), [recorder](../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/DefaultAuditRecorder.java), [UserService](../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/UserService.java), [anclaje](../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/AuditAnchorService.java), [asistente](../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/AssistantService.java).

## Oscar

| Tarea | Estado | Qué falta para cerrarla |
|---|---|---|
| B3: permisos en frontend | Implementado en fuentes | Sesión, menú, guards, directiva y botón de creación de grupo existen. La migración correctiva local 051 resuelve la lectura del perfil tras 046. Falta validación visual completa con perfiles mínimos y prueba HTTP de acceso directo denegado; los permisos del JWT requieren renovación al cambiar asignaciones. |
| B1: grupos/perfiles | Implementado en fuentes | `UserFormPolicy` exige grupo y ambos caminos de alta revisados crean administrador. Conservar grupos demo. La equivalencia grupo/perfil/rol continúa siendo una interpretación del requisito, pendiente de confirmación docente según el plan. |
| B2: privilegios por componente | Parcial en alcance global | Catálogos, matriz, API, directiva y aplicación en tres formularios existen. Falta comprobar el mismo dato por todas sus vías de lectura: dashboard, búsqueda, expedientes, workflows, descarga y reportes. La wiki ya reconoce que varios caminos documentales no aplican ocultación. Definir alcance para evitar que un campo oculto en una pantalla aparezca por otra API. |

Fuentes: [wiki de privilegios](../wiki/04-dominio-y-negocio/usuarios-grupos-y-privilegios.md), [política de usuarios](../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/UserFormPolicy.java), [reglas de acceso](../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/ComponentFormAccess.java), [menú](../../frontend/src/app/core/data/nexodocs-data.ts).

## Mauricio

| Tarea | Estado | Qué falta para cerrarla |
|---|---|---|
| A1: planes y alta con administrador | Parcial | Planes, creación de administrador, asignación de permisos y correo existen. `mustChangePassword` se guarda en el modelo al crear el usuario, pero no aparece en las respuestas de login/perfil y no se encontró exigencia de cambio en el recorrido. Falta bloquear uso normal hasta cambiar la contraseña temporal y completar ese ciclo. El envío fallido solo advierte en logs. |
| A2: límites del plan | Parcial | Hay controles de usuarios, documentos y almacenamiento, incluidos archivos adoptados, y serialización por tenant en el repositorio de planes. Reactivar un usuario en `updateUser` no llama al control de cupos. OCR valida y registra 1 por archivo: falta contar páginas de PDF. `recordStorageUsage` existe sin llamadas desde almacenamiento, aunque el uso actual sí se calcula sumando versiones. Un fallo consultando consumo OCR puede devolver cero: probarlo y evitar que se omita la cuota por un error. |
| A3: suscripción/pago simulado | Parcial | Existen `/public/signup`, registro de pago simulado y `/public/onboarding` alternativo. No se encontró límite de peticiones específico para ambos endpoints. Revisar y unificar ambos recorridos: uno reutiliza TenantService y el otro crea entidades directamente. Probar correo, activación y permisos del plan con PostgreSQL. |
| E2: marca/regionalización | Parcial | Settings, color, URL de logo, moneda, zona horaria y pipes existen. El formulario utiliza URL de imagen, no carga de archivo al almacenamiento como pedía el plan. Idioma/defaultLanguage no alimentan el idioma efectivo del usuario en el recorrido inspeccionado. Los pipes regionales usan locales fijos y no cubren todas las pantallas. |
| H1: ayuda | Parcial en contenido | Panel, búsqueda, artículos Markdown, guía y vínculo al asistente existen. Corregir afirmaciones no respaldadas: preprocesamiento de perspectiva/sombras, validez legal por aprobación, confidencialidad y capacidades clínicas descritas como generales. Añadir ayuda de respaldos y redactar para varios rubros. |

Hallazgo prioritario en A1: `TenantService.sendWelcomeEmail` incluye la contraseña temporal como argumento del log cuando no existe `mailSender`. Además, `PublicSignupResponse` recibe `passwordUsed` desde el servicio. Revisar el contrato para no devolver contraseñas en la respuesta de alta. Se inspeccionó código; no se consultaron logs con credenciales ni se comprobaron exposiciones reales.

También se verificó que el artículo Markdown de workflows anuncia etapas paralelas y correo electrónico, fuera del alcance operativo documentado del motor. Corregir tanto contenido embebido como archivos de ayuda, no solo una de las dos fuentes.

Fuentes: [alta de tenant](../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/TenantService.java), [alta pública](../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/PublicSignupService.java), [onboarding alternativo](../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/PublicOnboardingService.java), [límites](../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/PlanLimitService.java), [enforcement](../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/PlanEnforcementService.java), [jobs OCR](../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/OcrJobService.java), [formato regional](../../frontend/src/app/core/i18n/format.pipe.ts), [ayuda](../../frontend/src/app/features/help/components/help-drawer.ts), [artículo OCR](../../frontend/public/assets/help/ocr.md), [artículo workflows](../../frontend/public/assets/help/workflows.md).

## Cruz

| Tarea | Estado | Qué falta para cerrarla |
|---|---|---|
| D1: reportes reales | Parcial | Hay API, filtros obligatorios, SQL tenant-scoped, paginación y conexión Angular. El CSV solicita tamaño 10000, pero cada consulta lo limita a 200: no exporta todo el resultado filtrado. Persisten `DemoSessionState` y comparativo de tenants con valores fijos en una rama de la pantalla. No se encontró reporte OCR tabular en el controlador de reportes; sí analítica OCR. Precisar qué exporta cada formato y respetar permisos de datos y componentes. |
| D3: analítica | Parcial | Hay agregaciones reales y gráficos. `AreaDistribution.workflowCount` y `TopUserActivity.documentsCreated` se entregan como 0 fijo. El conteo de acciones une eventos con múltiples roles sin DISTINCT: puede multiplicar la actividad. Las fechas se interpretan en UTC, sin zona configurada del tenant en ese recorrido. |
| G1: OCR con cámara móvil | Implementado en fuentes, pendiente de dispositivo | Captura, permisos Android/iOS, compresión, subida, revisión e indexación existen. Probar físicamente cámara, permisos denegados y documento visible en la web después de indexar. Los tests no usaron cámara real ni Google. |
| G2: móvil sin datos simulados | Implementado en recorridos revisados | Se ven errores reales, acciones de tareas remotas, descarga, refresh y logout remoto; hay pruebas con servidor simulado. Falta validar contra backend real y dispositivo. Los avisos de notificaciones locales en tests no verifican que funcionen en Android/iOS. |

Fuentes: [ReportService](../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/ReportService.java), [AnalyticsService](../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/AnalyticsService.java), [página de reportes](../../frontend/src/app/features/reportes/pages/reportes-page.ts), [API Angular](../../frontend/src/app/core/api/report-api.service.ts), [cámara móvil](../../mobile/lib/screens/scan/scan_document_page.dart), [API móvil](../../mobile/lib/core/api/auth_api.dart), [workflows móviles](../../mobile/lib/core/api/workflows_api.dart).

## Edixon

| Tarea | Estado | Qué falta para cerrarla |
|---|---|---|
| D2: QBE | Pendiente en checkout | `QbePage` sigue siendo UnderConstruction. No se encontró motor/controlador de `/queries/run` ni persistencia de consultas guardadas en los recorridos revisados. Hace falta catálogo permitido, filtros parametrizados, permisos, límites, guardado y pantalla. No inferir inexistencia en una rama no descargada. |
| E1: idiomas | Parcial | `I18nService` tiene es/en/fr/zh y localStorage; hay traducciones y directivas. Coexiste con el `TranslationService` del scaffold. `preferred_language` no se devuelve/actualiza desde el perfil revisado; no se encontró integración con defaultLanguage del tenant. Falta resolver precedencia usuario/tenant/navegador, persistir preferencia y comprobar el alcance acordado, ayuda incluida. |
| D4: voz | Pendiente, P3 opcional | `VoiceReportPage` sigue siendo UnderConstruction. Falta transcripción, interpretación, confirmación y ejecución limitada a QBE. Hacer después de D2 y confirmar si es exigencia docente. No habilitar SQL libre para adelantarlo. |

Fuentes: [QBE](../../frontend/src/app/features/reportes/qbe/qbe-page.ts), [voz](../../frontend/src/app/features/reportes/voice/voice-report-page.ts), [idiomas actuales](../../frontend/src/app/core/i18n/i18n.service.ts), [scaffold de traducción](../../frontend/src/app/core/i18n/translation.service.ts), [perfil backend](../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/dto/UserResponse.java).

## Orden recomendado para elegir próximos trabajos

| Orden | Unidad acotada | Motivo y dependencia | Tamaño relativo |
|---|---|---|---|
| 1 | Corregir exposición de contraseña temporal y terminar cambio obligatorio (A1/C1) | Seguridad del alta; coordinar contratos de sesión. | Mediano |
| 2 | Login fallido y bloqueo temporal (C2) | P1 claramente pendiente, útil para todos los tenants. | Mediano |
| 3 | Cerrar defectos de reportes y analítica (D1/D3) | CSV truncado, ceros y conteos afectan confianza en resultados. Coordinar con Cruz. | Mediano |
| 4 | Cerrar cuotas de reactivación y páginas OCR (A2) | Evitar saltarse el plan y contabilizar consumo incorrecto. Coordinar con Mauricio/Diego. | Mediano |
| 5 | APK como artefacto CI (G3) | Pendiente pequeño y separado, facilita pruebas del equipo. | Pequeño |
| 6 | Respaldo completo de infraestructura y ensayo de recuperación (F1/F2) | Completa tu alcance original y cubre pérdida del disco. Requiere definir destino y capacidad, sin asumir AWS obligatorio. | Grande |
| 7 | Preferencia de idioma, regionalización y ayuda fiel (E1/E2/H1) | Cierra integración existente antes de ampliar idiomas/pantallas. | Mediano |
| 8 | Validación transversal de campos ocultos (B2) | Revisar APIs alternativas y permisos mínimos; priorizar según sensibilidad. | Mediano/grande |
| 9 | Anclaje externo de auditoría (C3) | Completa el modelo de amenazas; coordinar almacenamiento independiente. | Mediano/grande |
| 10 | QBE (D2), luego voz si aplica (D4) | Función nueva de mayor alcance. Confirmar trabajo en ramas de Edixon antes de duplicar. | Grande |

El tamaño es una estimación comparativa de esta revisión, no un compromiso de horas/días. No se implementaron estas correcciones durante la revisión.

## Pruebas ejecutadas en esta revisión

- Maven: 72 pruebas seleccionadas de planes, altas, permisos, reportes, analítica, cliente Gemini, asistente y auditoría; 0 fallos/errores/omitidas. Predominan pruebas unitarias y mocks, no demuestran SQL real de todos los servicios.
- Node: 30 pruebas de permisos, componentes, SaaS, asistente y acceso de auditoría; todas pasan. Incluyen verificaciones estructurales de fuentes.
- Flutter: la primera ejecución sin pub get falló por dependencias locales ausentes. Después de `flutter pub get`, 31 pruebas pasan. Emiten avisos de plugins de notificación no inicializados en tests; no equivalen a prueba física de notificaciones.
- PostgreSQL: consulta de solo lectura del esquema y reproducción con CTE del efecto de unir dos eventos con dos roles: COUNT devuelve 4 frente a 2 eventos distintos. Es demostración aislada de la forma de consulta, no una medición de actividad real de usuarios.
- Los escenarios de restauración local previamente ejecutados se describen en la wiki de respaldos; no se repitieron aquí.

No se hicieron migraciones, restauraciones, pruebas con datos clínicos enviados a terceros, cambios de código funcional ni despliegues. La preparación de Flutter actualizó dependencias locales, sin cambios versionados de mobile al comprobar git status. Este informe no decide qué tareas de colegas asumir: permite elegir y coordinar con evidencia.
