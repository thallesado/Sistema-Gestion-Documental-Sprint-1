> Actualizacion de migracion (2026-09-15): la interfaz activa fue migrada a Angular 20 LTS en `frontend/`.
> Las rutas se definen en `frontend/src/app/core/routes/app.routes.ts` a partir de `frontend/src/app/core/data/nexodocs-data.ts`.
> El frontend sigue siendo una demo visual y no conecta el navegador directamente a PostgreSQL.
> El backend inicial está en `backend/` y usa Spring Boot 3.2.4 con Java 21.
> Las referencias historicas a Next.js, React, `page.tsx` y `features/` describen la estructura anterior.
> Actualización de estructura (2026-09-15): la interfaz activa está en `frontend/` y se organiza por capas con shell, core y features.
> Cada sección tiene una URL y se compone desde `frontend/src/app/features/*/`; la shell queda en `frontend/src/app/shell/`.
> Consulta [la arquitectura y el mapa de pantallas](ARQUITECTURA.md). Los comandos
> `pnpm dev`, `pnpm build`, `pnpm typecheck` y `pnpm test` se ejecutan desde la raíz.
> Las referencias a `app/page.tsx` y `components/module-content.tsx` del documento
> original describen la estructura anterior; el frontend sigue siendo una demo.

> Actualización de implementación (2026-09-14): consulta también
> [el diseño y operación de la base de datos](database/DISEÑO_Y_OPERACION.md)
> y [sus instrucciones de migración y pruebas](../database/README.md).
> La migración 004 refuerza el estado inicial descrito a continuación. Los principios
> del producto se mantienen; la API backend aún está en fase inicial y no cubre
> toda la persistencia documental, RLS ni RBAC.

Quiero que tomes el siguiente documento como contexto permanente para todo el trabajo que realicemos sobre este proyecto.

Antes de proponer o modificar código, debes leer completamente este contexto y revisar los archivos reales del repositorio. No debes asumir que una funcionalidad, tabla, endpoint, componente o servicio existe sin comprobarlo primero.

==================================================
1. IDENTIDAD DEL PROYECTO
==================================================

Nombre del producto:

NexoDocs — Sistema de Gestión Documental Multitenant

Repositorio:

https://github.com/thallesado/Dise-o-Visual-para-Sprint-1---Sistema-de-Gestion-Documental

Ruta local actual en Windows:

C:\Users\andre\Desktop\SI2\Sprint 1 Grupal\Dise-o-Visual-para-Sprint-1---Sistema-de-Gestion-Documental

El proyecto busca convertirse en una plataforma robusta, modular y escalable para administrar documentos durante todo su ciclo de vida.

El núcleo del producto es la GESTIÓN DOCUMENTAL.

NexoDocs NO debe diseñarse como un sistema clínico tradicional ni como un HIS completo.

Aunque uno de los casos de uso más importantes es el sector clínico, la arquitectura debe funcionar también para:

- Empresas privadas.
- Clínicas.
- Hospitales.
- Universidades.
- Instituciones públicas.
- Estudios jurídicos.
- Empresas de servicios.
- Organizaciones con documentación interna.
- Cualquier organización que necesite expedientes, documentos, aprobaciones y trazabilidad.

Regla conceptual principal:

GESTIÓN DOCUMENTAL = núcleo general del producto.

MÓDULOS CLÍNICOS = especializaciones opcionales activadas para determinados tenants.

Las reglas clínicas nunca deben contaminar ni condicionar el núcleo documental general.

==================================================
2. ESTADO ACTUAL DEL PROYECTO
==================================================

El proyecto tiene actualmente dos partes:

1. Un frontend visual funcional.
2. Una base de datos PostgreSQL local.

Todavía NO existe un backend que conecte el frontend con PostgreSQL.

El frontend utiliza datos simulados y acciones visuales sin persistencia.

No debes afirmar que una acción está guardando información en la base de datos mientras no exista una API o backend real.

No inventes endpoints ni conectes directamente el navegador a PostgreSQL.

Si se solicita persistencia, autenticación o integración real, primero debes proponer o inspeccionar la arquitectura backend correspondiente.

==================================================
3. TECNOLOGÍAS ACTUALES DEL FRONTEND
==================================================

El frontend utiliza aproximadamente:

- Next.js 16.3.3.
- React 19.2.4.
- TypeScript 5.7.3.
- Tailwind CSS 4.3.3.
- shadcn/ui.
- Base UI.
- Lucide React.
- Vercel Analytics.
- pnpm 12.3.4.
- Node.js 22 o superior.

Comandos principales:

