# Cuatro propuestas de evolución documental

> Revisión documental: 2026-11-17. Referencia: checkout `c0c49ab` más cambios locales. Diseño funcional y técnico propuesto; ninguna de estas cuatro funcionalidades está implementada por este documento.

Se mantienen los números elegidos en la conversación: **1, 4, 5 y 6**. Los identificadores P01/P04/P05/P06 son de propuesta, no nuevas HU oficiales ni números de migración. Todos los nombres, archivos y eventos de las imágenes son ejemplos ficticios.

| Propuesta | Recorrido detallado | Entrada prevista en NexoDocs |
|---|---|---|
| P01. Entrega segura a externos | [Función, reglas e implementación](p01-entrega-externa.md) | Documento → Entregar; Documentos → Entregas externas |
| P04. Buzón documental | [Función, reglas e implementación](p04-buzon-documental.md) | Digitalización → Buzón documental |
| P05. Archivo físico y préstamos | [Función, reglas e implementación](p05-archivo-fisico.md) | Expedientes → Archivo físico |
| P06. Traducción con revisión | [Función, reglas e implementación](p06-traduccion.md) | Documento → Traducciones |

## Imágenes y lectura visual

[Abrir galería de 20 láminas](../../disenos/nuevas-funciones/galeria.html) en el navegador. Cada módulo tiene una imagen de flujo completo y cuatro pantallas conceptuales que agrupan sus pasos. Las imágenes son PNG de 1920 × 1200, con rótulo de propuesta; no son capturas de la aplicación ni pruebas de funcionamiento. [Dossier PDF de 20 páginas](../../disenos/nuevas-funciones/flujos-nexodocs.pdf) para presentar o imprimir.

Los textos y pantallas se generan desde [datos de diseño](../../disenos/nuevas-funciones/flujos.json) mediante [generador local](../../disenos/nuevas-funciones/generar_flujos.py). La galería permite ampliar y recorrer imágenes; no ejecuta API ni simula guardados.

## Qué existe y qué hay que ampliar

| Base existente revisada | Reutilización prevista | Ampliación necesaria |
|---|---|---|
| Document/DocumentVersion, SHA-256, ETag y almacenamiento | Seleccionar versiones y almacenar nuevos archivos mediante servicios existentes | Entregas externas, procedencia de importaciones y documentos derivados |
| JWT, AuthenticatedUserContext, RBAC y RLS | Operadores internos y aislamiento del tenant | Identidad externa acotada para P01; no darle un usuario interno ficticio ni privilegios globales |
| Bases aisladas y LEGACY_SHARED | Enrutar trabajos al tenant registrado | Cola persistente y resolución pública opaca; no confiar en tenantId enviado por el visitante |
| OCR persistido y revisión de metadatos | Procesar adjuntos y extraer texto cuando sea necesario | Ingesta de correo e idempotencia de mensajes/adjuntos |
| GeminiClient.generateText | Posible adaptador de traducción, con validación y consentimiento | Extracción, segmentación, glosario, revisión y generación de copia derivada |
| Auditoría y notificaciones internas | Registrar cambios y avisar tareas | Eventos de externos y custodia física, reintentos de correo y política ante restauraciones |
| Restauración por tenant | Incluir nuevas tablas operativas según su política | No reactivar enlaces revocados ni rebobinar hechos físicos o comunicaciones ya enviadas |

Fuentes locales: [arquitectura Angular](../03-frontend/arquitectura-angular.md), [backend](../02-backend/estructura-spring-boot.md), [RLS](../01-arquitectura/multi-tenancy-y-seguridad-rls.md), [documentos](../04-dominio-y-negocio/documentos-y-almacenamiento.md), [OCR](../04-dominio-y-negocio/digitalizacion-y-ocr.md), [restauraciones](../04-dominio-y-negocio/respaldos-y-restauracion.md). Los servicios existentes son puntos de integración, no una garantía de que acepten directamente estos casos nuevos.

## Reglas de implementación comunes

