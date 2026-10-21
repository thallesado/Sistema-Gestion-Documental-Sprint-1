# Auditoría técnica y funcional de NexoDocs

Fecha: 2026-10-14 (America/La_Paz). Base local: main, commit d1a1202.

## Alcance y límites

Revisión manual amplia del código operativo backend, frontend, SQL/migraciones, Compose/Nginx, CI, pruebas y cliente móvil. Se revisaron los documentos CONTEXT, README y matrices de workflows como contexto, sin asumir que sus estados de cumplimiento demuestran funcionamiento actual. No es un pentest, una certificación legal, una prueba exhaustiva de todas las rutas ni una inspección de producción.

No se abrió .env, no se copiaron secretos, no se ejecutaron migraciones ni escrituras en una base existente. El cambio local anterior de infrastructure/docker-compose.yml se preservó. No se hizo commit, push ni despliegue. El único archivo fuente añadido por esta auditoría es este informe; las comprobaciones generan artefactos de compilación ignorados.

Docker Desktop Linux no respondió. No se pudieron ejecutar pruebas SQL aisladas ni API/UI con PostgreSQL. No se arrancó Docker, no se usó EC2 y no se enviaron documentos a Google. No se inspeccionaron grupos de seguridad, TLS, roles PostgreSQL reales, logs ni datos de producción. Los problemas de sesiones/concurrencia y efectos de Nginx están fundamentados en código/documentación y necesitan reproducción aislada.

La habilidad aws-secrets-manager exigida por AGENTS.md no está disponible en las ubicaciones consultadas en esta conversación; por ello no se gestionaron credenciales reales. Las recomendaciones de rotación son pendientes operativos.

## Resultado de las comprobaciones

