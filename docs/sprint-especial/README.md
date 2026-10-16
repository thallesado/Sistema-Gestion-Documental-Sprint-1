# Sprint especial: plan general y flujo de trabajo

Documento base para repartir el trabajo entre los seis integrantes. Cada persona tiene además su propio archivo `tareas-<nombre>.md` con lo que ya existe y lo que debe implementar.

## 1. Fuente y nivel de confianza

Los requisitos salen de la transcripción de la clase del 9 de octubre de 2026 y de un resumen hecho por IA de la misma grabación. La transcripción tiene tramos ilegibles, por lo que la numeración 1 a 8 es una reconstrucción. Los puntos menos seguros están marcados como "dudoso".

El estado actual del proyecto proviene de una auditoría de solo lectura sobre la rama `main`. Se verificó a mano una muestra de los datos clave (existencia de `PasswordRecoveryController`, ausencia de límites de plan, permisos que no llegan al frontend, chatbot excluido del build, `audit_events` con triggers de inmutabilidad). Las referencias de línea pueden haberse desplazado unas pocas líneas, así que conviene buscar por nombre de archivo y símbolo.

## 2. Los ocho requisitos del docente

| # | Requisito | Estado hoy | Brecha principal |
|---|---|---|---|
| 1 | Solución universal SaaS: suscripción, planes, cuenta admin, base compartida o por cliente | Parcial | Existen tablas de planes y aislamiento por tenant (RLS). No hay entidades de plan, ni límites aplicados, ni alta con admin inicial, ni flujo de compra |
| 2 | Tres niveles de usuario y privilegios por función y por componente (visible-editable, solo lectura, oculto) | Parcial | Roles y permisos por función funcionan. Falta el privilegio por componente, los permisos llegan solo al backend y hay roles predefinidos |
| 3 | Seguridad: contraseñas privadas, datos sin alteración, bitácora detallada tipo "caja negra" | Parcial | Hay BCrypt, tabla de auditoría append-only y recuperación de clave. Falta detalle de la operación, hora del cliente, logins fallidos y la protección frente al administrador de la base |
| 4 | Reportes en cuatro niveles: filtros previos, consulta por ejemplo (QBE), analítica, voz | Casi todo falta | La pantalla de reportes usa datos simulados. No hay backend de reportes, ni QBE, ni analítica, ni voz |
| 5 | Personalización: idioma, zona horaria, moneda, colores | Casi todo falta | Solo existen columnas de color y logo en la base, sin API ni uso |
| 6 | Respaldos automáticos, programados y de infraestructura completa, con restauración por cliente | Falta | Existe la tabla `backup_history` y un `pg_dump` manual. No hay código |
| 7 | Tecnología apropiada: usar recursos del móvil, no copiar la web | Parcial | La app Flutter es una copia de solo lectura, sin cámara ni sensores, con datos simulados al fallar |
| 8 | Asistencia al usuario con un agente que lo observe y ayude | Parcial | Hay un widget externo de Botpress, decorativo. El botón de ayuda solo muestra un aviso |

Lo que ya cumple y no hay que rehacer: digitalización OCR con cámara web y jobs persistidos, aislamiento multi-tenant con RLS, CRUD de roles y permisos con 75 permisos y 58 `@PreAuthorize`, recuperación de contraseña, revocación de tokens JWT, versiones de documento inmutables con SHA-256 y despliegue con HTTPS.

## 3. Reparto

La carga está medida en días de trabajo por persona. Prioridad: P1 obligatorio, P2 recomendable, P3 opcional si sobra tiempo.

