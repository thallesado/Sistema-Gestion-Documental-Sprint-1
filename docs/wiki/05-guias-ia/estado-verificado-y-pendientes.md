# Estado verificado y pendientes

> Revisión documental: 2026-10-16. Base de código `a590a6d`; los antecedentes históricos se identifican por separado. No certifica producción.

## Snapshot de esta documentación

| Ámbito | Evidencia al 2026-10-16 |
|---|---|
| Código de referencia | a590a6d integrado desde origin/main al preparar la publicación. Esta documentación se publica en un commit posterior. |
| Wiki | Publicación autorizada por el usuario; consultar el historial git para su commit. No presupone despliegue a EC2. |
| Alcance de publicación | Wiki, entradas de agentes, README, verificador/pruebas y CI documental. Configuración de correo, Dockerfile y auditoría histórica local permanecen aparte. |
| OCR actual | 035 y jobs persistidos disponibles en la revisión de referencia; confirmar migración real por historial de base. |
| EC2 | Antecedente aportado por el usuario: HTTPS 200/308 y certificado Caddy; después 035 con COMMIT. Sin inspección remota actual. |
| Auditoría 2026-10-14 | Foto histórica basada en d1a1202; el OCR remoto ya cambia algunos hallazgos. |

Este snapshot es deliberadamente fechado. No actualizar su revisión automáticamente sin revisar las afirmaciones.

## Discrepancias y evolución del código

- GlobalExceptionHandler devuelve causa SQL interna, pese a convención de no hacerlo.
- El OCR de d1a1202 no persistía confirmación/indexación; a590a6d lo reemplaza con jobs y acciones persistidas. No mantener ese hallazgo como fallo actual.
- Guardar nueva plantilla DRAFT desactiva versión publicada anterior.
- Resumen/timeline de notas no conserva siempre validez real; baja lógica desigual.
- Documentos.patientId y clinical_document_links pueden contradecirse.
- Tipos almacenan esquema/retención/plantilla sin ciclo completo aplicado.
- Compartidos significa autor distinto; reportes siguen siendo demo.
- Proxy de desarrollo alineado con el backend en 8080 (resuelto); pnpm declarado no uniforme.
- Sesiones: revisar identificación de sesión, rollback de revocación, cambio de contraseña e inactividad.
- Almacenamiento MIME no equivale a validación binaria; backups deben incluir archivos.

La auditoría histórica local del 2026-10-14 distinguía 64 recomendaciones con prioridades. Su archivo no forma parte de esta publicación. No todas eran bugs comprobados ni compromisos de alcance. Actualizar resolución por evidencia del código y pruebas, nunca borrando hallazgos para aparentar completitud.

## Evidencia de pruebas históricas

Auditoría 2026-10-14: Maven 46 pasan; Node 35 pasan/1 omitida; typecheck/build Angular pasan; Flutter analyze y 2 widgets pasan. No son resultados de esta revisión de documentación. No se verificó aquí una instalación SQL ni integración real en Docker.

La revisión documental ejecuta el verificador y sus pruebas; el resultado vigente se comunica al terminar, sin prometer salud de producción.

Verificación de publicación 2026-10-16: nueve pruebas del verificador y 18 contratos/107 enlaces pasan. Frontend con Node 22.16 necesita --experimental-strip-types: con esa opción pasan 69 pruebas y se omite una HTTP por falta de APP_URL; sin opción fallan dos archivos que importan TS. No se ejecutaron nuevamente integración SQL, Maven, Flutter ni despliegue como parte de publicar la wiki.