pnpm install
pnpm dev
pnpm build
pnpm exec tsc --noEmit

La aplicación se abre normalmente en:

http://localhost:3000

Debes leer `AGENTS.md` antes de modificar código.

La versión de Next.js utilizada puede contener cambios respecto de versiones anteriores. Cuando sea necesario escribir código específico de Next.js, revisa la documentación local instalada en:

node_modules/next/dist/docs/

No asumas automáticamente que las convenciones conocidas de versiones anteriores siguen siendo correctas.

==================================================
4. ARCHIVOS IMPORTANTES DEL FRONTEND
==================================================

Archivos principales:

- app/page.tsx
- app/layout.tsx
- app/globals.css
- components/module-content.tsx
- components/ui/button.tsx
- lib/utils.ts
- package.json
- pnpm-lock.yaml

Responsabilidades actuales:

app/page.tsx:

- Contiene el layout principal.
- Contiene el sidebar.
- Administra la navegación visual mediante estado local.
- Simula la selección del tenant y del rol.
- Muestra el dashboard inicial.
- No utiliza todavía rutas independientes para cada módulo.

components/module-content.tsx:

- Contiene el contenido visual de las subcategorías.
- Tiene configuraciones y datos simulados.
- Contiene vistas reutilizables para listados, formularios, workflows, OCR, reportes, auditoría, notificaciones, configuración y tenants.
- Debe evitarse duplicar componentes que ya estén resueltos aquí.

app/globals.css:

- Contiene estilos globales.
- Integra Tailwind y shadcn.
- Mantiene variables visuales globales.

El frontend actual es un prototipo visual. Antes de agregar páginas, rutas o estructuras nuevas, revisa si es más coherente mantener la navegación existente o comenzar una migración controlada hacia rutas reales.

No realices una refactorización grande sin explicarla previamente.

==================================================
5. IDENTIDAD VISUAL
==================================================

Debe conservarse la identidad visual actual.

Colores predominantes:

- Turquesa.
- Blanco.
- Gris muy claro.
- Azul oscuro o verde oscuro para textos.

Semántica visual de estados:

- Verde: aprobado, vigente, completado o activo.
- Amarillo/naranja: pendiente o requiere atención.
- Azul: en revisión o en proceso.
- Rojo: rechazado, error, bloqueado o vencido.
- Gris: archivado, cerrado o inactivo.

Estilo esperado:

- Moderno.
- Minimalista.
- Corporativo.
- Limpio.
- Profesional.
- Responsive.
- Tarjetas con bordes redondeados.
- Sombras suaves.
- Iconografía lineal.
- Tablas claras.
- Badges de estado.
- Espaciado consistente.
- Jerarquía tipográfica clara.

No cambies visualmente componentes existentes sin una razón funcional clara.

Reutiliza los patrones visuales existentes antes de crear otros.

==================================================
6. ARQUITECTURA MULTITENANT
==================================================

El sistema es MULTITENANT.

Un tenant representa una organización independiente.

Ejemplos:

- Acme Consulting.
- Clínica Central.
- Hospital Viedma.
- Universidad XYZ.
- Empresa ABC.

Cada tenant debe trabajar de forma aislada.

Los datos de un tenant nunca deben mezclarse con los de otro.

Cada tenant puede tener sus propios:

- Usuarios.
- Roles.
- Permisos.
- Áreas.
- Grupos.
- Documentos.
- Expedientes.
- Workflows.
- Tipos documentales.
- Categorías.
- Metadatos personalizados.
- Etiquetas.
- Políticas de retención.
- Configuración.
- Branding.
- Reportes.
- Almacenamiento.
- Reglas de negocio.
- Notificaciones.

Debe existir una separación clara entre:

SUPERADMINISTRADOR DE PLATAFORMA

y

ADMINISTRADOR DEL TENANT.

El Superadministrador administra la plataforma y todos los tenants.

El Administrador del Tenant administra únicamente su organización.

Nunca confíes solamente en un `tenant_id` enviado por el frontend.

El tenant debe obtenerse o validarse desde el contexto autenticado.

Una petición no puede elegir libremente el tenant que desea consultar.

Toda operación sensible debe verificar:

1. Usuario autenticado.
2. Tenant autorizado.
3. Rol del usuario dentro del tenant.
4. Permiso necesario.
5. Pertenencia de las entidades al mismo tenant.

==================================================
7. ROLES Y RBAC
==================================================

El sistema utiliza RBAC: Role-Based Access Control.

Roles generales contemplados:

- Superadministrador.
- Administrador de tenant.
- Supervisor.
- Usuario operativo.
- Auditor.
- Recepcionista.
- Personal de archivo.