| Persona | Tareas | Días | Resumen |
|---|---|---|---|
| Andres | F1 Respaldo y restauración por tenant (P1), F2 Respaldos programados y pantalla (P1), C2 Logins fallidos y límite de intentos (P1), G3 Compilar el APK en CI (P2) | 9,5 | Respaldos, infraestructura y despliegue |
| Diego | C1 Auditoría detallada (P1), C3 Bitácora a prueba de manipulación (P1), H2 Asistente contextual (P2), G0 Cliente Gemini compartido, PR 0 de andamiaje | 10 | Auditoría, asistente e integración del equipo |
| Oscar | B3 Permisos en el frontend (P1), B1 Grupos o perfiles (P1), B2 Privilegios por componente (P1) | 8 | Usuarios y privilegios |
| Mauricio | A1 Planes y alta de cliente (P1), A2 Límites del plan (P1), E2 Marca y regionalización (P1), A3 Suscripción y pago simulado (P2), H1 Centro de ayuda (P2) | 10 | SaaS, marca y ayuda |
| Cruz | D1 Reportes reales con filtros (P1), D3 Analítica (P2), G1 OCR en el móvil (P1), G2 Móvil sin datos simulados (P2) | 9 | Reportes reales y app móvil |
| Edixon | D2 Consultas por ejemplo (P1), E1 Idiomas (P1), D4 Reportes por voz (P3) | 10 | Consultas dinámicas, idiomas y voz |

El reparto sigue lo que cada uno ya tocó en el historial de git, con una carga parecida. Se puede intercambiar entre ustedes mientras se respeten las dependencias de la sección 4.

## 4. Orden y dependencias

1. **PR 0, primero y solo de Diego:** deja registradas las rutas y entradas de menú de las pantallas nuevas (ocultas con `sprintEnabled: false`), crea las páginas placeholder, los ganchos del shell (permisos, tema, idioma, ayuda y asistente), la plantilla de PR y esta documentación. Nadie empieza a editar los archivos calientes hasta que ese PR esté en `main`. El `CODEOWNERS` queda pendiente hasta tener los usuarios de GitHub de cada integrante.
2. **G0, de Diego:** extrae un cliente Gemini reutilizable desde `OcrService`. Lo usan H2 (Diego) y D4 (Edixon).
3. **Oscar:** hacer B3 antes que B2. Los demás pueden usar el servicio de permisos cuando B3 esté integrado.
4. **Mauricio:** hacer A1 antes que A2, A3 y E2. Acordar con Edixon el contrato de `/tenants/current/settings` (idioma por defecto).
5. **Edixon:** hacer D2 antes que D4. Acordar con Cruz que los reportes fijos viven en `/api/v1/reports/**` y las consultas dinámicas en `/api/v1/queries/**`.
6. **Diego:** hacer C1 antes que C3 (ambos tocan la inserción en `audit_events`).

### Qué deja listo el PR 0 para cada persona

| Persona | Ya está en `main` | Tú construyes encima |
|---|---|---|
| Andres | Ruta `/settings/backups` con guard y página `BackupsPage` | Reemplazar `BackupsPage` y activar la entrada de menú |
| Diego | `AssistantContextService` (ruta actual, últimas rutas y último error HTTP), `assistantErrorInterceptor`, `clientTimestampInterceptor` (pasa todo sin cambios), hueco `<app-assistant-widget />` en el shell | Añadir la cabecera en C1, y el asistente en H2 retirando Botpress de `app.ts` |
| Oscar | `PermissionService` (`setPermissions`, `can`, `canAny`; sin permisos cargados no concede nada), ruta `/users/form-permissions` y `FormPermissionsPage` | Alimentar `setPermissions` en B3 y usar el servicio en menú, guard y directiva |
| Mauricio | `ThemeService.apply(settings)` con `TenantSettings`, `HelpService` y `HelpDrawer` (el botón de ayuda ya los abre), rutas `/settings/appearance` y `/planes` (pública) con placeholders | Llenar el panel de ayuda en H1, llamar a `apply` tras el login en E2 y construir `/planes` en A3 |
| Cruz | Nada propio de frontend nuevo. Los reportes fijos usan `reportes-page.ts` y las rutas `/reports*` existentes | Conectar esa página a la API real en D1 |
| Edixon | `TranslationService` (`lang`, `use`, `load`, `t`; una clave sin traducir devuelve la clave), rutas `/reports/queries` y `/reports/voice` con `QbePage` y `VoiceReportPage` | Reemplazar los placeholders y, si eliges librería de idiomas, conservar la forma de `TranslationService` |

