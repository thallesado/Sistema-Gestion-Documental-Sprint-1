# HU-11: baja clínica justificada y trazabilidad documental

Verificación local: 2026-11-06. Checkout `91fb767` más cambios sin commit. Se utilizó la organización sintética y la base desechable de HU-09; no se modificaron pacientes reales ni se operó AWS.

## Flujo capturado

1. [Pestaña Documentos sin anexos](01-documentos-vacios.png).
2. [Buscar y seleccionar un documento](02-seleccion-documento.png). El documento asignado a otro paciente no aparece; un intento directo de vincularlo por API devuelve HTTP 400.
3. [Documento vinculado](03-documento-vinculado.png), con acceso a Ver documento y Desvincular. POST respondió 201.
4. [Detalle, metadatos y versión PDF](04-documento-y-version.png). Descargar respondió HTTP 200 y Chromium guardó [el PDF sintético](hu11-informe.pdf).
5. [Documento desvinculado](05-documento-desvinculado.png). DELETE del vínculo respondió 204; el documento y su archivo permanecieron en el repositorio. Se volvió a vincular antes de la baja para comprobar que sus referencias históricas se conservan.
6. [Motivo insuficiente](06-motivo-corto.png): con cinco caracteres, Confirmar Baja Clínica está deshabilitado. La API también rechaza ese motivo con HTTP 400.
7. [Motivo válido](07-motivo-valido.png), incluyendo comillas, salto de línea y barras invertidas.
8. [Baja realizada](08-historia-dada-de-baja.png): DELETE de la historia respondió 204.
9. [Constancia persistente tras recargar](09-baja-persistente.png): muestra código, fecha, motivo y autor; no ofrece el formulario de edición.
10. [Auditoría de vínculos y baja](10-auditoria-clinica.png), con los eventos CLINICAL_DOCUMENT_LINKED, CLINICAL_DOCUMENT_UNLINKED y CLINICAL_HISTORY_DELETED.
11. [Detalle del evento de baja](11-detalle-auditoria.png), con autor, fecha, identificador y motivo.

Las capturas son del navegador real, controlado con Playwright, sin simular respuestas ni editar imágenes. Los nombres y textos de prueba son sintéticos. La organización se llama HU09 porque se reutilizó la misma preparación local.

## Resultados técnicos

- 52 pruebas seleccionadas aprobadas con Maven: baja y vínculos (11), notas médicas (25), documentos ocultos (2), revisiones (3), concurrencia optimista (3), búsqueda de timeline (5) y permisos de componentes (3).
- Backend empaquetado y ejecutado en el contenedor local; build Angular de producción correcto, con advertencias existentes.
- La baja conserva la fila, sus notas y sus vínculos; guarda deleted_at, deleted_by y deletion_reason. El evento de auditoría se guarda en la misma transacción y su motivo coincide exactamente con el de la fila.
- [Prueba SQL](../../../database/tests/hu11_clinical_history_integrity.sql) aprobada: confirma conservación y coincidencia de la evidencia y bloquea seis mutaciones: DELETE físico, cambiar motivo, quitar baja, modificar auditoría, borrar auditoría y agregar una nota tras la baja. Termina en ROLLBACK.
- Nuevos vínculos, nuevas notas, emisión de un borrador previo y repetición de la baja devuelven HTTP 404 después de dar de baja la historia. [Resultados HTTP](api-results.json).
- La migración 089 se aplicó a la base local central y a la base desechable. No se reescribieron historias existentes al instalarla. Se conservan respaldos previos fuera del repositorio.

Comando de pruebas:

```text
mvn -pl bootstrap -am test -Dtest=ClinicalHistorySoftDeleteTest,MedicalNoteServiceTest,ClinicalHistoryLinkedDocumentsHiddenTest,ClinicalHistoryRevisionTest,ClinicalHistoryOptimisticLockTest,ClinicalHistoryTimelineSearchTest,FormComponentEnforcementTest -Dsurefire.failIfNoSpecifiedTests=false
```

## Cambios y alcance

ClinicalHistoryService valida el paciente del documento y el motivo recortado, serializa JSON mediante Jackson y registra vínculos/desvínculos en auditoría. La nueva consulta /clinical-histories/deletion devuelve la constancia del paciente dentro del tenant autorizado. MedicalNoteService y PatientQuickSummaryService excluyen historias dadas de baja. La migración 089 protege las historias y sus relaciones en PostgreSQL.

La interfaz refleja permisos, muestra errores documentales, permite buscar/paginar documentos y abrir su detalle. La auditoría presenta el motivo de baja. La verificación no cubre todos los módulos ni certifica el aprovisionamiento automático: esta organización usa la preparación de prueba documentada en HU-09. Durante la navegación, settings del tenant sintético respondió HTTP 400; se cerró el aviso del asistente y no bloqueó el circuito clínico comprobado.

El despliegue local actualiza los archivos de los contenedores existentes conservando su configuración. Un despliegue persistente requiere reconstruir las imágenes y aplicar 089 en las bases correspondientes. No se hizo commit, push ni despliegue en AWS.
