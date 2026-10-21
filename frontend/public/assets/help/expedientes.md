# Expedientes e Historias Clínicas Digitales

El módulo de **Expedientes** organiza de forma unificada toda la documentación clínica y legal asociada a pacientes, procesos asistenciales o expedientes corporativos.

---

## 1. Estructura de un Expediente Clínico

- **Ficha Principal del Paciente**: Contiene datos demográficos, número de identificación, contactos de emergencia y antecedentes relevantes.
- **Árbol de Documentos**: Los documentos se clasifican por categorías (consultas médicas, interconsultas, consentimientos informados, analíticas de laboratorio, estudios de imagenología y epicrisis).
- **Control de Versiones**: Cada actualización genera una nueva versión inmutable que preserva la autoría, fecha y hora exacta (timestamp auditado).

---

## 2. Privacidad y Confidencialidad Médica (HIPAA / GDPR)

- El acceso a la historia clínica está estrictamente restringido por políticas de seguridad basadas en roles (RBAC) y control de acceso a nivel de fila (RLS).
- **Registro de Auditoría**: Toda visualización, descarga, exportación o modificación queda registrada de forma indeleble en las tablas de auditoría del sistema.
- Los pacientes pueden solicitar acceso o copias certificadas conforme a los protocolos institucionales.

---

## 3. Cierre y Archivo Histórico

- Al finalizar el ciclo asistencial o alcanzar el plazo de custodia legal estipulado por la normativa sanitaria, el expediente puede pasar al estado **Cerrado** o **Archivado**.
- Los expedientes archivados son de solo lectura y conservan su integridad para auditorías médicas futuras.