**Cómo activar una pantalla:** quita `sprintEnabled: false` de su entrada en `core/data/nexodocs-data.ts`. Si el grupo completo también lo tiene (`Reportes`, `Configuracion` y `Tenants`), hay que quitárselo al grupo, y eso hace visibles todas sus entradas que no estén ocultas por separado: avisa en el grupo antes de hacerlo.

## 5. Reglas para no chocar

### Archivos calientes

Estos archivos los tocaron muchas veces en el último mes, así que son donde más conflictos habrá:

| Archivo | Regla |
|---|---|
| `frontend/src/app/features/tablero/pages/espacio-trabajo-page.ts` (2170 líneas) | Congelado. No agregar funciones nuevas. Cada pantalla nueva va en su propio componente en `features/<área>/`. Si es imprescindible editarlo, avisar en el grupo y hacer un PR pequeño |
| `frontend/src/styles.css` (1713 líneas) | No agregar estilos globales. Usar los estilos del propio componente o un archivo de la feature |
| `frontend/src/app/core/data/nexodocs-data.ts` y `core/routes/app.routes.ts` | Las entradas nuevas las agrega el PR 0. Después solo se cambia `sprintEnabled` de la propia entrada |
| `frontend/src/app/shell/app.ts` y `app.html` | Solo el PR 0 los modifica. Cuatro tareas necesitan engancharse ahí (permisos, tema, idioma, asistente) y lo hacen por servicios, no editando el shell |
| `backend/bootstrap/src/main/resources/application.yml` | Cada uno añade su propio bloque de configuración, sin reordenar lo existente |
| `infrastructure/**` y `.github/workflows/**` | Solo Andres |
| `backend/.../service/UserService.java` | Lo tocan Oscar (B1) y Mauricio (A2). Cada uno añade una sola llamada a un servicio propio |
| `backend/.../service/HttpAuditService.java` y `AuditController.java` | Solo Diego |

### Migraciones de base de datos

La última migración es la `035`. Ya existen dos números duplicados (`018` y `020`), así que cada persona usa números reservados y no los cambia:

| Persona | Números |
|---|---|
| Oscar | 036, 037 |
| Mauricio | 038, 039 |
| Diego | 040, 041 |
| Andres | 042, 043 |
| Cruz | 044 |
| Edixon | 045, 046 |

Cada migración debe seguir el patrón idempotente de `035_ocr_job_persistence.sql`: bloqueo con `pg_advisory_xact_lock`, comprobación en `app.schema_migrations` y `COMMIT` final. Si necesitas una migración extra, pide un número en el grupo.

## 6. Flujo de trabajo recomendado en GitHub

Se recomienda GitHub Flow con ramas cortas y pull requests, que es lo más simple para seis personas en un repositorio.

### Reglas

1. **Nadie hace push directo a `main`.** Cada cambio va en una rama y entra por pull request.
2. **Nombre de rama:** `feature/<nombre>-<tarea>`, por ejemplo `feature/oscar-permisos-frontend`. Para arreglos: `fix/<nombre>-<tema>`.
3. **Ramas de vida corta:** una rama no debe pasar de dos o tres días sin integrarse. PR pequeños, de menos de 400 líneas cuando se pueda.
4. **Sincronizar a diario:** antes de empezar el día y antes de abrir el PR, traer lo último de `main`.
5. **Un PR por unidad de trabajo,** con sus tests y su documentación dentro. No hay PR "solo de tests" ni "solo de docs".
6. **Commits en formato Conventional Commits** (`feat(area): ...`, `fix(area): ...`), como ya se usa en el historial.
7. **Quién integra:** el autor hace "Squash and merge" de su propio PR cuando tiene una aprobación y la integración continua está en verde. Diego solo integra por otros en caso de conflictos entre varias ramas.
8. **Revisión cruzada obligatoria:** Oscar con Mauricio (roles y tenants), Cruz con Edixon (reportes y móvil), Diego con Andres (auditoría y respaldos). El revisor mira que respete las reglas de la sección 5.
9. **Despliegue:** Andres despliega desde etiquetas (`git tag sprint-esp-rc1`), no desde el último commit de `main`. Así se despliega solo algo que se probó.
10. **`main` siempre desplegable:** si una función está a medias, su entrada de menú queda con `sprintEnabled: false`.