Roles clínicos posibles:

- Médico.
- Especialista.
- Personal de enfermería.
- Técnico de diagnóstico.
- Auditor médico o de calidad.
- Facturación o contabilidad.
- Paciente.

No todos los usuarios pueden:

- Ver todos los documentos.
- Crear documentos.
- Editar documentos.
- Descargar archivos.
- Aprobar documentos.
- Rechazar documentos.
- Archivar documentos.
- Eliminar lógicamente documentos.
- Ver auditoría.
- Crear workflows.
- Delegar tareas.
- Administrar usuarios.
- Administrar roles.
- Administrar permisos.
- Administrar tenants.

Los permisos no deben almacenarse como una lista arbitraria directamente en el usuario.

Se utilizan relaciones entre:

- users
- roles
- permissions
- user_roles
- role_permissions

Los roles pertenecen a un tenant.

Los permisos son un catálogo global.

Las asignaciones de usuarios, roles y grupos incluyen `tenant_id` para impedir relaciones cruzadas.

==================================================
8. SIDEBAR ACTUAL
==================================================

El sidebar se organiza en cinco secciones.

ESPACIO DE TRABAJO

Inicio:

- Resumen.
- Actividad reciente.
- Mis tareas.
- Indicadores.

Expedientes:

- Todos los expedientes.
- Crear expediente.
- Activos.
- Cerrados.
- Archivados.

Documentos:

- Todos los documentos.
- Nuevo documento.
- Subir archivo.
- Mis documentos.
- Compartidos conmigo.
- Recientes.
- Pendientes.
- En revisión.
- Aprobados.
- Archivados.
- Papelera.

Digitalización:

- Escanear documento.
- Subir documento.
- Procesamiento OCR.
- Validación.
- Indexación.
- Corrección de metadatos.

PROCESOS

Workflows:

- Todos los workflows.
- Mis tareas.
- Pendientes de revisión.
- Pendientes de aprobación.
- Activos.
- Finalizados.
- Plantillas.
- Diseñador.

GESTIÓN

Usuarios y equipos:

- Todos los usuarios.
- Crear usuario.
- Activos.
- Bloqueados.
- Roles.
- Permisos.
- Áreas.
- Grupos.

Auditoría:

- Registro general.
- Accesos.
- Creación de documentos.
- Modificaciones.
- Descargas.
- Aprobaciones.
- Eliminaciones.
- Cambios de permisos.

Reportes:

- Documentos.
- Usuarios.
- Workflows.
- Almacenamiento.
- Auditoría.
- Productividad.
- Actividad por área.

SISTEMA

Notificaciones:

- Todas.
- No leídas.
- Tareas.
- Aprobaciones.
- Menciones.

Configuración:

- General.
- Tipos documentales.
- Estados.
- Metadatos.
- Etiquetas.
- Plantillas.
- Retención.
- Seguridad.
- Apariencia.

ADMINISTRACIÓN GLOBAL

Tenants:

- Todos los tenants.
- Crear tenant.
- Activos.
- Suspendidos.
- Planes.
- Uso de almacenamiento.
- Branding.

La sección Tenants solo debe mostrarse al Superadministrador.

Digitalización, Usuarios, Auditoría y Configuración están restringidos actualmente a administradores del tenant y superadministradores en la simulación visual.

==================================================
9. DASHBOARD
==================================================

El dashboard resume la actividad del tenant actual.

Debe poder mostrar:

- Documentos activos.
- Documentos pendientes.
- Documentos en revisión.
- Documentos aprobados.
- Documentos archivados.
- Documentos próximos a vencer.
- Tareas pendientes.
- Workflows activos.
- Usuarios activos.
- Almacenamiento utilizado.
- Actividad reciente.

Componentes posibles:

- KPI cards.
- Gráficos.
- Documentos recientes.
- Tareas pendientes.
- Actividad del sistema.
- Acciones rápidas.

Acciones rápidas:

- Crear documento.
- Subir archivo.
- Crear expediente.
- Iniciar workflow.
- Revisar tarea.

El dashboard siempre debe representar únicamente al tenant seleccionado.

==================================================
10. EXPEDIENTES
==================================================

Un expediente es una unidad lógica que agrupa múltiples documentos relacionados.

No necesariamente es clínico.

Puede representar:

- Expediente de paciente.
- Expediente administrativo.
- Expediente legal.
- Expediente de proveedor.
- Expediente académico.
- Expediente de proyecto.
- Expediente contractual.

Atributos importantes:

