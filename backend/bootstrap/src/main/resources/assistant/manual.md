NexoDocs organiza los documentos clínicos y administrativos de cada organización (tenant). El menú lateral agrupa los módulos; lo que ve cada usuario depende de sus permisos (por ejemplo `document:create`, `ocr:read`).

## Inicio
- Resumen (`/`), Actividad reciente (`/dashboard/activity`) y Mis tareas (`/dashboard/tasks`).

## Documentos
- Todos los documentos (`/documents`), Mis documentos (`/documents/mine`).
- Crear un documento: Documentos > Nuevo documento (`/documents/new`), completa tipo, título y metadatos y guarda. Requiere `document:create`.
- Subir un archivo: Documentos > Subir archivo (`/documents/upload`). Requiere `document:create`.
- Desde el detalle de un documento se puede subir una nueva versión ("Subir nueva versión") y ver su historial.

## Digitalización y OCR (cómo indexar un documento escaneado)
1. Entra a Digitalización > Escanear documento (`/digitization`).
2. Pulsa "Subir archivo o escaneo" o "Capturar documento" con la cámara. Usa una imagen nítida, bien iluminada y sin recortes.
3. El sistema procesa la imagen con OCR por IA. Revisa el resultado en Digitalización > Procesamiento OCR (`/digitization/ocr`): el trabajo queda "Por validar".
4. Corrige los campos extraídos si hace falta y pulsa "Confirmar extracción" para validarla, o "Rechazar resultado" si no sirve.
5. Con la digitalización validada, en Indexación (`/digitization/indexing`) pulsa "Indexar Documento": se crea el documento en el repositorio con su versión 1.
6. Después de indexar, en Corrección de metadatos (`/digitization/metadata`) puedes ajustar los metadatos finales mientras el documento siga en borrador.
Permisos: procesar requiere ejecutar OCR; revisar/validar requiere revisar OCR; indexar requiere indexar OCR.
El OCR solo reconoce texto de documentos (recetas, informes, formularios); no interpreta imágenes médicas como radiografías o tomografías.

## Problemas frecuentes del OCR
- Falla al procesar: reintenta; si vuelve a fallar, revisa que la imagen sea legible, no esté borrosa ni girada y que el archivo no sea demasiado grande.
- Error 413: el archivo es demasiado grande; usa una imagen más liviana.
- Error 502/503/504: el servicio de visión no respondió; espera unos minutos y reintenta.
- Error 403: no tienes permiso; pídelo a tu administrador.
- Documento detectado como tipo OTRO: puede no ser clínico; revisa el texto antes de confirmar.

## Expedientes y módulo clínico
- Expedientes > Todos los expedientes (`/expedients`), Crear expediente (`/expedients/new`).
- Expediente clínico, Historia clínica y Notas médicas en Expedientes o en Módulo Clínico > Pacientes (`/clinical/patients`), Antecedentes y Notas Médicas. Requieren permisos de paciente o de notas médicas.

## Workflows
- Todos los workflows (`/workflows`), Mis tareas (`/workflows/tasks`), Pendientes de revisión y de aprobación, Activos, Finalizados, Plantillas y Diseñador (`/workflows/designer`, requiere `workflow:designer`).
- Para aprobar o rechazar, abre la tarea desde Mis tareas o Pendientes de aprobación.

## Usuarios y equipos
- Todos los usuarios (`/users`), Grupos de usuarios (perfiles) (`/users/roles`), Permisos (`/users/permissions`) y Privilegios por formulario (`/users/form-permissions`). Los permisos se asignan a perfiles y los perfiles a usuarios.
- Un usuario nuevo recibe una contraseña temporal que el administrador le entrega (el sistema no envía correos) y debe cambiarla en su primer inicio de sesión.
- El plan limita la cantidad de usuarios activos; al alcanzar el tope no se pueden crear más hasta desactivar cuentas o cambiar de plan.

