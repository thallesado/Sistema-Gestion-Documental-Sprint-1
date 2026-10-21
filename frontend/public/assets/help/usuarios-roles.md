# Gestión de Usuarios, Grupos y Roles (RBAC)

NexoDocs implementa un modelo de control de acceso basado en roles (**Role-Based Access Control - RBAC**) que permite asignar responsabilidades precisas a cada colaborador de la organización.

---

## 1. Grupos y Perfiles Clínicos

Los usuarios pertenecen a uno o más grupos que definen sus facultades dentro del sistema:
- **Administrador de Tenant**: Configura la empresa, marca corporativa, límites de plan y gestiona las cuentas de los usuarios.
- **Médico Especialista**: Consulta y crea historias clínicas, aprueba órdenes médicas y revisa resultados de laboratorio.
- **Personal de Enfermería**: Registra signos vitales, notas de evolución y administración de medicamentos.
- **Auditor Clínico / Calidad**: Acceso de solo lectura a los expedientes y logs de auditoría para inspecciones regulatorias.

---

## 2. Límite de Usuarios por Plan

- Tu suscripción define un número máximo de usuarios activos (`maxUsers`).
- Si se alcanza este tope, el sistema impedirá la creación de nuevas cuentas hasta que se desactiven usuarios inactivos o se realice un cambio de plan a uno superior.

---

## 3. Seguridad de Acceso y Credenciales

- Al crear un usuario nuevo, el sistema genera una contraseña temporal y activa la bandera `must_change_password`. El usuario deberá actualizar su clave de forma obligatoria en su primer inicio de sesión.
- Las cuentas pueden desactivarse temporalmente sin perder el histórico documental generado por el usuario.
