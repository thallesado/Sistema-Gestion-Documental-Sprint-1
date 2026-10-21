NexoDocs organiza los documentos clínicos y administrativos de cada organización (tenant). El menú lateral agrupa los módulos; lo que ve cada usuario depende de sus permisos (por ejemplo `document:create`, `ocr:read`).

## Inicio
- Resumen (`/`), Actividad reciente (`/dashboard/activity`) y Mis tareas (`/dashboard/tasks`).

## Documentos
- Todos los documentos (`/documents`), Mis documentos (`/documents/mine`).
- Crear un documento: Documentos > Nuevo documento (`/documents/new`), completa tipo, título y metadatos y guarda. Requiere `document:create`.
- Subir un archivo: Documentos > Subir archivo (`/documents/upload`). Requiere `document:create`.
- Desde el detalle de un documento se puede subir una nueva versión ("Subir nueva versión") y ver su historial.

## Digitalización y OCR (cómo indexar un documento escaneado)
1. Entra a Digitalizacion > Escanear documento (`/digitization`).
2. Pulsa "Subir archivo o escaneo" o "Capturar documento" con la cámara. Usa una imagen nítida, bien iluminada y sin recortes.
3. El sistema procesa la imagen con OCR por IA. Revisa el resultado en Digitalizacion > Procesamiento OCR (`/digitization/ocr`): el trabajo queda "Por validar".
4. Corrige los campos extraídos si hace falta y pulsa "Confirmar extracción" para validarla, o "Rechazar resultado" si no sirve.
5. Con la digitalización validada, en Indexacion (`/digitization/indexing`) pulsa "Indexar Documento": se crea el documento en el repositorio con su versión 1.
6. Después de indexar, en Correccion de metadatos (`/digitization/metadata`) puedes ajustar los metadatos finales mientras el documento siga en borrador.
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

## Auditoría
- Registro general (`/audit`) y Accesos (`/audit/access`): quién hizo qué, cuándo (hora del cliente y del servidor), desde qué IP y qué cambió.

## Otros
- Reportes (`/reports`), Facturación e ingresos (`/billing`).
- Perfil: menú de usuario arriba a la derecha (datos, contraseña, accesos asignados).
- El botón de ayuda de la barra superior abre el centro de ayuda.
- La sesión se cierra sola tras un tiempo de inactividad; si ves error 401, vuelve a iniciar sesión.