## Gestionar suscripción
Menú Facturación e ingresos > "Gestionar suscripción" (`/billing/subscription`). Requiere `tenant:update` o `tenant:manage`.
- Mejorar ahora: aplica un plan superior de inmediato y cobra la diferencia prorrateada (con tarjeta en Stripe); sin cobro automático abre el pago.
- Desde el próximo período: conserva el plan actual hasta la renovación y la siguiente factura cobra el plan elegido. Se usa para bajar de plan o pasar a anual; el uso actual debe caber en el nuevo plan. Se puede anular.
- No renovar suscripción: mantiene el acceso hasta el fin del período pagado y no cobra más; se puede reanudar antes de esa fecha.
- Cancelar suscripción: pide el nombre exacto de la organización, la contraseña y un motivo. Anula la suscripción ya, cierra todas las sesiones y conserva los datos 30 días; después se eliminan definitivamente documentos, expedientes, archivos y respaldos, y se anonimizan los usuarios. Facturas y auditoría se conservan. Descarga un respaldo antes de cancelar. Para recuperar la organización dentro del plazo hay que contactar al soporte.

## Complementos
- Gestionar suscripción → pestaña "Complementos" (`/billing/subscription`): almacenamiento adicional, usuarios adicionales o paquete de páginas OCR, sin cambiar de plan. Requiere la suscripción activa.
- Con tarjeta, el complemento se agrega a la suscripción de Stripe y se cobra con el plan; el paquete OCR se paga una vez, vence a los meses indicados y se usa cuando se agota la cuota mensual. Sin tarjeta, orden de pago QR o USDT por un período.
- Reducir o quitar solo si el uso actual cabe; se aplica al final del período pagado. No se puede cambiar de ciclo (mensual/anual) con complementos recurrentes: quítalos primero.
- Plataforma: Tenants → Complementos (`/platform/addons`) para el catálogo y los precios; la ficha de organización concede o retira cortesías.

## Personalizar usuarios
Menú Usuarios y equipos > Todos los usuarios (`/users`), botón "Personalizar" en la fila del usuario. Requiere `user:customize` y `user:read`.
- Perfil: cargo, teléfono y biografía. Nombre, correo, estado y grupos se cambian con "Editar".
- Interfaz: idioma predeterminado y pantalla de inicio, aplicados al iniciar sesión (si no tiene permiso para esa pantalla entra al tablero).
- Notificaciones: avisos por correo electrónico y push.
- Seguridad y acceso: exigir cambio de contraseña, acceso válido hasta una fecha, días y horario permitidos (zona horaria de la organización; una franja con fin anterior al inicio cruza la medianoche) y "Cerrar todas sus sesiones". Fuera de la fecha u horario el inicio de sesión se rechaza indicando el motivo. Guardar un cambio de acceso cierra sus sesiones. Nadie puede cambiar su propio acceso.
- Documentos: tamaño máximo por archivo (1 a 25 MB), cuota de almacenamiento y tipos documentales permitidos para crear documentos. Los límites del plan se aplican siempre.

## Privilegios por formulario
Menú Usuarios y equipos > Privilegios por formulario (`/users/form-permissions`). Requiere `component_permission:manage`.
1. Elige el formulario y el grupo.
2. Fija el estado de cada componente: "Visible y editable", "Solo lectura" o "No visible".
3. Guarda los cambios.
Por defecto todo es "Visible y editable". Si un usuario está en varios grupos, gana el grupo más permisivo.

## Auditoría
- Menú Auditoría (requiere `audit:read_tenant` o `audit:read_global`): Registro general (`/audit`), Accesos (`/audit/access`), Creación de documentos, Modificaciones, Descargas, Aprobaciones, Eliminaciones y Cambios de permisos. Muestran quién hizo qué, cuándo (hora del cliente y del servidor), desde qué IP y qué cambió.
- Verificar integridad: en el Registro general pulsa "Verificar integridad". Comprueba que la cadena de hashes SHA-256 de los eventos no fue alterada y la compara con el ancla externa si está configurada. Si es íntegra, no se detectó alteración de eventos pasados; no prueba que el contenido de cada evento sea correcto. Si falla, avisa a un administrador.

