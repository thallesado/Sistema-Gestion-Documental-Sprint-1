# Historias de usuario verificables — Workflows

Estas cuatro historias se apoyan en el motor, la API y los datos persistidos del
tenant; no en estados simulados del frontend. Los criterios se cubren en la suite
de integración `scripts/test-workflows.ps1` y en `frontend/tests/workflows.test.mjs`.

## HU-WF-01 — Diseñar y publicar una plantilla reutilizable

**Como** administrador del tenant, **quiero** diseñar, validar, guardar y
versionar una plantilla de workflow, **para** iniciar procesos consistentes sin
modificar instancias que ya están en curso.

- El diseñador valida nodos, conexiones y ramas antes de guardar.
- Una plantilla en borrador no puede iniciar workflows; al publicarla queda
  disponible y se conserva el historial de versiones.
- Las instancias existentes mantienen la versión original de la plantilla.
- La carga inicial de plantillas es idempotente y está aislada por tenant.

**Verificación:** validación del grafo, borrador/publicación, métricas e historial
de plantilla y aislamiento de la carga inicial en la prueba de integración; la
prueba UI verifica diseñador, vista previa, guardado y navegación con cambios.

## HU-WF-02 — Revisar, comentar y devolver para corrección

**Como** revisor asignado, **quiero** revisar la tarea, completar su checklist,
comentar y devolverla a la persona responsable, **para** pedir una corrección
con trazabilidad antes de continuar.

- Sólo una persona autorizada y asignada puede resolver la tarea.
- La revisión no puede completarse mientras falten elementos obligatorios del
  checklist.
- Comentarios, cambios de responsable, devolución y reanudación quedan en el
  historial; la tarea de corrección permite continuar el flujo.
- En workflows documentales, la aprobación posterior exige revisar la versión
  documental corregida y registra exactamente qué versión se aprobó.

**Verificación:** checklist incompleto/completo, comentario, devolución,
corrección, carga de versión y aprobación de esa versión en la integración.

## HU-WF-03 — Aprobar con jerarquía y cerrar el proceso

**Como** aprobador superior asignado, **quiero** aprobar o rechazar con una
observación, **para** cerrar el proceso conservando la decisión y su responsable.

- Una persona sin permiso o que no sea superior no puede aprobar.
- La excepción de autoaprobación se limita al dueño/superadministrador del tenant.
- No se puede decidir dos veces una misma tarea; una aprobación exitosa avanza
  las etapas y una decisión terminal no deja pasos activos.
- El cierre registra aprobador, resultado, marcas de tiempo y duración desde
  `started_at` hasta `completed_at`.

**Verificación:** intento denegado, aprobación válida, doble decisión,
autoaprobación prohibida para usuarios comunes, excepción de propietario,
rechazo justificado, instancias de pasos finalizadas e indicadores de duración.

## HU-WF-04 — Consultar workflows con seguridad y trazabilidad

**Como** usuario de un tenant, **quiero** consultar mis tareas, workflows activos
y finalizados, **para** encontrar procesos por estado y revisar su historial sin
acceder a información de otra organización.

- Listas, filtros, indicadores y paginación usan el tenant autenticado.
- Un tenant distinto recibe recurso no disponible al consultar un workflow ajeno.
- El historial del workflow es inmutable y refleja eventos, actores y tiempos.
- Un documento no admite dos workflows activos incompatibles; sus cambios de
  estado siguen las reglas configuradas por la plantilla.
- Finalizados permite consultar la duración y filtrar por fecha de inicio y de
  finalización.

**Verificación:** aislamiento entre tenants, paginación, historial y auditoría,
Kanban operativo, filtros de completados, bloqueo de duplicado documental y
protección de cambios manuales de estado.

## Ejecutar las verificaciones

```powershell
pnpm --dir frontend test
mvn -f backend/pom.xml test
docker compose --env-file .env -f infrastructure/docker-compose.yml up -d --build
./scripts/test-workflows.ps1
```

La prueba de integración usa cuentas demo, genera nombres aleatorios y conserva
los workflows de prueba en la base de datos para permitir revisar su historial.
Ejecutarla requiere que la app Docker esté activa y que el tenant demo tenga los
usuarios indicados por el script.
