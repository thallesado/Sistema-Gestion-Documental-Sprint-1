# Revisión funcional de HU-19 a HU-24

> Revisión documental: 2026-11-06. Fuente: checkout local 91fb767 más cambios locales sin commit; código y evidencia verificados para esta página.

## Resultado por historia

| HU | Resultado revisado | Implementación y límites observados |
|---|---|---|
| HU-19 Multitenant por ID | Aislamiento lógico verificado en instalación limpia y actualización incremental; el nuevo alta puede provisionar DB separada si routing/provisioning están activos. | Tenants legacy conservan base compartida con `tenant_id`, RLS FORCE y claves compuestas. `database/tests/run.ps1` comprueba dos tenants, acceso cruzado, rol de aplicación, instalación/upgrade/idempotencia y concurrencia. La migración 085 corrige el trigger diferido que verificaba la última versión documental: antes el owner interno no veía filas bajo FORCE RLS. No equivale a una auditoría de producción ni a penetración exhaustiva del routing por base.
| HU-20 Usuarios y permisos | Parcialmente cubierto; el backend sí hace cumplir permisos por endpoint y PostgreSQL. | Roles/usuarios se administran con `RoleController`, `UserController`, `@PreAuthorize`, RLS y directivas/guards Angular. Los permisos son códigos, no tres niveles universales de lectura/edición; el control por campo depende del catálogo y del permiso configurado. La cuenta global de plataforma no adquiere acceso al contenido clínico por ser superadmin. Falta una matriz de pruebas de cada rol/permisos frente a cada módulo y botones.
| HU-21 Logs SaaS | Registro técnico y pantalla añadidos para errores HTTP; parcial respecto a “salud del sistema” y captura general de WARN/ERROR. | Guarda nivel, hora, tenant, actor, categoría, ruta saneada, estado HTTP y tipo de excepción; nunca cuerpo, mensaje del error o texto clínico. `GET /api/v1/platform/technical-logs` exige `platform:tenant:manage`. La migración 083 elimina lectura directa del rol de aplicación y delega en funciones `SECURITY DEFINER` que validan administrador global activo; la inserción valida la correspondencia actor/tenant. La pantalla no es un explorador de todos los logs de JVM/infraestructura ni incluye métricas/alertas de salud.
| HU-22 Reportes, QBE y voz | QBE y consulta por voz ya ejecutan filtros reales; no es un lenguaje QBE arbitrario ni voz universal. | QBE admite entidades/campos permitidos y llama a `ReportController` con paginación/exportación. Voz convierte frases reconocidas en filtros permitidos. El reconocimiento depende de `SpeechRecognition` del navegador y el navegador/proveedor puede procesar el audio fuera del servidor de NexoDocs. No se envía la transcripción libre al backend ni a Gemini; únicamente los filtros reconocidos. `report:read` está sujeto a `advanced_analytics` del plan.
| HU-23 Backups | Creación manual, agenda diaria, compresión ZIP, verificación, restauración aislada, retención y bitácora ya están implementadas; incompleta frente a cifrado y alta disponibilidad del scheduler. | La captura no requiere API externa. Los paquetes ZIP y el payload de respaldo en PostgreSQL no están cifrados por la aplicación; permisos del filesystem y checksum no sustituyen cifrado. El programador es local al proceso/instancia y no es seguro para varias réplicas. La captura usa bloqueos por tenant; la restauración suspende escrituras de ese tenant mientras los demás pueden operar. Hace falta diseñar y probar una clave de cifrado estable, su respaldo/rotación y recuperación antes de dar por cumplido el criterio de “comprimidos y cifrados”.
| HU-24 Asistencia | Parcialmente cubierta, con protección de contenido añadida. | El endpoint autenticado usa Gemini y límite por usuario; `AssistantService` mapea la pregunta libre a una intención fija allowlist, por lo que no remite el texto original ni datos clínicos al proveedor. HelpDrawer mantiene FAQ/contexto local. El dictado por voz, si se usa, depende del navegador y su política de tratamiento del audio. Sin Gemini configurado, el chat responde no disponible; la ayuda local sigue siendo la alternativa.

## Cambios verificados en esta revisión

