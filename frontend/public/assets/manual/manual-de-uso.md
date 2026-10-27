# Manual de uso de NexoDocs

Guía para usuarios y administradores de una organización. Versión de octubre de 2026.

NexoDocs organiza los documentos clínicos y administrativos de tu organización: los guarda con su historial de versiones, los agrupa en expedientes, los digitaliza con OCR, los hace circular por flujos de aprobación y deja constancia de cada acción en la auditoría.

Lo que ves en el menú depende de los permisos de tus grupos. Si te falta una opción que necesitas, pídela al administrador de tu organización.

## 1. Primeros pasos

### Iniciar sesión
1. Entra a la página de NexoDocs y pulsa "Iniciar sesión".
2. Elige tu organización, escribe tu usuario o correo y tu contraseña.
3. Si es tu primer ingreso, el sistema te pedirá cambiar la contraseña temporal que te entregó el administrador.

Si fallas varias veces seguidas, el acceso se bloquea unos minutos (error 429): espera y vuelve a intentarlo. La sesión se cierra sola tras un tiempo sin actividad. Si tu administrador te asignó un horario o una fecha límite de acceso, fuera de ellos el sistema te lo indicará al iniciar sesión.

### Conocer la pantalla
- **Menú lateral:** los módulos agrupados por área. Se puede colapsar con "Colapsar menú".
- **Barra superior:** buscador global, idioma (ES, EN, FR, ZH), plan actual, notificaciones, ayuda y tu perfil.
- **Botón de ayuda (?):** abre el centro de ayuda con artículos, preguntas frecuentes y el asistente.
- **Recorrido guiado:** se muestra la primera vez. Para repetirlo, abre tu perfil y pulsa "Iniciar recorrido".

### Tu perfil
Desde el menú de usuario (arriba a la derecha) puedes cambiar tu nombre, correo, teléfono, biografía y foto, tu contraseña y tus preferencias de avisos.

## 2. Inicio

- **Resumen:** saludo, indicadores principales y documentos recientes.
- **Actividad reciente:** lo último que ocurrió en la organización.
- **Mis tareas:** las revisiones y aprobaciones que esperan tu decisión.

## 3. Documentos

### Consultar
- **Todos los documentos**, **Mis documentos** y **Compartidos conmigo**.
- Filtra por estado, tipo o fecha y usa el buscador para encontrar por código o nombre.
- Exporta el listado a Excel (CSV), PDF o JSON.

### Crear un documento
1. Ve a Documentos > Nuevo documento.
2. Elige el tipo documental y completa código, nombre y los datos que pida el formulario.
3. Adjunta el archivo y guarda. El sistema registra la versión 1 con su huella digital (SHA-256).

Formatos admitidos al subir: PDF, JPEG, PNG y Word (DOCX), hasta 25 MB por archivo, salvo que tu administrador haya fijado un límite menor para tu usuario.

### Versiones
En el detalle de un documento pulsa "Subir nueva versión", indica el motivo del cambio y adjunta el archivo. El historial conserva todas las versiones anteriores y puedes descargar cualquiera.

## 4. Digitalización y OCR

1. Entra a Digitalización > Escanear documento.
2. Pulsa "Subir archivo o escaneo" o "Capturar documento" con la cámara. Usa una imagen nítida, bien iluminada, derecha y sin recortes.
3. El sistema extrae el texto con OCR. En Procesamiento OCR el trabajo queda "Por validar".
4. Revisa y corrige los campos extraídos; pulsa "Confirmar extracción" o "Rechazar resultado".
5. En Indexación pulsa "Indexar Documento": se crea el documento en el repositorio con su versión 1.
6. Si hace falta, ajusta los metadatos en Corrección de metadatos mientras el documento siga en borrador.

El OCR reconoce texto de documentos (recetas, informes, formularios); no interpreta imágenes médicas como radiografías. Si falla, revisa que la imagen sea legible y no demasiado pesada y vuelve a intentarlo.

## 5. Expedientes y módulo clínico

- **Expedientes:** agrupan los documentos de un mismo caso, cliente o trámite. Crea uno en Expedientes > Crear expediente, asigna un responsable y vincula sus documentos.
- **Módulo clínico:** Pacientes, Antecedentes, Historia clínica y Notas médicas. Las notas tienen tipo y estado (empiezan como borrador) y la historia clínica conserva sus revisiones.

## 6. Workflows (flujos de aprobación)

1. Desde un documento o en Workflows, inicia un flujo y elige la plantilla.
2. Confirma los responsables de cada etapa. Las etapas se ejecutan en orden, una tras otra.
3. Cada responsable ve su tarea en Mis tareas o en Pendientes de revisión / de aprobación, y decide aprobar o rechazar con un comentario.
4. Sigue el avance en Activos y consulta el resultado en Finalizados.

Quien tenga permiso de diseño crea y publica plantillas en el Diseñador.

## 7. Reportes

Reportes de documentos, usuarios, workflows, expedientes y auditoría con filtros, gráficos y exportación a CSV, JSON o PDF.

## 8. Administración de la organización

### Usuarios y grupos
- **Crear un usuario:** Usuarios y equipos > Todos los usuarios > "Crear usuario". Asígnale al menos un grupo. Recibe una contraseña temporal que el administrador le entrega (el sistema no la envía por correo).
- **Grupos (perfiles):** cada grupo reúne permisos; un usuario puede estar en varios grupos y suma sus permisos.
- **Editar, desactivar o reactivar** un usuario desde su fila. Tu plan limita la cantidad de usuarios activos.

