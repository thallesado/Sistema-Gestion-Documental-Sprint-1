# Convenciones y reglas

> Revisión documental: 2026-10-16. Base de código: `a590a6d`; ver [estado verificado](../05-guias-ia/estado-verificado-y-pendientes.md). Descripción del código inspeccionado, no certificación de producción.

## Alcance y precedencia

Respetar las instrucciones del usuario y los archivos de instrucciones aplicables. Esta wiki documenta contratos y convenciones; si el código discrepa, comunicarlo, no inventar compatibilidad ni implementar el error de la documentación. Distinguir **actual**, **regla para cambios nuevos** y **pendiente**.

## Antes y después de editar

- Revisar `git status -sb`; conservar cambios ajenos. No hacer pull, commit, push ni desplegar como efecto secundario de una tarea documental.
- Leer el índice y los temas relevantes una vez por sesión; contrastar archivos afectados. Releer si cambian fuentes o revisión.
- Realizar cambios acotados, reutilizar servicios/componentes y verificar lo afectado.
- No borrar datos/volúmenes ni usar reinicialización para solucionar migraciones. Inspeccionar y respaldar primero.
- No abrir ni imprimir secretos. Documentar nombres de variables sin valores reales. Las instrucciones de Secret Safety de los archivos de agentes siguen vigentes; no sustituir sus mecanismos silenciosamente.

## Backend y SQL

- Implementar negocio en `backend/bootstrap/.../backend` por capas existentes; no poblar scaffold modular sin una tarea explícita de arquitectura.
- DTOs con validación y permisos reales; `@PreAuthorize` y reglas de negocio en servidor. No inventar permisos por similitud.
- Operaciones tenant dentro de transacción, con `requireTenantId()` y `establishDatabaseContext()`; consultar [RLS](multi-tenancy-y-seguridad-rls.md).
- RLS no se activa por anotar una entidad JPA. Crear migración con políticas, grants y claves compuestas.
- No editar migraciones aplicadas. Calcular siguiente número desde los archivos actuales y ramas compartidas; el identificador es el nombre completo.
- Usar `GlobalExceptionHandler`. **Regla:** no exponer errores SQL. **Discrepancia actual:** su handler DataAccessException todavía devuelve la causa; ver pendientes.
- CORS requiere orígenes explícitos, sin `*`; el constructor valida la configuración, no solo el perfil prod.

## Frontend y documentos

- Componentes standalone, lazy loading y organización por feature. Preferir signals/inject según patrones existentes; no introducir NgModule.
- Reutilizar clientes HTTP; contratos alineados con Java. No asumir que todos los DTOs viven en shared.
- Mostrar carga, vacío, error y reintento; no sustituir fallos por datos demo ni anunciar persistencia sin confirmación del servidor.
- Nuevo archivo documental: versión, motivo y SHA-256 mediante servicio existente; formatos y límites según la operación.
- Autorización de backend y RLS prevalece sobre botones/guards. No dar acceso transversal por ser administrador de plataforma.

## Mantenimiento de esta wiki

Actualizar comportamiento, fuentes y revisión de la página afectada junto con el cambio. No copiar resultados históricos de pruebas como ejecución reciente. Ejecutar `node scripts/validate-wiki.mjs`; consultar [pruebas](../05-guias-ia/pruebas-y-validacion.md).
