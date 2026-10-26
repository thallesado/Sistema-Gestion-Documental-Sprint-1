### Gestión de Usuarios, Grupos y Permisos (RBAC)
NexoDocs controla el acceso por roles (**RBAC**): los permisos se asignan a grupos (perfiles) y los grupos a los usuarios.

#### 1. Grupos y perfiles típicos
- **Administrador del tenant**: configura la organización, la marca, y gestiona usuarios.
- **Perfiles de trabajo** (por ejemplo revisor, aprobador, operador o personal clínico): se crean según el rubro en Usuarios y equipos > Grupos de usuarios (perfiles).
- **Auditor**: acceso de consulta a la auditoría y los reportes.
- Un usuario puede pertenecer a varios grupos; ve el menú y las acciones de la suma de sus permisos.

#### 2. Límite de usuarios por plan
Tu plan establece un máximo de usuarios activos (*maxUsers*). Al alcanzarlo no se pueden crear ni reactivar cuentas hasta desactivar otras o cambiar de plan.

#### 3. Contraseñas y acceso
- Al crear un usuario se define una contraseña temporal que debe cambiarse en el primer inicio de sesión. El sistema no envía correos: el administrador entrega la contraseña temporal por un canal seguro.
- Tras varios intentos de inicio de sesión fallidos en poco tiempo el acceso se bloquea temporalmente (error 429); espera el tiempo indicado y reintenta.
- Las cuentas pueden desactivarse sin perder el historial que generaron.
- Para ocultar o bloquear campos concretos de un formulario por grupo, consulta el artículo Privilegios por formulario.