- id.
- tenant_id.
- expedient_type_id.
- código.
- nombre.
- descripción.
- responsable.
- área.
- estado.
- metadatos.
- fecha de creación.
- fecha de cierre.
- fecha de archivo.
- eliminación lógica.

Estados principales:

- ACTIVE.
- CLOSED.
- ARCHIVED.
- BLOCKED.

Un expediente puede tener:

- Documentos.
- Participantes.
- Workflows.
- Comentarios.
- Actividad.
- Auditoría.

Reglas conceptuales:

Expediente ≠ Paciente.

Expediente ≠ Documento.

Un expediente contiene documentos, pero no es un documento.

==================================================
11. DOCUMENTOS
==================================================

Documentos es el núcleo más importante del producto.

Un documento debe manejar:

- id.
- tenant_id.
- código.
- nombre.
- descripción.
- tipo documental.
- categoría.
- expediente opcional.
- autor.
- responsable.
- área.
- estado.
- versión actual.
- etiquetas.
- metadatos.
- origen.
- ubicación del archivo.
- nombre del archivo.
- formato MIME.
- tamaño.
- checksum SHA-256.
- fecha de creación.
- fecha de modificación.
- fecha de emisión.
- fecha de vencimiento.
- fecha de archivo.
- fecha de anulación.
- eliminación lógica.

Estados contemplados:

- DRAFT.
- PENDING.
- IN_REVIEW.
- APPROVED.
- REJECTED.
- CURRENT.
- ARCHIVED.
- VOIDED.
- TRASHED.

El sistema debe contemplar:

- Creación.
- Carga.
- Clasificación.
- Indexación.
- Consulta.
- Previsualización.
- Descarga.
- Edición controlada.
- Versionado.
- Comentarios.
- Revisión.
- Aprobación.
- Rechazo.
- Archivado.
- Retención.
- Auditoría.
- Permisos.
- Relación con workflows.

Nunca asumas que editar un documento significa sobrescribir el archivo existente.

Toda modificación de contenido debe generar una nueva versión.

Las versiones son históricas e inmutables.

Evitar la eliminación física de documentos importantes.

Usar:

- Archivado.
- Anulación.
- Papelera.
- Soft delete.

==================================================
12. TIPOS DOCUMENTALES, CATEGORÍAS Y METADATOS
==================================================

Cada tenant puede definir tipos documentales propios.

Ejemplos generales:

- Contrato.
- Factura.
- Informe.
- Certificado.
- Formulario.
- Acta.
- Resolución.
- Solicitud.
- Memorándum.
- Manual.
- Política.

Ejemplos clínicos:

- Historia clínica.
- Consentimiento informado.
- Resultado de laboratorio.
- Receta.
- Informe radiológico.
- Nota de evolución.
- Orden médica.

Cada tipo documental puede tener:

- Nombre.
- Código.
- Descripción.
- Categoría.
- Esquema de metadatos.
- Metadatos obligatorios.
- Política de retención.
- Workflow predeterminado.
- Estado activo o inactivo.

Cada tenant puede definir metadatos personalizados.

Tipos de metadatos contemplados:

- TEXT.
- NUMBER.
- DATE.
- BOOLEAN.
- SELECT.
- MULTISELECT.
- USER.
- REFERENCE.

Ejemplos generales:

- Autor.
- Fecha.
- Área.
- Responsable.
- Cliente.
- Contrato.
- Proyecto.
- Sucursal.
- Origen.

Ejemplos clínicos:

- Paciente.
- Especialidad.
- Médico.
- Número de historia clínica.

==================================================
13. VERSIONADO DOCUMENTAL
==================================================

La tabla `document_versions` representa versiones inmutables.

Cada versión puede contener:

- tenant_id.
- document_id.
- version_number.
- author_id.
- motivo del cambio.
- ruta del archivo.
- nombre del archivo.
- MIME type.
- tamaño.
- checksum SHA-256.
- contenido estructurado JSON.
- fecha de creación.

Reglas:

- Una versión no debe modificarse.
- Una versión no debe eliminarse.
- El número de versión es único por documento.
- Crear una nueva versión debe actualizar de forma controlada `documents.current_version`.
- El historial debe conservar autor y motivo del cambio.

La base de datos incluye triggers que bloquean UPDATE y DELETE sobre `document_versions`.

==================================================
14. WORKFLOWS
==================================================

Los workflows representan procesos documentales.

Un workflow puede manejar:

- Tenant.
- Plantilla.
- Expediente.
- Documentos relacionados.
- Título.
- Descripción.
- Estado.
- Prioridad.
- Creador.
- Etapa actual.
- Fecha de inicio.
- Fecha límite.
- Fecha de finalización.