- Logs técnicos centralizados y pantalla de plataforma, sin registrar cuerpo/causa del proveedor/contenido clínico.
- Migración 083: tabla central de logs accesible al backend mediante funciones protegidas, no con SELECT directo de `nexodocs_app`.
- Migración 084: el rol interno de auditoría puede registrar una acción de un actor de plataforma validado, sin abrir escritura directa a la aplicación.
- Migración 085: `app.validate_current_version()` usa un owner interno con visibilidad necesaria para validar la última versión a pesar de FORCE RLS.
- QBE limitado y voz limitada conectados a reportes reales; no ejecutan consultas arbitrarias.
- Asistente Gemini recibe categoría de ayuda fija, no la pregunta original.
- El validador SQL ahora fuerza restricciones diferidas al probar errores, no consulta tablas RLS a las que el rol carece de SELECT, y prepara el tenant fixture con el plan que habilita reportes.

## Verificación reproducible

Desde la raíz:

```powershell
./database/tests/run.ps1
```

Resultado de esta revisión: `DATABASE_TESTS_OK` usando contenedor PostgreSQL temporal con `tmpfs`, sin tocar volúmenes permanentes.

Desde `backend/`:

```powershell
mvn --batch-mode --no-transfer-progress test
```

Resultado actualizado 2026-11-06: 422 pruebas, 0 fallas, 0 errores, 3 omitidas.

Desde `frontend/`:

```powershell
pnpm run typecheck
pnpm test
```

Resultado: typecheck correcto; 211 pruebas, 210 correctas, 0 fallas, 1 omitida.

## Limites pendientes para certificar las historias

- HU-20: falta una matriz de integraci?n por permiso, rol y m?dulo, incluida comprobaci?n UI/API.
- HU-21: la consola cubre errores HTTP saneados, no logs generales de JVM ni salud/alertas de infraestructura.
- HU-23: backups probados localmente, pero cifrado de archivos/payload y operaci?n multi-r?plica no quedan certificados.
- HU-24: Gemini comparte una intenci?n allowlist, pero falta recorrido con proveedor real; la voz depende del navegador y tratamiento externo.
- Aislamiento: el worker conserva CREATEDB/BYPASSRLS y dos tablas globales siguen sin RLS; falta encapsularlas y revisar permisos administrativos.
- Mobile: APK debug construido; publicaci?n requiere llave privada local y falta validaci?n en dispositivo.
- Todo lo anterior es evidencia local; no certifica AWS ni producci?n.


## Cierre de hallazgos prioritarios (2026-11-06)

1. **Migraciones de tenants aislados:** cerrado localmente. TenantDatabaseMigrationService recorre bases ISOLATED activas/de prueba con el perfil tenant-worker; se comprobo migracion 087 en las tres bases aisladas y la base central.
2. **Refresh con routing:** cerrado y cubierto por AuthServiceIsolatedRefreshTest; Maven completo pasa.
3. **Recuperacion de contrasena tenant-scoped:** rutas, DTO, transaccion, tenantId del enlace y RLS instalados; falta recorrido HTTP por SMTP real.
4. **Credenciales administrativas:** el backend HTTP no recibe credenciales de provisioning; solo el worker las recibe. Sigue pendiente reducir y certificar CREATEDB/BYPASSRLS del usuario administrativo antes de produccion.
5. **RLS:** auth_sessions y password_recovery_requests verificadas en central y tres DBs aisladas; contextos runtime correctos/incorrectos verificados. revoked_access_tokens y audit_anchors siguen fuera de RLS por lookup preautenticacion/cadena de auditoria y requieren encapsulacion de sus accesos.
6. **Backups y workflows:** la integracion de backups paso en una copia temporal de PostgreSQL tmpfs, incluyendo corrupcion, frontera tenant, restauracion con auditoria retenida, agenda y retencion. Maven y SQL pasan; no se ejecuto un recorrido UI/API completo de workflows.
7. **Mobile/APK:** flutter analyze, 41 pruebas y APK debug pasan. APK release se bloquea correctamente sin el archivo de firma privado; no se probo en dispositivo fisico.

Los puntos 1, 2 y las pruebas locales de backups quedan cerrados en este checkout. Los puntos 3-5 y las validaciones E2E de 6-7 conservan limites descritos arriba; por ello la revision no declara las siete historias certificadas al 100% ni afirma estado de AWS.