## Respaldos y restauración
Menú Respaldos > Respaldos y restauración (`/settings/backups`). Ver el menú requiere `backup:read`.
Crear un respaldo:
1. Entra a Respaldos > Respaldos y restauración.
2. Pulsa "Crear respaldo" (requiere `backup:create`).
3. Espera a que el estado sea Completado.
Respaldo automático: en "Configuración" (requiere `backup:configure`) se define la hora diaria, la zona horaria y los días de retención (1 a 365). La retención elimina los respaldos ordinarios vencidos; los respaldos de seguridad y la evidencia de restauraciones se conservan siempre.
Descargar: abre el detalle del respaldo y pulsa "Descargar ZIP" (requiere `backup:download`). El ZIP no está cifrado: guárdalo en un lugar seguro y conserva también una copia externa.
Restaurar un respaldo:
1. Abre el respaldo y pulsa "Restaurar" (requiere `backup:restore`).
2. El sistema verifica que el paquete sea válido y compatible.
3. Escribe exactamente el nombre de la organización para confirmar y pulsa "Restaurar respaldo".
4. Antes de restaurar se crea automáticamente un respaldo de seguridad protegido y las modificaciones de la organización se suspenden temporalmente; las demás organizaciones no se ven afectadas.
5. Los cambios posteriores al respaldo dejan de estar vigentes; la auditoría original se conserva y el estado anterior queda en el respaldo de seguridad.
Un respaldo creado antes de un cambio de estructura del sistema puede ser incompatible; crea uno nuevo.

## Apariencia y regionalización
Menú Configuración > Apariencia (`/settings/appearance`); el menú Configuración requiere `configuration:read`.
- Color primario de la marca (selector de color con vista previa).
- URL del Logotipo: se pega la dirección pública de una imagen; no se suben archivos de logo.
- Moneda, Zona horaria y formato de fecha de la organización.

## Registro, planes e inicio de sesión
- Una empresa nueva se registra desde la pantalla de inicio de sesión con "Crear cuenta de empresa" (`/planes`): elige un plan y completa sus datos; la cuenta creada es de administrador.
- Cada plan (por ejemplo Básico, Pro, Enterprise) fija límites: usuarios, almacenamiento, documentos y páginas de OCR por mes. Al superar un límite la acción se rechaza con un aviso; hay que liberar cupo o cambiar de plan.
- Si se superan los intentos fallidos de inicio de sesión en poco tiempo, el acceso se bloquea temporalmente (error 429): espera el tiempo indicado y reintenta. Un inicio de sesión correcto no cuenta como intento fallido.

## Administración global (solo cuentas de plataforma)
- Ficha de organización: Tenants → Todos los tenants → "Ver ficha" (`/platform/tenants/{id}`), o desde la tabla del Panel de plataforma. Muestra suscripción, uso frente a límites, pagos e historial; nunca documentos ni pacientes.
- Acciones de la ficha: suspender, reactivar (también en el período de gracia), extender la prueba (1 a 90 días, sin Stripe) y cambiar el plan sin cobro (sin Stripe; si el uso no cabe, pide confirmar). Todas exigen un motivo de al menos 5 caracteres, igual que el alta de una organización y el respaldo completo.
- Auditoría de plataforma: Panel de plataforma → Auditoría de plataforma (`/platform/audit`), con filtros y exportación CSV. Los registros no se pueden editar ni borrar.

- Planes y precios: Tenants → Planes y precios (`/platform/plans`). Edita nombre, descripción, venta, límites (-1 = ilimitado) y funcionalidades; bajar un límite que alguien supera o retirar una funcionalidad pide confirmar. Un precio nuevo se crea como versión en Stripe para nuevas ventas; los clientes actuales conservan el suyo y "Migrar clientes" los pasa al vigente con al menos 30 días de aviso. La pestaña "Grupos por defecto" define los grupos de las organizaciones nuevas.

## Otros
- Reportes (`/reports`), Facturación e ingresos (`/billing`).
- Perfil: menú de usuario arriba a la derecha (datos, contraseña, accesos asignados).
- El botón de ayuda de la barra superior abre el centro de ayuda.
- La sesión se cierra sola tras un tiempo de inactividad; si ves error 401, vuelve a iniciar sesión.