Estados:

- DRAFT.
- STARTED.
- IN_PROGRESS.
- PAUSED.
- COMPLETED.
- CANCELED.

Las plantillas contienen:

- Etapas.
- Orden.
- Tipo de etapa.
- Responsables.
- Condiciones.
- Reglas.
- Transiciones.
- Fechas límite.

Tipos de etapa:

- START.
- TASK.
- REVIEW.
- APPROVAL.
- DECISION.
- ARCHIVE.
- END.

Las tareas pueden asignarse a:

- Usuario.
- Rol.
- Área.
- Grupo.

Solo uno de esos destinos debe utilizarse por tarea.

Estados de tarea:

- PENDING.
- IN_PROGRESS.
- COMPLETED.
- OVERDUE.
- CANCELED.

Resultados posibles:

- APPROVED.
- REJECTED.
- CHANGES_REQUESTED.
- ACKNOWLEDGED.

Ejemplo de flujo:

Documento creado
→ Revisión documental
→ Corrección si corresponde
→ Aprobación
→ Publicación o archivo

El historial de eventos del workflow es append-only.

==================================================
15. DIGITALIZACIÓN, OCR E IA
==================================================

Flujo conceptual:

Documento físico
→ Escaneo o carga
→ OCR
→ Extracción de texto
→ Extracción de entidades
→ Sugerencia de metadatos
→ Validación humana
→ Clasificación
→ Indexación
→ Almacenamiento

Tecnologías conceptualmente contempladas:

- OCR.
- NER.
- NLP.
- Clasificación asistida.
- Extracción de metadatos.

Estados OCR:

- QUEUED.
- PROCESSING.
- REQUIRES_VALIDATION.
- VALIDATED.
- INDEXED.
- FAILED.

Regla crítica:

La inteligencia artificial no debe reemplazar automáticamente la decisión humana cuando el nivel de confianza sea bajo.

La información extraída debe poder:

- Revisarse.
- Corregirse.
- Confirmarse.
- Rechazarse.

Los niveles de confianza deben almacenarse de 0 a 1.

==================================================
16. AUDITORÍA
==================================================

La auditoría es obligatoria.

Debe registrar como mínimo:

- tenant_id.
- user_id.
- acción.
- tipo de entidad.
- identificador de entidad.
- fecha y hora.
- IP, si corresponde.
- user agent, si corresponde.
- resultado.
- detalles relevantes en JSON.

Eventos posibles:

- LOGIN.
- LOGOUT.
- LOGIN_FAILED.
- DOCUMENT_CREATED.
- DOCUMENT_VIEWED.
- DOCUMENT_DOWNLOADED.
- DOCUMENT_UPDATED.
- DOCUMENT_APPROVED.
- DOCUMENT_REJECTED.
- DOCUMENT_ARCHIVED.
- USER_CREATED.
- ROLE_CHANGED.
- PERMISSION_UPDATED.
- WORKFLOW_STARTED.
- TASK_ASSIGNED.
- TASK_COMPLETED.

La tabla `audit_events` es histórica e inmutable.

No se permiten UPDATE ni DELETE sobre sus registros.

No guardes secretos, contraseñas, tokens ni contenido clínico sensible innecesario dentro de los detalles de auditoría.

==================================================
17. REPORTES
==================================================

Los reportes pueden analizar:

- Documentos por estado.
- Documentos por área.
- Documentos por tipo.
- Documentos creados por período.
- Actividad por usuario.
- Workflows iniciados.
- Workflows completados.
- Workflows vencidos.
- Tiempo promedio de aprobación.
- Productividad.
- Almacenamiento.
- Actividad de auditoría.
- Uso por tenant.

Filtros posibles:

- Tenant.
- Fecha inicial.
- Fecha final.
- Área.
- Usuario.
- Tipo documental.
- Estado.

Las plantillas de reportes pueden guardar:

- Propietario.
- Nombre.
- Tipo de reporte.
- Campos seleccionados.
- Filtros.
- Orden.
- Visibilidad compartida.

Los reportes grandes deben filtrarse y paginarse en servidor cuando exista backend.

==================================================
18. NOTIFICACIONES
==================================================

Canales contemplados:

- IN_APP.
- EMAIL.
- PUSH.

Eventos posibles:

- Tarea asignada.
- Tarea próxima a vencer.
- Documento pendiente.
- Solicitud de aprobación.
- Documento aprobado.
- Documento rechazado.
- Comentario.
- Mención.
- Workflow completado.
- Alerta administrativa.

Cada notificación puede tener:

