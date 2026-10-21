# Wiki de NexoDocs: contexto verificable para desarrollo e IA

> Revisión documental: 2026-10-16. Base de código `a590a6d`; antecedentes anteriores identificados por separado. Consultar [estado verificado](05-guias-ia/estado-verificado-y-pendientes.md).

Esta wiki es documentación de referencia contrastada con el código, no una garantía de producción ni sustituto de inspección. Resume el sistema para reducir lecturas repetidas. Si una fuente cambia o contradice una página, identificar la diferencia antes de modificar negocio o seguridad.

**Actualización parcial 2026-10-21:** consultar [cambios locales, puertos y respaldos](06-operacion/cambios-locales-2026-10-21.md). Documenta `8c3dcb8` más cambios sin commit, correcciones de arranque y navegación, y la interfaz de Respaldos aún sin backend. El snapshot de 2026-10-16 se conserva como antecedente; las páginas no revisadas mantienen su alcance histórico.

## Lectura mínima

Integración posterior del 2026-10-21: [15 commits hasta c93a8b4, permisos de sesión y actualización Docker](06-operacion/integracion-main-c93a8b4.md). Incluye los problemas detectados en 048 y la corrección local 049, con límites de las verificaciones.

1. Al empezar: instrucciones aplicables, este índice, git status y estado verificado.
2. Leer una vez las convenciones obligatorias indicadas por el archivo de agente; reutilizarlas durante la sesión.
3. Abrir solo temas y fuentes relacionados con la tarea. No cargar la wiki completa en cada operación.
4. Releer si cambian revisión/instrucciones/archivos relevantes o aparece una contradicción.
5. Al terminar: verificar, actualizar página/contratos afectados y dejar entrega breve.

El código de referencia incluye el OCR persistido y la migración 035. La revisión del código no demuestra el estado de una base o servidor; verificarlos antes de operar. No hacer pull ni descartar cambios como efecto secundario de consultar la wiki.

## Mapa por tarea

[Respaldo completo del host: herramientas preparadas y ensayo pendiente](06-operacion/respaldo-completo.md).

**Implementación local de Respaldos (2026-10-21):** [funcionamiento, permisos, restauración, evidencia y pruebas](04-dominio-y-negocio/respaldos-y-restauracion.md). Esta página sustituye el estado anterior de interfaz sin backend; las notas de integración previas se conservan como historial.

| Tarea | Lecturas |
|---|---|
| Orientación | [Visión general](01-arquitectura/vision-general.md), [convenciones](01-arquitectura/convenciones-y-reglas.md) |
| Backend/API | [Estructura](02-backend/estructura-spring-boot.md), [RLS](01-arquitectura/multi-tenancy-y-seguridad-rls.md), [sesiones](02-backend/autenticacion-y-sesiones.md) si afecta identidad |
| SQL | [Migraciones](02-backend/base-de-datos-y-migraciones.md) y RLS |
| Angular | [Arquitectura](03-frontend/arquitectura-angular.md), [estado/API](03-frontend/estado-y-comunicacion-api.md) |
| Documentos/expedientes | [Almacenamiento](04-dominio-y-negocio/documentos-y-almacenamiento.md), [núcleo por tenant](04-dominio-y-negocio/nucleo-documental-y-tenants.md) |
| Workflows | [Motor y reglas](04-dominio-y-negocio/motor-de-workflows.md) |
| OCR | [Digitalización por revisión](04-dominio-y-negocio/digitalizacion-y-ocr.md) |
| Clínica | [Extensión clínica](04-dominio-y-negocio/modulo-clinico.md) |
| Usuarios, grupos y privilegios | [Grupos y privilegios por componente](04-dominio-y-negocio/usuarios-grupos-y-privilegios.md) |
| Publicación/recuperación | [Operación y HTTPS](06-operacion/despliegue-y-recuperacion.md) |
| Verificación | [Pruebas](05-guias-ia/pruebas-y-validacion.md), [estado/pendientes](05-guias-ia/estado-verificado-y-pendientes.md) |
| Entregar contexto | [Guía de prompts y sesión](05-guias-ia/como-promptear-en-nexodocs.md) |

## Hechos, reglas y pendientes

- **Actual:** comportamiento verificado en fuentes y revisión indicada.
- **Convención:** regla para cambios nuevos; puede existir deuda que no la cumpla.
- **Pendiente/inferencia:** falta implementar o reproducir un efecto; no presentarlo como garantía.
- **Antecedente operativo:** salida aportada por usuario en una fecha, no inspección actual del servidor.

Permisos, nombres SQL, DTOs, rutas, puertos y migraciones deben provenir de sus archivos fuente. No escribir credenciales, datos clínicos, tokens reales ni el contenido de .env. Las instrucciones de agentes de seguridad siguen vigentes.

## Mantenimiento y comprobaciones

Desde raíz:

```text
node scripts/validate-wiki.mjs
node --test scripts/tests/validate-wiki.test.mjs
node scripts/validate-wiki.mjs --include-remote
```

La tercera comprobación necesita objetos git de las revisiones remotas documentadas; las otras no requieren red ni dependencias externas. [verification.json](verification.json) enumera contratos comprobables. Cambiarlo exige revisar la afirmación documentada; no es una sincronización automática de significado.

La CI documental comprueba enlaces y contratos relevantes. No reemplaza pruebas de integración, revisión RLS ni verificación de despliegue. Las fechas y snapshots de este índice se actualizan con revisión humana, no en cada arranque.

## Navegación hacia fuentes generales

[README del proyecto](../../README.md), [contexto histórico](../../CONTEXT.md), [base de datos](../../database/README.md), [workflows](../workflows.md). Estos documentos pueden contener afirmaciones antiguas: seguir enlaces específicos de cada página y registrar discrepancias.