| Comprobación | Resultado | Alcance |
|---|---|---|
| Maven test | 46 pruebas, 0 fallos, 0 errores | Compilación Java y pruebas existentes, principalmente unitarias/servicio |
| node --test tests/*.test.mjs | 35 pasan, 1 omitida, 0 fallos | Muchas pruebas son análisis de texto; la prueba HTTP se omite sin APP_URL |
| Typecheck Angular | Pasa | Tipos de aplicación |
| Build Angular | Pasa, con avisos CommonJS | Producción SPA; bundle inicial reportado 524.07 kB |
| flutter analyze --no-pub --no-fatal-infos | Sin problemas reportados | Análisis estático |
| flutter test --no-pub | 2 pasan | Widgets de login y shell |
| pnpm audit --json | 46 alertas: 2 críticas, 20 altas, 22 moderadas, 2 bajas | Árbol completo incluyendo herramientas; no demuestra explotabilidad en producción |
| pnpm audit --prod --json | 1 alta, Angular Router SSR | Advisory indica SPA sin SSR no afectada; instalación actual sirve SPA |
| Docker / SQL / API / navegador | No ejecutado | Motor Docker no disponible y sin entorno aislado configurado |

No se hizo escaneo CVE de Maven ni de imágenes. El fin de soporte OSS de Spring Boot 3.2 sí fue verificado con anuncio oficial. Los contadores de auditoría npm son los retornados por el registro durante esta ejecución; no equivalen a 46 vulnerabilidades independientes explotables del sitio.

## Fortalezas verificadas en código

- Contexto tenant derivado de sesión, RLS y claves compuestas en numerosas relaciones; no se encontró una justificación para sustituir estos controles.
- BCrypt, JWT firmado HS256, expiración, refresh con hash y bloqueo pesimista, blacklist persistente de access tokens.
- CORS con orígenes explícitos y autorización de métodos; la protección real no depende solo del menú.
- Versiones con checksum SHA-256, rutas de almacenamiento acotadas y motivos de versión.
- Workflows con controles de asignación/jerarquía, bloqueo de decisión repetida, corrección por nueva versión y eventos inmutables.
- Publicación/versionado de plantillas y no ejecución de scripts/BPMN/paralelismo avanzado: mantener el alcance acordado.
- Migraciones con historial por nombre completo, omisión de seed histórico en runner de actualización y dependencia de backend sobre migrate.
- Lazy loading Angular, sanitización de notas en servidor y pruebas existentes que compilan/pasan.

Estas fortalezas fueron inspeccionadas; no son garantía de todos los controles en producción.

## Criterio de lectura

64 hallazgos/recomendaciones: 29 de prioridad alta, 34 media y 1 baja. Prioridad significa orden recomendado de trabajo, no CVSS ni afirmación de explotación. Comprobado describe una condición del código; Inferencia describe el efecto probable según documentación; Incompleto/Mejora puede requerir decidir alcance antes de implementar. Pendiente operativo requiere inspección del entorno o confirmación externa.

## Seguridad y sesiones

### ND-01. Credencial de aplicación con privilegios de migrador

- **Prioridad:** Alta. **Estado de evidencia:** Inferencia.
- **Evidencia:** Compose reutiliza POSTGRES_USER para DB_USER y para migraciones. El usuario creado por la imagen PostgreSQL normalmente es administrador. SET LOCAL ROLE reduce privilegios en operaciones concretas, pero no sustituye un login de aplicación limitado.
- **Ubicación principal:** [infrastructure/docker-compose.yml](../infrastructure/docker-compose.yml).
- **Qué resolver/verificar:** Separar login de aplicación y migrador; verificar atributos reales del rol y ejecutar pruebas RLS con ese login.
- **Referencia de diseño/control:** [Políticas RLS y roles privilegiados](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).

### ND-02. Errores SQL internos enviados al cliente

- **Prioridad:** Alta. **Estado de evidencia:** Comprobado.
- **Evidencia:** handleDataAccess devuelve exception.getMostSpecificCause().getMessage(). Puede revelar tablas, SQL y detalles internos.
- **Ubicación principal:** [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/exception/GlobalExceptionHandler.java](../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/exception/GlobalExceptionHandler.java).
- **Qué resolver/verificar:** Responder con mensaje genérico y un identificador de incidente; conservar diagnóstico sanitizado en el servidor.
- **Referencia de diseño/control:** [Errores sin exposición de detalles](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html).

### ND-03. HTTPS no configurado en los artefactos revisados

- **Prioridad:** Alta. **Estado de evidencia:** Pendiente operativo.
- **Evidencia:** El Nginx usado por Docker escucha HTTP en 80. No se verificó la configuración actual de TLS en EC2.
- **Ubicación principal:** [infrastructure/docker/nginx.conf](../infrastructure/docker/nginx.conf).
- **Qué resolver/verificar:** Implementar TLS en proxy o servicio de entrada y probar login, API, enlaces y redirección. No basta cambiar la URL.
- **Referencia de diseño/control:** [Ciclo de gestión de registros](https://www.archives.gov/records-mgmt/policy/universalermrequirements).

### ND-04. Sin controles de abuso identificados para autenticación y OCR

- **Prioridad:** Alta. **Estado de evidencia:** Comprobado en repositorio.
- **Evidencia:** No se encontró rate limiting específico para login, recuperación ni consumo de Gemini en las rutas/configuraciones revisadas. Podrían existir controles externos no inspeccionados.
- **Ubicación principal:** [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/config/SecurityConfig.java](../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/config/SecurityConfig.java).
- **Qué resolver/verificar:** Limitar por cuenta/origen/tenant y por concurrencia; comprobar errores 429 y evitar enumeración de usuarios.
- **Referencia de diseño/control:** [Recuperación de contraseña](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

### ND-05. Validación de archivos basada en MIME declarado

- **Prioridad:** Alta. **Estado de evidencia:** Comprobado.
- **Evidencia:** DocumentStorageService valida getContentType(), tamaño y motivo, sin verificar firma binaria o analizar el archivo. Avatar y OCR también requieren una política coherente.
- **Ubicación principal:** [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/DocumentStorageService.java](../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/DocumentStorageService.java).
- **Qué resolver/verificar:** Validar contenido, formatos, límites y nombres; considerar cuarentena/análisis antes de distribuir archivos.
- **Referencia de diseño/control:** [Carga segura de archivos](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).

### ND-06. Rotación de secretos expuestos

- **Prioridad:** Alta. **Estado de evidencia:** Pendiente operativo.
- **Evidencia:** La conversación anterior incluyó una clave de Gemini y una captura con credenciales de base/JWT. No se comprobó su revocación. No se reprodujeron sus valores ni se abrió .env en esta auditoría.
- **Ubicación principal:** [AGENTS.md](../AGENTS.md).
- **Qué resolver/verificar:** Rotar de forma coordinada y comprobar servicios/sesiones; no cambiar solo POSTGRES_PASSWORD en .env esperando que cambie la base existente.
- **Referencia de diseño/control:** [Ciclo de gestión de registros](https://www.archives.gov/records-mgmt/policy/universalermrequirements).

### ND-07. Token de acceso no asociado a una sesión concreta

- **Prioridad:** Alta. **Estado de evidencia:** Inferencia.
- **Evidencia:** isRevoked comprueba blacklist del token y que el usuario tenga alguna sesión activa. El JWT no identifica la sesión. Un token antiguo no listado podría volver a admitirse si se crea otra sesión después de revokeAll, antes de expirar.
- **Ubicación principal:** [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/AccessTokenRevocationService.java](../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/AccessTokenRevocationService.java).
- **Qué resolver/verificar:** Vincular token a sesión o época de revocación. Probar: revocar todas, volver a iniciar sesión, rechazar access token anterior.
- **Referencia de diseño/control:** [Sesiones y expiración](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

### ND-08. Revocación por reutilización de refresh puede revertirse

- **Prioridad:** Alta. **Estado de evidencia:** Inferencia.
- **Evidencia:** AuthSessionService.rotate llama revokeAllByUserId y luego lanza InvalidCredentialsException dentro de @Transactional. La excepción es RuntimeException: el rollback predeterminado puede deshacer la revocación.
- **Ubicación principal:** [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/AuthSessionService.java](../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/AuthSessionService.java).
- **Qué resolver/verificar:** Persistir la revocación de forma independiente o ajustar el límite transaccional. Confirmar con prueba de integración, no con mocks.
- **Referencia de diseño/control:** [Rollback de transacciones](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/rolling-back.html).

### ND-09. Cambio de contraseña desde perfil no revoca sesiones

- **Prioridad:** Alta. **Estado de evidencia:** Comprobado.
- **Evidencia:** changeCurrentPassword verifica y guarda la contraseña, sin invocar revocación de sesiones.
- **Ubicación principal:** [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/UserService.java](../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/UserService.java).
- **Qué resolver/verificar:** Definir qué sesiones sobreviven y revocar las demás de forma consistente con recuperación y gestión de roles.
- **Referencia de diseño/control:** [Sesiones y expiración](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

### ND-10. Logout por inactividad pierde Authorization antes de enviar

- **Prioridad:** Alta. **Estado de evidencia:** Inferencia.
- **Evidencia:** logoutForInactivity limpia sessionStorage antes de suscribirse al POST; el interceptor obtiene el token desde ese almacenamiento. La solicitud puede salir sin Bearer y no revocar la sesión remota.
- **Ubicación principal:** [frontend/src/app/core/auth/auth.service.ts](../frontend/src/app/core/auth/auth.service.ts).
- **Qué resolver/verificar:** Adjuntar explícitamente el token capturado o completar revocación antes de limpiar. Probar la petición real y el estado de la sesión.
- **Referencia de diseño/control:** [Sesiones y expiración](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

### ND-11. Recuperación de contraseña sin consumo concurrente protegido

- **Prioridad:** Alta. **Estado de evidencia:** Inferencia.
- **Evidencia:** findByTokenHashAndUsedAtIsNull no tiene bloqueo ni consumo condicional. Dos solicitudes simultáneas podrían leer el mismo token válido.
- **Ubicación principal:** [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/repository/PasswordRecoveryRequestRepository.java](../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/repository/PasswordRecoveryRequestRepository.java).
- **Qué resolver/verificar:** Consumir de forma atómica o bloquear; probar que solo un reset concurrente tenga éxito.
- **Referencia de diseño/control:** [Recuperación de contraseña](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

### ND-12. IP de auditoría depende de una cabecera no confiable

- **Prioridad:** Media. **Estado de evidencia:** Inferencia.
- **Evidencia:** HttpAuditInterceptor usa X-Forwarded-For si está presente. El Nginx activo no establece la política de proxies confiables y el backend se publica por un puerto propio.
- **Ubicación principal:** [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/config/HttpAuditInterceptor.java](../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/config/HttpAuditInterceptor.java).
- **Qué resolver/verificar:** Definir proxies confiables, establecer cabeceras en el proxy y limitar acceso directo; comprobar que un cliente no pueda falsear la IP.
- **Referencia de diseño/control:** [Logs y datos sensibles](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).

## Infraestructura, dependencias y recuperación

### ND-13. Dependencias con alertas y Spring Boot sin soporte OSS

- **Prioridad:** Alta. **Estado de evidencia:** Verificado por herramienta.
- **Evidencia:** pnpm audit: 2 críticas, 20 altas, 22 moderadas y 2 bajas en el árbol completo. --prod: una alta de Angular Router condicionada a SSR. El advisory oficial indica que las SPA sin SSR no están afectadas; NexoDocs sirve una SPA. Spring Boot es 3.2.12, rama fuera de soporte open source.
- **Ubicación principal:** [backend/pom.xml](../backend/pom.xml).
- **Qué resolver/verificar:** Actualizar por compatibilidad y exposición; separar tooling/runtime. No aplicar audit fix indiscriminadamente. Escaneo Java e imágenes pendiente.
- **Referencia de diseño/control:** [Aviso oficial: fin soporte OSS Spring Boot 3.2](https://spring.io/blog/2024/11/21/spring-boot-3-2-12-available-now/).

### ND-14. Nginx y backend tienen límites de carga incompatibles

- **Prioridad:** Alta. **Estado de evidencia:** Inferencia.
- **Evidencia:** Backend admite 25 MB; Nginx usado por Docker no configura client_max_body_size. Su valor predeterminado documentado es 1m. Una carga permitida por Java puede recibir 413 antes de llegar a él.
- **Ubicación principal:** [infrastructure/docker/nginx.conf](../infrastructure/docker/nginx.conf).
- **Qué resolver/verificar:** Alinear límite de proxy/multipart/aplicación y probar archivo >1 MB y archivo que exceda el límite definitivo.
- **Referencia de diseño/control:** [Límite de cuerpo en Nginx](https://nginx.org/en/docs/http/ngx_http_core_module.html#client_max_body_size).

### ND-15. Readiness de backend/frontend no comprobada

- **Prioridad:** Media. **Estado de evidencia:** Comprobado.
- **Evidencia:** Compose tiene healthcheck de PostgreSQL y finalización de migrate, pero no healthcheck del backend/frontend. Started no confirma que login o API respondan.
- **Ubicación principal:** [infrastructure/docker-compose.yml](../infrastructure/docker-compose.yml).
- **Qué resolver/verificar:** Agregar comprobaciones de disponibilidad y smoke test posterior al despliegue.
- **Referencia de diseño/control:** [Disponibilidad y dependencias Compose](https://docs.docker.com/reference/compose-file/services/).

### ND-16. Dos mecanismos modifican el esquema

- **Prioridad:** Alta. **Estado de evidencia:** Comprobado.
- **Evidencia:** application.yml mantiene ddl-auto: update; producción no lo reemplaza. Migraciones SQL y Hibernate pueden alterar el esquema por vías distintas.
- **Ubicación principal:** [backend/bootstrap/src/main/resources/application.yml](../backend/bootstrap/src/main/resources/application.yml).
- **Qué resolver/verificar:** Usar validación del esquema en producción después de reconciliar entidades/migraciones, con respaldo e inspección previos.
- **Referencia de diseño/control:** [Inicialización de esquema, Spring Boot 3.2.12](https://docs.spring.io/spring-boot/docs/3.2.12/reference/html/howto.html#howto.data-initialization).

### ND-17. Respaldo de base no incluye archivos documentales

- **Prioridad:** Alta. **Estado de evidencia:** Comprobado.
- **Evidencia:** Compose separa volumen de PostgreSQL y nexodocs_document_storage. pg_dump no incluye esos archivos. Esta sesión no creó respaldos ni probó restauraciones.
- **Ubicación principal:** [infrastructure/docker-compose.yml](../infrastructure/docker-compose.yml).
- **Qué resolver/verificar:** Respaldar base, archivos y configuración; ensayar restauración y comprobar versiones/checksums.
- **Referencia de diseño/control:** [Respaldo PostgreSQL](https://www.postgresql.org/docs/17/app-pgdump.html).

### ND-18. Configuración Gemini del servidor no reproducida en Compose base

- **Prioridad:** Media. **Estado de evidencia:** Comprobado.
- **Evidencia:** application.yml lee GEMINI_*, pero Compose versionado no las entrega. El despliegue de la conversación usa un override externo.
- **Ubicación principal:** [infrastructure/docker-compose.yml](../infrastructure/docker-compose.yml).
- **Qué resolver/verificar:** Versionar referencias sin secretos y documentar el override/configuración persistente; desplegar desde un procedimiento único.
- **Referencia de diseño/control:** [Ciclo de gestión de registros](https://www.archives.gov/records-mgmt/policy/universalermrequirements).

### ND-19. Runner de migraciones sin comprobación de contenido aplicado

- **Prioridad:** Media. **Estado de evidencia:** Comprobado.
- **Evidencia:** migrate.sh reconoce versiones por nombre completo; no verifica checksum del SQL ya aplicado. Prefijos repetidos no equivalen por sí mismos a una colisión.
- **Ubicación principal:** [infrastructure/docker/migrate.sh](../infrastructure/docker/migrate.sh).
- **Qué resolver/verificar:** Mantener migraciones aplicadas inmutables y registrar checksums o adoptar un runner que los verifique.
- **Referencia de diseño/control:** [Ciclo de gestión de registros](https://www.archives.gov/records-mgmt/policy/universalermrequirements).

### ND-20. Semillas demo en instalación nueva

- **Prioridad:** Alta. **Estado de evidencia:** Comprobado.
- **Evidencia:** El volumen vacío monta database/init, incluidos SQL históricos de demo. El runner de actualización omite 001-003, pero inicialización de PostgreSQL no.
- **Ubicación principal:** [infrastructure/docker-compose.yml](../infrastructure/docker-compose.yml).
- **Qué resolver/verificar:** Separar instalación productiva de datos de demostración, conservando compatibilidad de bases existentes.
- **Referencia de diseño/control:** [Ciclo de gestión de registros](https://www.archives.gov/records-mgmt/policy/universalermrequirements).

## Digitalización y OCR

### ND-21. OCR confirma/indexa sin guardar

- **Prioridad:** Alta. **Estado de evidencia:** Comprobado.
- **Evidencia:** validateOcr, indexOcr y correctMetadata solo actualizan signals/navegan; no persisten archivo, documento, revisión ni asociación.
- **Ubicación principal:** [frontend/src/app/features/tablero/pages/espacio-trabajo-page.ts](../frontend/src/app/features/tablero/pages/espacio-trabajo-page.ts).
- **Qué resolver/verificar:** Completar persistencia y confirmar éxito solo después de recibir identificadores duraderos del servidor.
- **Referencia de diseño/control:** [Ciclo de gestión de registros](https://www.archives.gov/records-mgmt/policy/universalermrequirements).

### ND-22. Fallback OCR confundido con resultado exitoso

- **Prioridad:** Alta. **Estado de evidencia:** Comprobado.
- **Evidencia:** OcrController devuelve 200 para fallback. OcrApiService trata cualquier resultado como REQUIRES_VALIDATION y la UI usa la presencia de ocrData para anunciar extracción completada.
- **Ubicación principal:** [frontend/src/app/core/api/ocr-api.service.ts](../frontend/src/app/core/api/ocr-api.service.ts).
- **Qué resolver/verificar:** Representar éxito/error/procesamiento de forma explícita y bloquear indexación de extracciones fallidas.
- **Referencia de diseño/control:** [Ciclo de gestión de registros](https://www.archives.gov/records-mgmt/policy/universalermrequirements).

### ND-23. Timeout OCR acumulado puede superar al proxy

- **Prioridad:** Media. **Estado de evidencia:** Comprobado.
- **Evidencia:** OcrService intenta tres candidatos secuenciales con timeout por intento; el candidato configurado puede repetirse. La duración total puede exceder los 60s predeterminados del proxy.
- **Ubicación principal:** [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/OcrService.java](../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/OcrService.java).
- **Qué resolver/verificar:** Deduplicar candidatos, definir plazo total y reintentos según error; valorar trabajo asíncrono con estado persistente.
- **Referencia de diseño/control:** [Timeout de proxy Nginx](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_read_timeout).

### ND-24. Salida de IA y confianza sin validación suficiente

- **Prioridad:** Alta. **Estado de evidencia:** Comprobado.
- **Evidencia:** parseGeminiResponse confía en JSON y campos como confidence y documentType, e incluso asigna confianza por defecto; no equivale a precisión medida.
- **Ubicación principal:** [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/OcrService.java](../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/OcrService.java).
- **Qué resolver/verificar:** Validar esquema/valores, identificar incertidumbre y separar extracción de dato aprobado por un humano.
- **Referencia de diseño/control:** [Ciclo de gestión de registros](https://www.archives.gov/records-mgmt/policy/universalermrequirements).

### ND-25. OCR especializado exclusivamente en contenido clínico

- **Prioridad:** Media. **Estado de evidencia:** Comprobado.
- **Evidencia:** El prompt y clases de documentos se centran en informes, laboratorio, recetas y consentimiento.
- **Ubicación principal:** [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/OcrService.java](../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/OcrService.java).
- **Qué resolver/verificar:** Configurar extracción por tipo/tenant; conservar extracción general y habilitar el perfil clínico solo cuando corresponda.
- **Referencia de diseño/control:** [Ciclo de gestión de registros](https://www.archives.gov/records-mgmt/policy/universalermrequirements).

### ND-26. Documentos completos enviados a un proveedor externo

- **Prioridad:** Alta. **Estado de evidencia:** Pendiente de gobierno de datos.
- **Evidencia:** OcrService envía bytes completos a Google y registra cuerpos de respuestas de error. No se auditó la cuenta, condiciones contratadas ni controles externos.
- **Ubicación principal:** [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/OcrService.java](../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/OcrService.java).
- **Qué resolver/verificar:** Definir autorización, minimización, clasificación, logs y condiciones de proveedor; probar con documentos ficticios hasta resolver el uso de datos sensibles.
- **Referencia de diseño/control:** [Condiciones de tratamiento de datos Gemini](https://ai.google.dev/gemini-api/terms).

## Gestión documental y adaptación a tenants

### ND-27. metadataSchema no aplicado al alta documental

- **Prioridad:** Alta. **Estado de evidencia:** Comprobado.
- **Evidencia:** DocumentTypeService almacena el esquema; DocumentService guarda metadata sin validar contra él. El formulario común no genera los campos del esquema.
- **Ubicación principal:** [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/DocumentService.java](../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/DocumentService.java).
- **Qué resolver/verificar:** Crear formulario configurable y validación de servidor por tipo, incluyendo obligatoriedad y catálogos.
- **Referencia de diseño/control:** [Tipos documentales, metadatos y workflows](https://learn.microsoft.com/en-us/sharepoint/governance/content-type-and-workflow-planning).

### ND-28. Workflow configurado por tipo sin integración de inicio

- **Prioridad:** Media. **Estado de evidencia:** Comprobado.
- **Evidencia:** workflowTemplateId se almacena en tipo documental, pero el alta no lo aplica ni propone desde esa configuración.
- **Ubicación principal:** [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/DocumentTypeService.java](../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/DocumentTypeService.java).
- **Qué resolver/verificar:** Definir modo opcional/obligatorio, proponer plantilla válida y mantener inicio autorizado en servidor.
- **Referencia de diseño/control:** [Tipos documentales, metadatos y workflows](https://learn.microsoft.com/en-us/sharepoint/governance/content-type-and-workflow-planning).

### ND-29. Política de conservación sin ciclo operativo

- **Prioridad:** Alta. **Estado de evidencia:** Incompleto.
- **Evidencia:** retentionPolicyId existe; no se encontró servicio de cálculo/revisión de conservación y disposición en el código operativo revisado.
- **Ubicación principal:** [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/DocumentTypeService.java](../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/DocumentTypeService.java).
- **Qué resolver/verificar:** Definir evento de inicio, plazos, revisión y bloqueo de disposición; no comenzar con borrado automático.
- **Referencia de diseño/control:** [Tipos documentales, metadatos y workflows](https://learn.microsoft.com/en-us/sharepoint/governance/content-type-and-workflow-planning).

### ND-30. Edición general de metadatos documental sin endpoint

- **Prioridad:** Media. **Estado de evidencia:** Comprobado.
- **Evidencia:** DocumentController tiene alta, estado, versiones y consultas; no actualización general de metadatos.
- **Ubicación principal:** [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/controller/DocumentController.java](../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/controller/DocumentController.java).
- **Qué resolver/verificar:** Agregar cambios autorizados y auditados con concurrencia y control de impactos en workflows.
- **Referencia de diseño/control:** [Tipos documentales, metadatos y workflows](https://learn.microsoft.com/en-us/sharepoint/governance/content-type-and-workflow-planning).

### ND-31. Papelera sin restauración

- **Prioridad:** Media. **Estado de evidencia:** Comprobado.
- **Evidencia:** TRASHED no tiene transiciones de salida en DocumentService y UI. Existe vista, pero no recuperación del documento.
- **Ubicación principal:** [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/DocumentService.java](../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/DocumentService.java).
- **Qué resolver/verificar:** Distinguir papelera/anulación/archivado; restaurar conservando identidad, versiones y motivo.
- **Referencia de diseño/control:** [Tipos documentales, metadatos y workflows](https://learn.microsoft.com/en-us/sharepoint/governance/content-type-and-workflow-planning).

### ND-32. Fallo de carga inicial se comunica como creación parcial

- **Prioridad:** Media. **Estado de evidencia:** Comprobado.
- **Evidencia:** Alta de registro y archivo son peticiones separadas. Si falla la segunda, navega a Documentos y muestra que puede cargarse luego.
- **Ubicación principal:** [frontend/src/app/features/documentos/pages/documentos-page.ts](../frontend/src/app/features/documentos/pages/documentos-page.ts).
- **Qué resolver/verificar:** Mostrar estado Sin archivo/Pendiente de carga y reintento; prevenir duplicación del registro al repetir la operación.
- **Referencia de diseño/control:** [Tipos documentales, metadatos y workflows](https://learn.microsoft.com/en-us/sharepoint/governance/content-type-and-workflow-planning).

### ND-33. Compartidos no representa una concesión de acceso

- **Prioridad:** Alta. **Estado de evidencia:** Incompleto.
- **Evidencia:** searchShared filtra autor distinto, sin tabla o decisión de compartición explícita. No es evidencia de acceso entre tenants.
- **Ubicación principal:** [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/repository/DocumentRepository.java](../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/repository/DocumentRepository.java).
- **Qué resolver/verificar:** Renombrar según alcance real o implementar permisos por recurso/grupo, aplicados también a descarga/búsqueda.
- **Referencia de diseño/control:** [Tipos documentales, metadatos y workflows](https://learn.microsoft.com/en-us/sharepoint/governance/content-type-and-workflow-planning).

### ND-34. Expediente no muestra sus documentos reales

- **Prioridad:** Media. **Estado de evidencia:** Incompleto.
- **Evidencia:** Detalle extrae información de un texto y Ver documentos navega al listado general sin contexto del expediente. toExpedient muestra area='General' independientemente de departmentId.
- **Ubicación principal:** [frontend/src/app/features/expedientes/pages/expedientes-page.html](../frontend/src/app/features/expedientes/pages/expedientes-page.html).
- **Qué resolver/verificar:** Consultar por expedientId, presentar documentos/versiones/counts reales y permitir incorporación autorizada.
- **Referencia de diseño/control:** [Tipos documentales, metadatos y workflows](https://learn.microsoft.com/en-us/sharepoint/governance/content-type-and-workflow-planning).

### ND-35. Cierre de expediente sin verificar integridad documental

- **Prioridad:** Media. **Estado de evidencia:** Incompleto.
- **Evidencia:** updateStatus permite estados y timestamps, pero no comprueba requisitos ni procesos pendientes; alta de documentos no revisa cierre del expediente.
- **Ubicación principal:** [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/ExpedientService.java](../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/ExpedientService.java).
- **Qué resolver/verificar:** Definir requisitos por tipo y reglas de cierre/reapertura/incorporación tardía; no asumir que todos los rubros exigen lo mismo.
- **Referencia de diseño/control:** [Tipos documentales, metadatos y workflows](https://learn.microsoft.com/en-us/sharepoint/governance/content-type-and-workflow-planning).

### ND-36. Filtros aplicados solo sobre la página cargada

- **Prioridad:** Media. **Estado de evidencia:** Comprobado.
- **Evidencia:** Documentos aplica varios filtros locales después de obtener una página; expedientes calcula activos sobre los registros cargados.
- **Ubicación principal:** [frontend/src/app/features/documentos/pages/documentos-page.ts](../frontend/src/app/features/documentos/pages/documentos-page.ts).
- **Qué resolver/verificar:** Mover filtros y agregados globales al backend o etiquetarlos como métricas de página; probar coincidencias fuera de primera página.
- **Referencia de diseño/control:** [Tipos documentales, metadatos y workflows](https://learn.microsoft.com/en-us/sharepoint/governance/content-type-and-workflow-planning).

### ND-37. Buscador superior no es búsqueda transversal

- **Prioridad:** Media. **Estado de evidencia:** Incompleto.
- **Evidencia:** onGlobalSearch redirige a listados según URL. La rama /patients no coincide con /clinical/patients. Las consultas no buscan el texto OCR.
- **Ubicación principal:** [frontend/src/app/shell/app.ts](../frontend/src/app/shell/app.ts).
- **Qué resolver/verificar:** Corregir rutas y alcance; agregar búsqueda indexada sobre contenido persistido y metadatos, con permisos.
- **Referencia de diseño/control:** [Tipos documentales, metadatos y workflows](https://learn.microsoft.com/en-us/sharepoint/governance/content-type-and-workflow-planning).

### ND-38. Catálogos sanitarios fijos en módulo común

- **Prioridad:** Media. **Estado de evidencia:** Comprobado.
- **Evidencia:** specialties/processes devuelven listas globales y el formulario carga pacientes incluso fuera del contexto clínico.
- **Ubicación principal:** [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/DocumentService.java](../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/DocumentService.java).
- **Qué resolver/verificar:** Catálogos propios del tenant y campos por capacidad/tipo; evitar cargar entidades de extensiones no habilitadas.
- **Referencia de diseño/control:** [Tipos documentales, metadatos y workflows](https://learn.microsoft.com/en-us/sharepoint/governance/content-type-and-workflow-planning).

### ND-39. Capacidades de tenant no uniformes en todo el sistema

- **Prioridad:** Media. **Estado de evidencia:** Incompleto.
- **Evidencia:** Workflows verifica clinical_module, pero menú/rutas generales usan roles, autenticación y sprintEnabled. No se identificó gate de capacidad homogéneo.
- **Ubicación principal:** [frontend/src/app/core/routes/app.routes.ts](../frontend/src/app/core/routes/app.routes.ts).
- **Qué resolver/verificar:** Centralizar capacidades por tenant en frontend y backend. Probar tenant clínico y tenant no clínico.
- **Referencia de diseño/control:** [Tipos documentales, metadatos y workflows](https://learn.microsoft.com/en-us/sharepoint/governance/content-type-and-workflow-planning).

### ND-40. Cuotas y formatos por tenant sin control operativo identificado

- **Prioridad:** Media. **Estado de evidencia:** Incompleto.
- **Evidencia:** Se encontraron estructuras de planes; DocumentStorageService aplica tamaño fijo por archivo, sin consumo/limitación por tenant en el método revisado.
- **Ubicación principal:** [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/DocumentStorageService.java](../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/DocumentStorageService.java).
- **Qué resolver/verificar:** Si hay planes con límites, hacer reserva/medición atómica de consumo y avisos. Ampliar formatos solo con validaciones seguras.
- **Referencia de diseño/control:** [Tipos documentales, metadatos y workflows](https://learn.microsoft.com/en-us/sharepoint/governance/content-type-and-workflow-planning).

## Workflows

### ND-41. Guardar borrador desactiva plantilla publicada anterior

- **Prioridad:** Alta. **Estado de evidencia:** Comprobado.
- **Evidencia:** saveTemplate desactiva versiones activas de la familia siempre que oldId no sea null, incluso si nueva publicación es DRAFT.
- **Ubicación principal:** [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/WorkflowEngineService.java](../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/WorkflowEngineService.java).
- **Qué resolver/verificar:** Desactivar la versión anterior al publicar el reemplazo. Probar que editar un borrador no interrumpa nuevos inicios con la publicada.
- **Referencia de diseño/control:** [Ciclo de gestión de registros](https://www.archives.gov/records-mgmt/policy/universalermrequirements).

### ND-42. Ventanas de vencimiento no uniformes

- **Prioridad:** Media. **Estado de evidencia:** Comprobado.
- **Evidencia:** Filtro dueSoon usa 3 días; widget del resumen usa 24 horas. Una etiqueta similar representa distintos conjuntos.
- **Ubicación principal:** [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/WorkflowEngineService.java](../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/WorkflowEngineService.java).
- **Qué resolver/verificar:** Unificar definición o etiquetar ventanas explícitamente y probar frontera de fechas.
- **Referencia de diseño/control:** [Ciclo de gestión de registros](https://www.archives.gov/records-mgmt/policy/universalermrequirements).

### ND-43. Preferencias de correo/push no corresponden a canales de workflow

- **Prioridad:** Media. **Estado de evidencia:** Incompleto.
- **Evidencia:** Perfil persiste preferencias; notificaciones de workflows de esta fase son IN_APP. Correo de recuperación sí es otro flujo.
- **Ubicación principal:** [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/UserService.java](../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/UserService.java).
- **Qué resolver/verificar:** Mostrar capacidades reales y separar preferencias por canal/uso. Implementar envíos solo cuando se incorpore el canal.
- **Referencia de diseño/control:** [Ciclo de gestión de registros](https://www.archives.gov/records-mgmt/policy/universalermrequirements).

### ND-44. Motor de workflow concentra responsabilidades

- **Prioridad:** Media. **Estado de evidencia:** Mejora.
- **Evidencia:** WorkflowEngineService concentra SQL, autorización, asignación, plantillas, métricas y transiciones en más de 900 líneas.
- **Ubicación principal:** [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/WorkflowEngineService.java](../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/WorkflowEngineService.java).
- **Qué resolver/verificar:** Extraer responsabilidades gradualmente con pruebas de comportamiento; no introducir otro motor ni ampliar BPMN/paralelismo.
- **Referencia de diseño/control:** [Ciclo de gestión de registros](https://www.archives.gov/records-mgmt/policy/universalermrequirements).

## Extensión clínica

### ND-45. Asociación clínica puede contradecir el paciente del documento

- **Prioridad:** Alta. **Estado de evidencia:** Comprobado.
- **Evidencia:** linkDocument comprueba tenant pero no que documents.patient_id coincida. Selector ofrece documentos sin filtrar por paciente. FKs no cruzan ese campo con el vínculo.
- **Ubicación principal:** [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/ClinicalHistoryService.java](../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/ClinicalHistoryService.java).
- **Qué resolver/verificar:** Definir asociación única/múltiple y rechazar incompatibilidad; armonizar alta documental y clinical_document_links.
- **Referencia de diseño/control:** [Estado y contexto de documentos clínicos, FHIR R4](https://hl7.org/fhir/R4/documentreference.html).

### ND-46. Notas admiten estado inicial aprobado y mensaje de firma

- **Prioridad:** Alta. **Estado de evidencia:** Comprobado.
- **Evidencia:** MedicalNoteService acepta status inicial; crear exige medical_note:create. UI inicia APPROVED y comunica firmado, sin operación de firma separada.
- **Ubicación principal:** [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/MedicalNoteService.java](../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/MedicalNoteService.java).
- **Qué resolver/verificar:** Definir finalización por autor/revisión y verificar capacidad de cada acción; no equiparar etiqueta a firma electrónica.
- **Referencia de diseño/control:** [Estado y contexto de documentos clínicos, FHIR R4](https://hl7.org/fhir/R4/documentreference.html).

### ND-47. Cronología y resumen pierden validez de notas

- **Prioridad:** Alta. **Estado de evidencia:** Comprobado.
- **Evidencia:** timeline fija RECORDED; resumen toma cinco notas recientes sin filtrar estado ni devolverlo. Borradores/anuladas pueden aparecer sin esa distinción.
- **Ubicación principal:** [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/PatientQuickSummaryService.java](../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/PatientQuickSummaryService.java).
- **Qué resolver/verificar:** Mostrar estado real, conservar anuladas identificadas y definir qué notas alimentan resumen vigente.
- **Referencia de diseño/control:** [Estado y contexto de documentos clínicos, FHIR R4](https://hl7.org/fhir/R4/documentreference.html).

### ND-48. Baja lógica clínica aplicada de forma desigual

- **Prioridad:** Media. **Estado de evidencia:** Comprobado.
- **Evidencia:** Listados excluyen deleted_at; resumen y requireHistory de notas usan consultas sin ese filtro. Unicidad por paciente persiste tras baja.
- **Ubicación principal:** [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/repository/ClinicalHistoryRepository.java](../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/repository/ClinicalHistoryRepository.java).
- **Qué resolver/verificar:** Definir lectura/escritura/restauración de historias dadas de baja y probar el ciclo completo.
- **Referencia de diseño/control:** [Estado y contexto de documentos clínicos, FHIR R4](https://hl7.org/fhir/R4/documentreference.html).

### ND-49. Episodios representados pero sin ciclo de gestión encontrado

- **Prioridad:** Media. **Estado de evidencia:** Incompleto.
- **Evidencia:** ClinicalEpisode y consulta cronológica existen; no se identificó servicio/controlador operativo de apertura/cierre de episodios.
- **Ubicación principal:** [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/model/ClinicalEpisode.java](../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/model/ClinicalEpisode.java).
- **Qué resolver/verificar:** Mantenerlo como extensión opcional; implementar solo si se necesita contexto de atención, no volver obligatorio un HIS.
- **Referencia de diseño/control:** [Estado y contexto de documentos clínicos, FHIR R4](https://hl7.org/fhir/R4/documentreference.html).

## Interfaz, reportes y móvil

### ND-50. Errores de carga de catálogos ocultados

- **Prioridad:** Media. **Estado de evidencia:** Incompleto.
- **Evidencia:** Documentos y otras pantallas tienen callbacks error vacíos o conservan listas vacías. Falta distinguir catálogo vacío, permiso denegado y fallo de API.
- **Ubicación principal:** [frontend/src/app/features/documentos/pages/documentos-page.ts](../frontend/src/app/features/documentos/pages/documentos-page.ts).
- **Qué resolver/verificar:** Mostrar estado y reintento; impedir acciones que dependan de datos no cargados.
- **Referencia de diseño/control:** [Ciclo de gestión de registros](https://www.archives.gov/records-mgmt/policy/universalermrequirements).

### ND-51. Reportes siguen usando datos simulados

- **Prioridad:** Media. **Estado de evidencia:** Comprobado.
- **Evidencia:** ReportsPage importa report-data y DemoSessionState; indica explícitamente que filtros/exportaciones son locales sin PostgreSQL.
- **Ubicación principal:** [frontend/src/app/features/reportes/pages/reportes-page.ts](../frontend/src/app/features/reportes/pages/reportes-page.ts).
- **Qué resolver/verificar:** Conectar reportes reales del tenant o identificar módulo como demostración; no usarlo para decisiones ni cumplimiento.
- **Referencia de diseño/control:** [Ciclo de gestión de registros](https://www.archives.gov/records-mgmt/policy/universalermrequirements).

### ND-52. Accesibilidad de modales no verificada de punta a punta

- **Prioridad:** Media. **Estado de evidencia:** Mejora pendiente de prueba.
- **Evidencia:** Hay role=dialog y algunas acciones Escape, pero no se identificó mecanismo uniforme de captura/restauración de foco. No se ejecutó auditoría de navegador/lector de pantalla.
- **Ubicación principal:** [frontend/src/app/shell/app.html](../frontend/src/app/shell/app.html).
- **Qué resolver/verificar:** Probar teclado, foco, etiquetas, errores, contraste y móvil con WCAG/APG; corregir por evidencia.
- **Referencia de diseño/control:** [Accesibilidad de diálogos](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

### ND-53. Mocks móviles ocultan fallos reales

- **Prioridad:** Media. **Estado de evidencia:** Comprobado.
- **Evidencia:** AuthApi.dashboard y documents capturan errores y devuelven usuarios/documentos demo. Un fallo de autorización o red puede verse como información válida.
- **Ubicación principal:** [mobile/lib/core/api/auth_api.dart](../mobile/lib/core/api/auth_api.dart).
- **Qué resolver/verificar:** Eliminar fallback en modo real o separarlo en modo demo explícito; mostrar error/reintento.
- **Referencia de diseño/control:** [Ciclo de gestión de registros](https://www.archives.gov/records-mgmt/policy/universalermrequirements).

### ND-54. Contrato móvil divergente y logout solo local

- **Prioridad:** Media. **Estado de evidencia:** Comprobado.
- **Evidencia:** documents envía search cuando backend espera filter; logout borra storage sin revocar servidor. _get no implementa refresh y configuración incluye fallback HTTP/IP local.
- **Ubicación principal:** [mobile/lib/core/api/auth_api.dart](../mobile/lib/core/api/auth_api.dart).
- **Qué resolver/verificar:** Unificar contratos/configuración por entorno, renovación y logout remoto; probar contra API aislada.
- **Referencia de diseño/control:** [Ciclo de gestión de registros](https://www.archives.gov/records-mgmt/policy/universalermrequirements).

### ND-55. Pérdida de cambios y estado de formularios

- **Prioridad:** Media. **Estado de evidencia:** Mejora.
- **Evidencia:** Diseñador tiene aviso de salida, pero no se identificó una política uniforme para documentos, antecedentes y notas; requiere prueba de recorridos.
- **Ubicación principal:** [frontend/src/app/features/clinico/pages/antecedentes-page.ts](../frontend/src/app/features/clinico/pages/antecedentes-page.ts).
- **Qué resolver/verificar:** Aplicar aviso o borrador donde corresponda y resolver errores conservando entrada del usuario.
- **Referencia de diseño/control:** [Ciclo de gestión de registros](https://www.archives.gov/records-mgmt/policy/universalermrequirements).

## Pruebas, arquitectura y operación

### ND-56. Pruebas de frontend no verifican persistencia ni autorización

- **Prioridad:** Alta. **Estado de evidencia:** Comprobado.
- **Evidencia:** 36 pruebas de node: 35 pasan y 1 omitida; muchas leen archivos y hacen assert.match. Pueden pasar aunque un botón no guarde nada.
- **Ubicación principal:** [frontend/tests/ocr.test.mjs](../frontend/tests/ocr.test.mjs).
- **Qué resolver/verificar:** Añadir pruebas de comportamiento del flujo documental y API, conservando las estructurales como complemento.
- **Referencia de diseño/control:** [Autorización y aislamiento](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

### ND-57. Cobertura de integración de auth/RLS/workflows no ejecutada

- **Prioridad:** Alta. **Estado de evidencia:** Incompleto.
- **Evidencia:** Maven ejecutó 46 pruebas unitarias/servicio. No se ejecutaron scripts API/UI ni validaciones SQL por falta de Docker activo y entorno aislado.
- **Ubicación principal:** [scripts/test-workflows.ps1](../scripts/test-workflows.ps1).
- **Qué resolver/verificar:** Crear pipeline aislado que pruebe tenant, roles, versiones, doble decisión, corrección, sesiones y migraciones.
- **Referencia de diseño/control:** [Autorización y aislamiento](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

### ND-58. Frontend CI no ejecuta pnpm test y cambia resolución

- **Prioridad:** Media. **Estado de evidencia:** Comprobado.
- **Evidencia:** Workflow frontend-ci instala con --no-frozen-lockfile y compila, sin paso de pruebas. Docker sí ejecuta pnpm test.
- **Ubicación principal:** [.github/workflows/frontend-ci.yml](../.github/workflows/frontend-ci.yml).
- **Qué resolver/verificar:** Usar lockfile reproducible y ejecutar tests/typecheck/build en PR; alinear CI y Docker.
- **Referencia de diseño/control:** [Autorización y aislamiento](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

### ND-59. Versiones de herramientas no coherentes

- **Prioridad:** Media. **Estado de evidencia:** Comprobado.
- **Evidencia:** Raíz declara pnpm 9.15.0; frontend declara 12.3.4; CI instala 9; Docker instala pnpm global sin fijar versión. Imágenes usan tags móviles.
- **Ubicación principal:** [frontend/package.json](../frontend/package.json).
- **Qué resolver/verificar:** Fijar versión común, revisar lockfile y mantener política de actualización de imágenes/Flutter.
- **Referencia de diseño/control:** [Autorización y aislamiento](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

### ND-60. Documentación sobre arquitectura y entorno desactualizada

- **Prioridad:** Media. **Estado de evidencia:** Comprobado.
- **Evidencia:** README describe backend hexagonal y Flutter BLoC/GetIt; módulos funcionales siguen en bootstrap y pantallas móviles planas. proxy frontend apunta 8085 frente a defaults backend 8080.
- **Ubicación principal:** [README.md](../README.md).
- **Qué resolver/verificar:** Documentar arquitectura real, perfiles/puertos y comandos correctos de Compose sin exigir reescritura arquitectónica.
- **Referencia de diseño/control:** [Autorización y aislamiento](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

### ND-61. Consultas repetidas y listas completas pueden limitar escalabilidad

- **Prioridad:** Media. **Estado de evidencia:** Mejora.
- **Evidencia:** toResponse de documentos consulta catálogos/usuarios por registro; timeline carga listas completas y busca profesional por elemento antes de filtrar.
- **Ubicación principal:** [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/DocumentService.java](../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/DocumentService.java).
- **Qué resolver/verificar:** Medir consultas/latencia, usar proyecciones/batches y paginación/filtros SQL; no optimizar sin medición.
- **Referencia de diseño/control:** [Autorización y aislamiento](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

### ND-62. Observabilidad y control de despliegue incompletos

- **Prioridad:** Media. **Estado de evidencia:** Mejora.
- **Evidencia:** No se identificó pipeline CD, smoke test o medición de salud/capacidad. Scheduler captura fallos en logs sin señal de disponibilidad funcional.
- **Ubicación principal:** [.github/workflows/backend-ci.yml](../.github/workflows/backend-ci.yml).
- **Qué resolver/verificar:** Añadir métricas de errores/latencia/colas/almacenamiento y despliegue reproducible con verificación y rollback compatible con migraciones.
- **Referencia de diseño/control:** [Autorización y aislamiento](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

### ND-63. Auditoría puede fallar sin avisar al operador

- **Prioridad:** Media. **Estado de evidencia:** Comprobado.
- **Evidencia:** HttpAuditInterceptor captura fallos y solo registra warn. Triggers conservan parte de los cambios de BD, pero eventos HTTP/descargas fallidos pueden faltar.
- **Ubicación principal:** [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/config/HttpAuditInterceptor.java](../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/config/HttpAuditInterceptor.java).
- **Qué resolver/verificar:** Definir criticidad de eventos y monitorizar fallos; evitar bloquear consultas rutinarias o duplicar navegación.
- **Referencia de diseño/control:** [Logs y datos sensibles](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).

### ND-64. Terceros, correspondencia y plantillas reutilizables

- **Prioridad:** Baja. **Estado de evidencia:** Mejora.
- **Evidencia:** El núcleo no ofrece gestión común identificada de contraparte/proveedor/cliente, recepción/envío documental y generación de documentos. Son capacidades propuestas, no defectos de aceptación ya acordados.
- **Ubicación principal:** [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/model/Document.java](../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/model/Document.java).
- **Qué resolver/verificar:** Priorizar tras cerrar persistencia, metadatos, acceso y expedientes; configurar por tenant y mantener extensiones clínicas opcionales.
- **Referencia de diseño/control:** [Autorización y aislamiento](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

## Secuencia recomendada

1. Contención operativa: rotación coordinada de secretos, TLS, privilegios DB, respaldo de archivos y errores externos.
2. Corregir contratos de sesión y consumo único, con pruebas transaccionales reales.
3. Terminar OCR/carga/expediente y reglas de acceso; no agregar más pantallas antes de persistir resultados reales.
4. Hacer operativos metadatos/tipos/capacidades por tenant, con dos tenants de rubros distintos en pruebas.
5. Corregir publicación de plantillas y coherencia de estados/métricas; preservar las garantías ya implementadas.
6. Conectar reportes y búsqueda, controlar conservación y ensayar restauración.
7. Automatizar pruebas de integración, build reproducible y smoke test; reducir deuda interna gradualmente.

## Escenarios mínimos de aceptación

- Tenant A crea y consulta un documento; Tenant B no puede listar ni descargar ninguna de sus versiones.
- Usuario sin permiso de recurso no recibe su archivo aunque conozca sus UUID.
- OCR falla: la pantalla muestra error y no comunica guardado/indexación; OCR válido: resultado y archivo persisten tras recargar.
- Archivo >1 MB permitido llega al backend por Nginx; archivo fuera del máximo es rechazado coherentemente.
- Crear registro y fallar carga conserva un pendiente recuperable sin duplicación.
- Tipo Contrato y tipo Factura exigen campos distintos y el servidor valida solicitudes manuales.
- Expediente muestra documentos reales y no puede cerrarse si su política exige pendientes resueltos.
- Editar plantilla y guardar borrador conserva publicada la versión anterior; publicar reemplazo activa una sola versión.
- Aprobar verifica jerarquía y versión; corregir requiere nueva versión; dos decisiones simultáneas no resuelven dos veces.
- Reutilizar refresh invalida la familia de sesiones y esa revocación persiste pese al error.
- Revocar todas y volver a iniciar sesión no rehabilita access tokens anteriores.
- Dos resets con el mismo token: uno solo tiene éxito; logout por inactividad llega autorizado al servidor.
- Papelera admite restauración según política; anulación preserva evidencia y se diferencia de borrado.
- Resumen clínico no presenta notas anuladas/borradores como vigentes y no permite nueva escritura indebida sobre historia dada de baja.
- Restauración aislada recupera base y archivos, y todos los enlaces de versiones comprobados resuelven correctamente.

## Fuentes oficiales adicionales consultadas

- [Autorización y aislamiento](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).
- [Políticas RLS y roles privilegiados](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).
- [Carga segura de archivos](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).
- [Errores sin exposición de detalles](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html).
- [Sesiones y expiración](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
- [Recuperación de contraseña](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).
- [Rollback de transacciones](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/rolling-back.html).
- [Inicialización de esquema, Spring Boot 3.2.12](https://docs.spring.io/spring-boot/docs/3.2.12/reference/html/howto.html#howto.data-initialization).
- [Límite de cuerpo en Nginx](https://nginx.org/en/docs/http/ngx_http_core_module.html#client_max_body_size).
- [Timeout de proxy Nginx](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_read_timeout).
- [Disponibilidad y dependencias Compose](https://docs.docker.com/reference/compose-file/services/).
- [Respaldo PostgreSQL](https://www.postgresql.org/docs/17/app-pgdump.html).
- [Ciclo de gestión de registros](https://www.archives.gov/records-mgmt/policy/universalermrequirements).
- [Tipos documentales, metadatos y workflows](https://learn.microsoft.com/en-us/sharepoint/governance/content-type-and-workflow-planning).
- [Conservación y disposición](https://learn.microsoft.com/en-us/purview/records-management).
- [Estado y contexto de documentos clínicos, FHIR R4](https://hl7.org/fhir/R4/documentreference.html).
- [Estado y contexto de atención, FHIR R4](https://hl7.org/fhir/R4/encounter.html).
- [Accesibilidad de diálogos](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
- [Seguridad Angular](https://angular.dev/best-practices/security).
- [Logs y datos sensibles](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).
- [Aviso oficial: fin soporte OSS Spring Boot 3.2](https://spring.io/blog/2024/11/21/spring-boot-3-2-12-available-now/).
- [Advisory Angular Router, condicionamiento SSR](https://github.com/advisories/GHSA-ff3f-86qr-9cv3).
- [Alcance de pnpm audit](https://pnpm.io/cli/audit).
- [Condiciones de tratamiento de datos Gemini](https://ai.google.dev/gemini-api/terms).

Las fuentes clínicas son referencias para la extensión clínica; no se proponen como dependencias obligatorias del núcleo multirrubro. Las referencias NARA y de productos comerciales aportan diseño funcional, no acreditación ni obligación legal local. No se promete firma electrónica, cumplimiento normativo o inalterabilidad completa únicamente porque una pantalla o documento de proyecto lo mencione.