1. Angular standalone, lazy loading, servicios en `core/api`, componentes por feature y shell existente. Mostrar carga, vacío, fallo, reintento y confirmación real.
2. Spring Boot por las capas actuales. Rutas, DTOs, estados, tablas y permisos de estas propuestas son **nuevos contratos por implementar**.
3. Migraciones futuras con número decidido al implementar. FKs y unicidad por tenant, RLS y grants mínimos. Aplicarlas tanto al control compartido como al bootstrap/upgrade de bases aisladas según corresponda.
4. No usar el worker privilegiado de aprovisionamiento como trabajador de correo/traducción. Crear procesamiento de aplicación sin CREATEDB/BYPASSRLS, con tenant establecido en cada transacción y liberado al terminar.
5. Tareas largas con estado persistido, bloqueo/lease, reintentos limitados e idempotencia; cerrar el navegador no las cancela. No confundir el executor local de respaldos con una cola distribuida.
6. En la EC2 de 1 GB, correo/traducción deben iniciar con concurrencia global 1, límites de lote/páginas y medición real. Usar un trabajador compartido de aplicación o separar recursos si la medición lo exige; no proponer cuatro JVM adicionales como requisito.
7. No guardar credenciales ni textos clínicos en logs o eventos. Configuración sensible cifrada o referenciada a un gestor; no incluir claves en galerías, correo o JavaScript.
8. Una restauración no desenvía un correo, no devuelve un original en papel ni invalida una copia descargada. Diseñar conciliación explícita y conservar evidencia que no se rebobina.

Los ledgers, concesiones y referencias sensibles anteriores requieren una decisión SQL explícita: qué tablas entran en `app.backup_tables()`, cuáles se excluyen de restauración y qué función concilia estados después. No asumir que añadir `tenant_id` basta: la captura actual enumera tablas y podría incluir automáticamente una tabla nueva. Agregar pruebas de captura/restauración y archivado/borrado de tenants para cada módulo.

## Orden recomendado y entregables

| Orden | Entrega verificable | Dependencia principal |
|---|---|---|
| 1 | Archivo físico: ubicación, préstamo, devolución y concurrencia | Catálogos, RBAC, auditoría; sin proveedor externo |
| 2 | Entregas externas: versión fija, portal, vencimiento y revocación | HTTPS y correo de salida confiable |
| 3 | Buzón documental: un conector, cuarentena y aceptación | Proveedor de correo, escaneo de archivos, cola persistente |
| 4 | Traducción: PDF textual, dos idiomas y revisión humana | Proveedor habilitado por tenant, límites de costo y extracción |

No se fija una duración sin estimación del equipo. Puede diseñarse P01 primero si la prioridad es la entrega externa; el orden técnico anterior favorece empezar sin integraciones externas.

## Verificación pendiente

Por cada módulo: pruebas unitarias de estados, integración SQL con runtime y dos tenants (compartido/aislado), API autorizada/denegada, reintento tras reinicio, restauración y recorrido Angular con capturas reales. Proveedores externos requieren pruebas de integración aparte, con datos ficticios. Esta entrega valida documentación, enlaces e imágenes, no esas funciones futuras.

## Referencias de producto

- [Microsoft: enlaces dirigidos a destinatarios específicos](https://learn.microsoft.com/en-us/sharepoint/shareable-links-anyone-specific-people-organization). Referencia para P01; no implica usar Microsoft como proveedor de NexoDocs.
- [Paperless-ngx: uso e incorporación de documentos por correo](https://docs.paperless-ngx.com/usage/). Referencia para P04; no supone desplegar Paperless.
- [Alfresco: metadatos y ubicación física de registros](https://docs.hyland.com/r/Alfresco/Alfresco-Governance-Services/26.2/Alfresco-Governance-Services/Using/Filing-records/Editing-record-metadata?contentId=dySnauAtDDMYwptcsYGRKw). La gestión de préstamos es la adaptación propuesta para NexoDocs.
- [Microsoft: traducción de documentos](https://learn.microsoft.com/en-us/sharepoint/onedrive-document-translation). Referencia para P06; los formatos y límites de ese producto no se trasladan automáticamente a nuestra propuesta.

## Implementacion posterior al diseno

P01, P04 y P05: [rutas reales, pruebas y limites](../04-dominio-y-negocio/operaciones-documentales.md). P06 sigue como propuesta. La galeria muestra el diseno original, no acredita pruebas ni despliegue.
