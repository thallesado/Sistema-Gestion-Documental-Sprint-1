### Personalizar usuarios
Permite ajustar, para cada persona de tu organización, su perfil, su interfaz, sus avisos, cuándo puede entrar y qué puede subir. Está en Usuarios y equipos > Todos los usuarios (`/users`): en la fila del usuario pulsa "Personalizar". Requiere el permiso `user:customize` (además de `user:read` para ver la lista). El permiso se asigna a un grupo desde Grupos de usuarios (perfiles) > Permisos.

#### 1. Perfil
- Cargo o puesto, teléfono y biografía.
- El nombre, el correo, el estado y los grupos se cambian con "Editar".

#### 2. Interfaz
- **Idioma predeterminado**: se aplica al iniciar sesión; después la persona puede cambiarlo.
- **Pantalla de inicio**: la pantalla que abre al entrar (por ejemplo Documentos, Mis tareas o Expedientes). Si no tiene permiso para esa pantalla, entra al tablero.

#### 3. Notificaciones
- Activa o desactiva los avisos por correo electrónico y los avisos push.

#### 4. Seguridad y acceso
- **Exigir cambio de contraseña** en el próximo inicio de sesión.
- **Acceso válido hasta**: después de esa fecha no puede iniciar sesión. Útil para personal temporal o auditores externos.
- **Días y horario permitidos**: fuera de ellos el inicio de sesión se rechaza con el motivo. Se usa la zona horaria de la organización; si la hora de fin es anterior a la de inicio, la franja cruza la medianoche (turno nocturno). Sin días marcados se permiten todos.
- **Cerrar todas sus sesiones**: lo desconecta en todos sus dispositivos.
- Al guardar un cambio de acceso, sus sesiones abiertas se cierran para que la regla se aplique de inmediato. Nadie puede cambiar su propio acceso: pídeselo a otro administrador.

#### 5. Documentos
- **Tamaño máximo por archivo** (de 1 a 25 MB) y **cuota de almacenamiento** en MB para las versiones que sube. Se muestra el espacio que ya usa.
- **Tipos documentales permitidos**: solo podrá crear documentos de los tipos marcados. Sin selección, puede usar todos.
- Los límites del plan de la organización se aplican siempre, además de estos.
