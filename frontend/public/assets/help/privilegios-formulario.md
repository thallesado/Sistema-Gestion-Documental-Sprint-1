### Privilegios por formulario
Permiten decidir, por grupo de usuarios, qué componentes de cada formulario se ven o se pueden editar. Están en Usuarios y equipos > Privilegios por formulario (`/users/form-permissions`) y requieren el permiso `component_permission:manage`.

#### 1. Los tres estados
- **Visible y editable**: el componente se muestra y se puede modificar.
- **Solo lectura**: se muestra, pero no se puede modificar.
- **No visible**: el componente no se muestra.

#### 2. Cómo se resuelven
- Por defecto todo es Visible y editable: sin configuración, nada se restringe.
- Si un usuario pertenece a varios grupos, gana el grupo más permisivo (Visible y editable sobre Solo lectura, y este sobre No visible).

#### 3. Cómo configurarlos
1. Abre Privilegios por formulario y elige el formulario y el grupo.
2. Fija el estado de cada componente.
3. Guarda los cambios.
