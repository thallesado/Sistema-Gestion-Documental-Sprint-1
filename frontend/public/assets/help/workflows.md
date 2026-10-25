### Flujos de Trabajo y Aprobaciones Documentales
El motor de **Workflows** guía un documento, un expediente o un proceso por etapas de revisión y aprobación, y deja el rastro de cada decisión. Sirve para cualquier sector.

#### 1. Ciclo de vida del documento
- **Borrador**: redacción inicial y versionado.
- **En revisión**: el documento llega a los revisores asignados según la plantilla del flujo.
- **En aprobación**: espera la decisión del aprobador de la etapa.
- **Aprobado**: la aprobación queda registrada con quién, cuándo y sobre qué versión. Es un estado del sistema; no sustituye una firma electrónica ni un trámite legal.
- **Rechazado o devuelto**: el aprobador deja un comentario y el documento vuelve al autor para corregirlo.

#### 2. Mis tareas
- En Workflows > Mis tareas encuentras las solicitudes pendientes de tu revisión o aprobación.
- Puedes filtrar, comparar la versión actual con las anteriores, ver el checklist y comentar antes de decidir.

#### 3. Plantillas de flujo
- Los administradores diseñan plantillas en Workflows > Diseñador (requiere el permiso `workflow:designer`) con nodos de Inicio, Tarea, Revisión, Aprobación, Decisión, Notificación, Archivo y Fin.
- Las etapas se ejecutan en secuencia, con un aprobador por etapa. Para varios aprobadores se encadenan etapas consecutivas.
- El nodo Notificación genera un aviso dentro de NexoDocs (campana de notificaciones). El sistema no envía correos electrónicos.
- Editar una plantilla crea una versión nueva; los flujos ya iniciados conservan la suya.