- tenant_id.
- user_id.
- canal.
- tipo.
- título.
- mensaje.
- entidad relacionada.
- fecha.
- estado leído.
- fecha de lectura.
- fecha de archivo.
- fecha de expiración.

Las notificaciones deben estar aisladas por tenant y usuario.

==================================================
19. CONFIGURACIÓN DEL TENANT
==================================================

Cada tenant puede configurar:

- Nombre.
- Código.
- Slug o subdominio.
- Logo.
- Color principal.
- Datos institucionales.
- Tipos documentales.
- Categorías.
- Etiquetas.
- Metadatos.
- Roles.
- Permisos.
- Áreas.
- Grupos.
- Políticas de retención.
- Reglas de workflow.
- Notificaciones.
- Seguridad.
- Apariencia.

La configuración de un tenant no puede afectar a otro.

==================================================
20. ADMINISTRACIÓN GLOBAL
==================================================

Solo corresponde al Superadministrador.

Debe permitir:

- Listar tenants.
- Crear tenants.
- Editar tenants.
- Suspender tenants.
- Reactivar tenants.
- Consultar el consumo.
- Configurar planes.
- Configurar límites.
- Configurar branding.
- Entrar de forma controlada al contexto de un tenant.
- Revisar usuarios, almacenamiento y actividad global.

Un tenant maneja:

- id.
- plan.
- nombre.
- código.
- slug.
- correo.
- teléfono.
- dirección.
- logo.
- color principal.
- configuración JSON.
- estado de suscripción.
- inicio y fin de suscripción.
- ciclo de facturación.
- límite de almacenamiento.
- fechas de creación y actualización.

Estados:

- TRIAL.
- ACTIVE.
- PAST_DUE.
- SUSPENDED.
- CANCELED.

El acceso global debe usar un rol técnico separado.

No conceder privilegios de Superadministrador al rol normal del backend.

==================================================
21. MÓDULO CLÍNICO
==================================================

El módulo clínico es opcional.

No debe convertir el sistema completo en un HIS.

Entidades contempladas:

- patients.
- clinical_staff.
- clinical_histories.
- clinical_episodes.
- clinical_document_links.
- dicom_studies.
- dicom_series.
- dicom_instances.

Separaciones obligatorias:

Paciente ≠ Usuario.

Paciente ≠ Expediente.

Expediente ≠ Documento.

Historia clínica ≠ Documento individual.

Un paciente puede tener:

- Una historia clínica dentro del tenant.
- Uno o varios episodios.
- Uno o varios expedientes.
- Múltiples documentos.
- Estudios DICOM.

Los documentos generales no deben tener un `patient_id` obligatorio.

La relación clínica se realiza mediante `clinical_document_links`.

Así, documentos administrativos, jurídicos o académicos siguen funcionando sin pacientes.

Las historias clínicas manejan:

- Código.
- Paciente.
- Grupo sanguíneo.
- Antecedentes patológicos.
- Antecedentes no patológicos.
- Antecedentes familiares.
- Alergias estructuradas en JSON.
- Condiciones crónicas.
- Medicamentos actuales.
- Observaciones.

DICOM conserva:

- Study Instance UID.
- Series Instance UID.
- SOP Instance UID.
- Modalidad.
- Descripción.
- Parte del cuerpo.
- Número de instancia.
- Ruta del archivo.
- Tamaño.
- Filas y columnas.
- Bits allocated.
- Window center.
- Window width.
- Pixel spacing.

==================================================
22. BASE DE DATOS IMPLEMENTADA
==================================================

Motor:

PostgreSQL 17 mediante Docker Compose.

Archivos:

- compose.yaml
- .env.example
- database/README.md
- database/init/001_schema.sql
- database/init/002_security.sql
- database/init/003_seed.sql
- database/tests/validate.sql

La base local usa por defecto:

Host: localhost
Puerto: 5433
Base: nexodocs
Usuario local: nexodocs

La URL predeterminada de desarrollo se encuentra documentada en `.env.example` y `database/README.md`.

Nunca utilices las credenciales locales predeterminadas en producción.

Comandos:

docker compose up -d
docker compose ps
docker compose logs postgres

Validación:

Get-Content database/tests/validate.sql -Raw | docker compose exec -T postgres psql -U nexodocs -d nexodocs

La validación debe terminar con:

VALIDATION_OK

El esquema validado contiene actualmente:

- 49 tablas públicas.
- 45 tablas protegidas con Row-Level Security.
- Cuatro catálogos globales sin tenant:
  - plans
  - plan_limits
  - plan_features
  - permissions

Datos de demostración:

- Acme Consulting.
- Clínica Central.
- Usuarios simulados.
- Roles y permisos.
- Documentos.
- Expedientes.
- Workflow.
- Tarea.
- Notificación.
- Auditoría.
- Paciente e historia clínica de demostración.

==================================================
23. AISLAMIENTO EN POSTGRESQL
==================================================

La base usa dos mecanismos complementarios:

1. Claves foráneas compuestas con `tenant_id`.
2. Row-Level Security.

Las relaciones entre entidades tenant-scoped deben incluir el tenant.

Ejemplo conceptual:

FOREIGN KEY (tenant_id, document_id)
REFERENCES documents(tenant_id, id)

Esto impide asociar accidentalmente una entidad de Acme Consulting con una entidad de Clínica Central.

La función de contexto es:

app.current_tenant_id()

El backend deberá trabajar dentro de una transacción:

BEGIN;
SET LOCAL ROLE nexodocs_app;
SELECT set_config('app.tenant_id', 'uuid-del-tenant-validado', true);
-- Consultas de la petición
COMMIT;

El backend debe comprobar previamente que el usuario autenticado pertenece al tenant.

No se debe utilizar directamente un tenant enviado libremente por el navegador.

Roles PostgreSQL:

- nexodocs_app:
  Rol normal de aplicación sujeto a RLS.

- nexodocs_platform_admin:
  Rol especial con BYPASSRLS reservado para procesos globales autorizados.

No concedas `nexodocs_platform_admin` al usuario normal del backend.

Las pruebas actuales verifican:

- Creación completa del esquema.
- Datos iniciales.
- Aislamiento RLS.
- Rechazo de relaciones cruzadas.
- Inmutabilidad de versiones.
- Conteo básico de entidades.

==================================================
24. DECISIONES TOMADAS RESPECTO AL SQL ORIGINAL
==================================================

El SQL original recibido era una colección histórica de migraciones V1 a V32.

Contenía:

- Versiones faltantes.
- Numeraciones internas cruzadas.
- Uso de `uuidv7()` sin declarar compatibilidad.
- Una migración que eliminaba y recreaba RBAC con CASCADE.
- Documentos obligatoriamente ligados a pacientes.
- Cambios sucesivos sobre historias clínicas.
- Tablas agregadas posteriormente para workflows.
- Inconsistencias entre UUID y SERIAL para roles y permisos.

No se copiaron ciegamente esas migraciones.

Se consolidó un esquema inicial limpio y ejecutable.

Decisiones actuales:

- UUID mediante `gen_random_uuid()`.
- Roles y permisos con identificadores identity bigint.
- Núcleo documental independiente de pacientes.
- Relaciones clínicas mediante tablas de enlace.
- Versiones y auditoría append-only.
- Multitenancy reforzada con claves compuestas.
- RLS para tablas del tenant.
- Planes y permisos como catálogos globales.
- Soft delete para entidades relevantes.
- Checks para estados, fechas, tamaños y asignaciones.
- Esquema compatible con PostgreSQL 17.

No regreses al modelo donde todos los documentos necesitan un paciente.

No reintroduzcas migraciones destructivas sin una estrategia explícita.

==================================================
25. REGLAS DE DESARROLLO
==================================================

Cada vez que te solicite implementar algo:

1. Revisa el código existente relacionado.
2. Revisa `AGENTS.md`.
3. Lee los archivos completos que vas a modificar.
4. Explica brevemente qué encontraste.
5. Identifica los archivos que modificarás.
6. Reutiliza componentes y estructuras existentes.
7. No dupliques componentes.
8. No agregues dependencias innecesarias.
9. Mantén nomenclatura consistente.
10. Separa presentación, lógica y acceso a datos.
11. No inventes endpoints, tablas ni modelos existentes.
12. Revisa si ya existe una entidad equivalente.
13. Mantén aislamiento multitenant.
14. Aplica RBAC en operaciones sensibles.
15. Registra acciones relevantes en auditoría.
16. No sobrescribas versiones documentales.
17. Evita eliminaciones físicas.
18. Maneja created_at, updated_at y deleted_at cuando corresponda.
19. Usa paginación en listados grandes.
20. Usa filtros de servidor cuando exista un volumen significativo.
21. Valida inputs en frontend y backend.
22. Usa transacciones para operaciones compuestas.
23. No acoples reglas clínicas al núcleo documental.
24. No cambies la arquitectura completa sin explicarlo previamente.
25. No afirmes que algo funciona sin ejecutar verificaciones proporcionales.

==================================================
26. REGLAS PARA CAMBIOS DE BASE DE DATOS
==================================================

Antes de cambiar el esquema:

- Revisa todo `database/init/001_schema.sql`.
- Revisa seguridad y RLS.
- Identifica claves foráneas afectadas.
- Comprueba el orden de creación.
- Considera datos existentes.
- Evita DROP TABLE o CASCADE.
- Prefiere migraciones incrementales cuando ya haya datos reales.
- Mantén las relaciones compuestas por tenant.
- Actualiza la documentación.
- Agrega o actualiza pruebas.

Durante desarrollo inicial, los scripts de `database/init` se ejecutan automáticamente solamente al crear un volumen vacío.

Reiniciar desde cero:

docker compose down --volumes
docker compose up -d

ADVERTENCIA:

Ese comando elimina los datos locales del volumen de NexoDocs.

No debes ejecutarlo si existen datos importantes sin confirmación explícita.

Después de cualquier cambio estructural importante:

1. Inicializa una base vacía.
2. Revisa los logs.
3. Ejecuta `database/tests/validate.sql`.
4. Comprueba RLS.
5. Comprueba relaciones cross-tenant.
6. Comprueba triggers de inmutabilidad.
7. Documenta el cambio.

==================================================
27. REGLAS PARA EL FRONTEND
==================================================

Mientras no exista backend:

- Usa datos simulados claramente identificados.
- Mantén las interacciones como demostraciones visuales.
- No uses almacenamiento inseguro para fingir autenticación real.
- No conectes PostgreSQL directamente desde componentes cliente.
- No agregues secretos al código.
- No expongas `DATABASE_URL` al navegador.
- No uses variables con prefijo `NEXT_PUBLIC_` para credenciales.

Cuando se implemente backend:

- Los componentes cliente consumirán servicios controlados.
- El backend resolverá autenticación, tenant y permisos.
- El backend establecerá el contexto RLS.
- Las respuestas deben estar limitadas al tenant autenticado.
- Los formularios deberán tener validación compartida o equivalente.
- Los errores deberán representarse visualmente de forma clara.

==================================================
28. FORMA DE RESPONDER Y TRABAJAR
==================================================

Antes de implementar, responde brevemente con:

- Qué encontraste.
- Qué arquitectura existente se relaciona.
- Qué archivos probablemente serán modificados.
- Qué riesgos o inconsistencias detectaste.

Después implementa, salvo que exista una decisión realmente bloqueante.

Al finalizar, informa:

- Qué cambió.
- Qué archivos se modificaron.
- Qué pruebas ejecutaste.
- Resultado de las pruebas.
- Cómo puedo probarlo.
- Qué sigue siendo simulado.
- Qué limitaciones quedan.

Si detectas una inconsistencia arquitectónica:

- No la ignores.
- No hagas una reescritura silenciosa.
- Explícala antes de realizar un cambio grande.
- Propón una solución compatible con este contexto.

==================================================
29. PRIORIDAD CONCEPTUAL
==================================================

Orden general de prioridad:

1. Multitenancy.
2. Autenticación.
3. Usuarios, roles y permisos.
4. Gestión documental.
5. Expedientes.
6. Versionado.
7. Workflows.
8. Auditoría.
9. Notificaciones.
10. Reportes.
11. Digitalización y OCR.
12. Módulos específicos por industria.
13. Módulo clínico.

Esta prioridad no significa que todo deba implementarse inmediatamente.

Sirve para orientar decisiones arquitectónicas y evitar construir módulos especializados sobre una base insegura.

==================================================
30. OBJETIVO FINAL
==================================================

Construir una plataforma de Gestión Documental multitenant que permita a diferentes organizaciones administrar:

- Documentos.
- Expedientes.
- Versiones.
- Metadatos.
- Categorías.
- Etiquetas.
- Usuarios.
- Roles.
- Permisos.
- Workflows.
- Tareas.
- Auditoría.
- Reportes.
- Notificaciones.
- Digitalización.
- OCR.
- Retención.
- Almacenamiento.
- Configuración.
- Branding.

La plataforma debe permitir añadir especializaciones por industria.

El sector clínico es actualmente un caso de uso importante, pero debe permanecer como un módulo desacoplado.

Principios que nunca debes olvidar:

- Gestión documental primero.
- Multitenancy desde el diseño.
- Ningún acceso cruzado entre tenants.
- RBAC para operaciones sensibles.
- Versiones y auditoría inmutables.
- Paciente no es usuario.
- Expediente no es paciente.
- Documento no es expediente.
- Los documentos generales no dependen del módulo clínico.
- El frontend actual sigue siendo una demostración sin persistencia.
- Nunca inventes infraestructura existente sin revisar el repositorio.
