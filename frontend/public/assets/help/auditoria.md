### Auditoría
El menú Auditoría registra quién hizo qué, cuándo, desde qué IP y qué cambió. Se ve con el permiso `audit:read_tenant` (tu organización) o `audit:read_global` (plataforma).

#### 1. Pantallas
- Registro general (`/audit`) y Accesos (`/audit/access`).
- Creación de documentos, Modificaciones, Descargas, Aprobaciones, Eliminaciones y Cambios de permisos, cada una filtrada por tipo de acción.

#### 2. Verificar integridad
- En el Registro general, el botón "Verificar integridad" recorre la cadena de eventos y comprueba que los hashes SHA-256 encadenados siguen coincidiendo, y la compara con el ancla externa cuando está configurada.
- Si la cadena es íntegra, indica cuántos eventos verificó: no se detectó ninguna alteración ni borrado de eventos pasados.
- Si falla, hay un evento modificado o eliminado y debes avisar a un administrador.
- Qué no demuestra: no prueba que el contenido de cada evento sea correcto, solo que no cambió después de registrarse.