### Personalizar un usuario
En la fila del usuario pulsa "Personalizar" (requiere el permiso de personalización):
- **Perfil:** cargo, teléfono y biografía.
- **Interfaz:** idioma predeterminado y pantalla de inicio.
- **Notificaciones:** avisos por correo electrónico y push.
- **Seguridad y acceso:** exigir cambio de contraseña, acceso válido hasta una fecha, días y horario permitidos, y cerrar todas sus sesiones.
- **Documentos:** tamaño máximo por archivo, cuota de almacenamiento y tipos documentales que puede crear.

Al guardar un cambio de acceso se cierran las sesiones abiertas del usuario. Nadie puede cambiar su propio acceso.

### Privilegios por formulario
En Usuarios y equipos > Privilegios por formulario elige el formulario y el grupo, y fija cada campo como "Visible y editable", "Solo lectura" o "No visible". Si un usuario está en varios grupos, gana el más permisivo.

## 9. Configuración

La pantalla Configuración reúne los accesos a todo lo que se ajusta en la organización y permite descargar este manual.

- **Apariencia y regionalización:** color de la marca, URL del logotipo, moneda, zona horaria y formato de fecha.
- **Estados documentales:** consulta de los estados por los que pasa un documento.
- **Respaldos:** copias de seguridad manuales y automáticas.
- **Usuarios, personalización y privilegios:** ver la sección 8.
- **Suscripción y facturación:** ver la sección 11.

## 10. Respaldos y restauración

- **Crear un respaldo:** Respaldos > Respaldos y restauración > "Crear respaldo". Espera a que quede Completado.
- **Respaldo automático:** en "Configuración" del módulo se define la hora diaria, la zona horaria y los días de retención (1 a 365).
- **Descargar:** abre el respaldo y pulsa "Descargar ZIP". El archivo no está cifrado: guárdalo en un lugar seguro y conserva una copia fuera del servidor.
- **Restaurar:** abre el respaldo, pulsa "Restaurar" y escribe el nombre exacto de la organización. Antes se crea un respaldo de seguridad protegido y, mientras dura, las modificaciones se suspenden.

## 11. Suscripción y facturación

### Ver tu suscripción
Facturación e ingresos muestra el estado, el plan, la próxima renovación y los recibos emitidos. "Gestionar suscripción" abre todas las opciones.

### Pagar o cambiar de plan
1. En Gestionar suscripción elige el plan y el ciclo (mensual o anual).
2. "Mejorar ahora" aplica un plan superior de inmediato. Con suscripción por tarjeta se cobra solo la diferencia prorrateada; sin ella, se abre la pantalla "Revisa tu plan".
3. En "Revisa tu plan" confirmas plan, ciclo, total y medio de pago. Con tarjeta pulsas "Continuar a Stripe" y pagas en la página segura de Stripe: NexoDocs no ve ni guarda los datos de la tarjeta. Con QR bancario o USDT se genera una orden de pago manual.

### Cambiar de plan en la próxima renovación
"Desde el próximo período" mantiene tu plan actual hasta la fecha de renovación y la siguiente factura ya cobra el plan elegido. Sirve para bajar de plan o pasar a anual. El uso actual (usuarios y almacenamiento) debe caber en el plan nuevo. Puedes anular el cambio antes de esa fecha.

### No renovar
"No renovar suscripción" mantiene el acceso hasta el fin del período pagado y no hace más cobros. Puedes reanudar la renovación antes de esa fecha.

### Cancelar la suscripción
1. Descarga antes un respaldo de tus datos.
2. Pulsa "Cancelar suscripción", elige un motivo, escribe el nombre exacto de la organización y tu contraseña.
3. La suscripción se anula en ese momento y se cierran todas las sesiones. El período ya pagado no se reembolsa automáticamente.
4. Los datos se conservan 30 días por si quieres recuperar la organización (contacta al soporte de NexoDocs).
5. Pasado ese plazo se eliminan definitivamente documentos, versiones, expedientes, pacientes, workflows, archivos, respaldos y configuración, y se anonimizan los usuarios. Las facturas y la auditoría se conservan porque la ley lo exige.

## 12. Auditoría

El menú Auditoría muestra quién hizo qué, cuándo, desde qué dirección IP y qué cambió: registro general, accesos, creación de documentos, modificaciones, descargas, aprobaciones, eliminaciones y cambios de permisos.

"Verificar integridad" comprueba que la cadena de registros no fue alterada. Si la verificación falla, avisa a un administrador.

## 13. Preguntas frecuentes

**No veo una opción del menú.** Tus grupos no tienen el permiso necesario; pídelo al administrador. Los permisos nuevos se aplican al volver a iniciar sesión.

**El sistema dice que alcancé un límite.** Tu plan limita usuarios, almacenamiento, documentos u OCR. Libera espacio o cambia de plan en Gestionar suscripción.

**No puedo iniciar sesión fuera de horario.** Tu administrador definió un horario o una fecha límite de acceso para tu usuario.

**¿Dónde descargo este manual?** En Configuración, tarjeta "Manual de uso".
