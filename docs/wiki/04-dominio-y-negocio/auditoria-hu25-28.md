# Auditoria funcional local de HU-25 a HU-28

> Revisión documental: 2026-11-18. Checkout `4d7c663` mas cambios locales sin commit. Entorno operativo inspeccionado: localhost:4201. Pruebas de escritura sobre fixtures y PostgreSQL desechable; sin cambios ni inspeccion actual de AWS. No constituye una auditoria exhaustiva de seguridad.

## Dictamen

Los flujos principales de las cuatro HU funcionan en el alcance implementado descrito abajo. No se encontraron bloqueos funcionales en los recorridos probados. Puede cerrarse ese alcance de desarrollo y demostracion local; no se acredita el cumplimiento integral de todas las ampliaciones de las propuestas originales ni una puesta en produccion.

HU-28 se evalua con la modificacion expresa del usuario: recepcion automatica y descarga, sin antivirus, revision humana ni incorporacion documental. HU-27 se evalua como MVP para PDF con texto, no como traductor general de todos los formatos.

| HU | Recorrido comprobado | Resultado y limite de cierre |
|---|---|---|
| HU-25, entregas externas | Documento aprobado/version exacta, encolado SMTP, codigo de acceso, sesion acotada, contenido, revocacion, token alterado y fallo SMTP | Funcional local. SMTP/OTP completos con GreenMail en esta auditoria. Evidencia anterior de Mailgun aceptando LINK/CODE; no se repitio entrega real ni se verifico aqui la bandeja de un destinatario externo. |
| HU-26, archivo fisico | Ficha/ubicacion, solicitante y custodio separados, reserva exclusiva, entrega, devolucion, incidencia, conciliacion, cancelacion, recordatorios y recuperacion de evidencia | Funcional local. Dos ciclos de navegador con API real; concurrencia, roles, aislamiento y restauracion por ZIP/API probados. No certifica movimiento material del papel. |
| HU-27, traduccion | Fuente verificada, consentimiento, traduccion, revision por otra persona, revision obsoleta, publicacion unica de copia derivada y fallo de proveedor | Funcional como MVP PDF con texto, hasta 10 paginas y 20.000 caracteres. Proveedor simulado en las pruebas nuevas; se contrasto el informe local de dos ciclos anteriores publicados con Gemini real y original sin cambios. No es validacion profesional de calidad linguistica. |
| HU-28, buzon | IMAP, recepcion sin escaner, procedencia, deduplicacion, descarga de bytes originales, detalle y acciones visibles | Funcional con alcance reducido. API real y Chromium prueban `RECEIVED` / `NOT_SCANNED`, descarga PDF, ausencia de revision/escaner y bloqueo de acciones antiguas. La evidencia Gmail anterior se conserva; no se envio otro correo real en esta auditoria. |

## Pruebas ejecutadas de nuevo

- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/tests/document-operations.ps1 -Browser`: **23 pruebas, cero fallos, cero errores y cero omitidas**. Runtime NOSUPERUSER/NOBYPASSRLS y dos tenants sinteticos en base compartida. Incluye `HU26_BROWSER_OK`, `DOCUMENT_OPERATIONS_BROWSER_OK` y `HU28_RECEIVE_BROWSER_OK`.
- `mvn -q -pl bootstrap -am -Dtest=MailboxGatewayProgressTest,GeminiClientTest,TranslationSourceExtractorTest -Dsurefire.failIfNoSpecifiedTests=false test`, desde backend: **13 pruebas, cero fallos/errores/omitidas** (1 IMAP/progreso, 8 cliente Gemini, 4 extraccion PDF). Gemini usa HTTP de laboratorio.
- `pnpm --dir frontend test`: **224 aprobadas, cero fallos, una omitida**, sobre 225 pruebas.
- `powershell -NoProfile -ExecutionPolicy Bypass -File database/tests/run.ps1`: **DATABASE_TESTS_OK**. Inicializacion limpia, bootstrap tenant aislado, actualizacion con conservacion/idempotencia, rechazo y rollback de datos incompatibles, runtime restringido y versiones concurrentes.
- `node scripts/validate-wiki.mjs --include-remote`: correcto; comprobar el recuento actualizado en la salida final del comando. Los snapshots disponibles permiten verificar contratos documentados, no el estado actual de un servidor remoto.

Los logs completos de esta auditoria quedan en el directorio temporal del operador: `nexodocs-four-hu-audit-integration.log`, `nexodocs-four-hu-audit-sql.log`, `nexodocs-four-hu-audit-focused.log` y `nexodocs-four-hu-audit-frontend.log`. Los informes Maven estan en `backend/bootstrap/target/surefire-reports`. No incluyen credenciales reales en este documento.

## Evidencia visual y fuentes

Se agrego una prueba especifica de navegador, [mail-intake-receive-browser.cjs](../../../scripts/tests/mail-intake-receive-browser.cjs), contra el backend real del entorno desechable. No simula las respuestas de la API. El token sintetico entra por stdin y no se imprime. Comprueba el nombre del archivo descargado y su cabecera PDF, ausencia de Revisar e Incorporar, y estado Recibido.

- [HU-28: bandeja sin escaner](../../evidencias/hu28/01-recepcion-sin-escaner.png).
- [HU-28: detalle y descarga](../../evidencias/hu28/02-detalle-y-descarga.png).
- [HU-28: vista movil](../../evidencias/hu28/03-recepcion-movil.png).
- [HU-26: permisos, recorridos y capturas](archivo-fisico-y-prestamos.md).
- [HU-27: evidencia anterior con Gemini real](traduccion-pruebas-locales.md) y [resultado estructurado](../../evidencias/hu27/resultado-verificacion.json).
- [Contratos, configuracion y antecedentes de correo real](operaciones-documentales.md).
- [Suite de integracion](../../../backend/bootstrap/src/test/java/com/lta/gestdocum/backend/service/DocumentOperationsIntegrationTest.java).

## Estado del entorno operativo

Se inspeccionaron solo nombres/indicadores de configuracion y estados, sin imprimir secretos: localhost:4201 usa `nexodocs-hu28-backend`, worker habilitado, modo solo recepcion habilitado y perfiles IMAP/SMTP/Gemini presentes. Estan registradas las migraciones 092 a 101, incluidas las dos 098 de nombres distintos. Hay dos traducciones PUBLISHED y una pendiente en FinoCode; no se modificaron ni se publico la pendiente. La existencia de una clave no acredita conectividad actual con un proveedor.

El routing del entorno 4201 esta desactivado. Las pruebas funcionales entre tenants usan RLS en base compartida; el bootstrap SQL de una base aislada paso, pero eso no demuestra los cuatro recorridos completos de aplicacion sobre dos bases aisladas.

## Limites que no deben darse por terminados

1. **EC2:** falta desplegar y repetir arranque, configuracion, migraciones, HTTPS y recorridos externos. La auditoria no toca AWS ni certifica capacidad de la instancia de 1 GB.
2. **Correo externo:** Mailgun sandbox tuvo restricciones de destinatario en la prueba anterior. Hace falta confirmar entrega real y acceso del destinatario en el entorno final; SMTP_ACCEPTED no significa leido ni entregado en bandeja.
3. **Traduccion ampliada:** DOCX, segmentacion granular, reanudacion automatica y politicas del proveedor por tenant siguen fuera del MVP actual. Ver la propuesta P06 antes de prometer cumplimiento completo. La traduccion no es certificada.
4. **Antivirus:** retirado del flujo vigente por decision del usuario. No bloquea el cierre del nuevo alcance de HU-28, pero no puede anunciarse analisis antimalware ni cumplimiento de su alcance original de revision/incorporacion.
5. **Recuperacion de infraestructura:** el ZIP de tenant no exporta de forma portable completa entregas, ledger de recepcion y traducciones con todos sus archivos. Se necesita respaldo de base, almacenamiento y clave. HU-26 si dispone de recuperacion de evidencia fisica probada, sin rebobinar custodia posterior.
6. **Progreso y replicas:** el detalle de bytes de descarga es transitorio por backend; el estado del lote es persistido. No se verifico un despliegue con varias replicas ni una prueba de carga sostenida.

No se hizo commit, push ni despliegue como parte de esta auditoria. Los cambios locales previos se conservaron. La entrega final debe expresar cierre funcional local del alcance indicado, no «100% de todas las propuestas en produccion».