### Protección de `main` (la configura Andres, dueño del repositorio)

En GitHub: Settings, Branches, regla para `main`:

- exigir pull request antes de integrar;
- exigir 1 aprobación y descartar aprobaciones antiguas al subir cambios;
- exigir que pasen las comprobaciones de `backend-ci` y `frontend-ci` (confirmar los nombres exactos en la pestaña Actions);
- bloquear el push forzado y el borrado de la rama;
- dar permiso de escritura a los seis, sin permiso de administrador salvo a Andres.

### Comandos del día a día

```bash
git switch main && git pull --ff-only
git switch -c feature/<nombre>-<tarea>

# trabajar con commits pequeños
git add <archivos> && git commit -m "feat(area): descripcion corta"

# antes de abrir el PR y a diario
git fetch origin && git rebase origin/main
git push -u origin feature/<nombre>-<tarea>      # tras un rebase: git push --force-with-lease

# abrir el PR en GitHub, pedir revisión, y al aprobarse: Squash and merge
```

El `--force-with-lease` se usa solo sobre tu propia rama, nunca sobre `main`.

### Si hay un conflicto

1. `git fetch origin && git rebase origin/main`.
2. Resolver archivo por archivo conservando los dos cambios, no uno solo.
3. Correr los tests antes de continuar: `cd backend && ./mvnw test` y `cd frontend && npm test`.
4. Si el conflicto es en un archivo caliente de la sección 5, avisar al dueño de la otra parte antes de resolverlo.

## 7. Definición de terminado

Un PR está terminado cuando cumple todo esto:

- [ ] Los tests del backend y del frontend pasan. El build de Docker del frontend ejecuta `npm test`, así que un test roto bloquea el despliegue.
- [ ] Tiene tests propios para el comportamiento nuevo, incluidos los casos de error.
- [ ] La migración, si hay, es idempotente y se probó sobre una base nueva y sobre una existente.
- [ ] No deja datos fijos en pantalla ni datos simulados como si fueran reales.
- [ ] Los permisos del backend están declarados (`@PreAuthorize`) y la pantalla respeta los permisos.
- [ ] Documenta lo nuevo en `docs/` o en el README si cambia un comando, una variable de entorno o un endpoint.
- [ ] Ninguna clave ni contraseña entra al repositorio.

## 8. Riesgos conocidos del proyecto

- `JWT_SECRET` tiene un valor de desarrollo por defecto en `application.yml` y `docker-compose.yml`. En el servidor debe definirse uno propio, o los tokens se pueden falsificar.
- La app móvil permite tráfico sin cifrar (`usesCleartextTraffic="true"`). Con HTTPS en producción debe quitarse en los builds de producción.
- El widget de Botpress se carga desde un CDN externo sin verificación de integridad.
- El administrador de la base puede deshabilitar los triggers de inmutabilidad de `audit_events`. Es el motivo de la tarea C3.

## 9. Lo que no se verificó

- Las estimaciones de días son una aproximación de la exploración, no una medición.
- No se probó ningún cambio de este plan: es un diseño sobre el código actual.
- Hay que confirmar con el docente si "grupo" y "perfil" son lo mismo que un rol (ver tarea B1 de Oscar) y si el nivel de voz de los reportes es obligatorio.
