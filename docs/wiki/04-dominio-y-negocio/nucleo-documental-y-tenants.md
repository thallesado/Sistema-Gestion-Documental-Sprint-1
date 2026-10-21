# Núcleo documental para distintos rubros

> Revisión documental: 2026-10-16. Base de código `a590a6d`; los antecedentes históricos se identifican por separado. No certifica producción.

## Actual frente a diseño

**Actual:** documentos/versiones/expedientes/workflows son entidades generales. DocumentType contiene metadataSchema, plantilla y política de conservación. Workflows admite orígenes DOCUMENT/EXPEDIENT/INDEPENDENT y consulta clinical_module para ciertos casos.

**Pendiente:** validación dinámica de metadataSchema, conservación operativa, acceso compartido por recurso y gates uniformes de capacidades no están completos en la revisión local. No usar las configuraciones almacenadas como prueba de ejecución.

## Convenciones para nuevas funciones

- Mantener clínica opcional. No exigir paciente/especialidad en facturas, contratos o documentos académicos.
- Obtener tenant desde sesión. Cada catálogo debe respetar scoping, permisos y datos propios.
- Usar tipo documental para campos/reglas cuando se implemente, no ramas de código por nombre comercial del tenant.
- Separar rol/permisos de capacidades/plan. Menú oculto no equivale a operación prohibida.
- Suscripción, precios y pagos son solo del administrador del tenant: `PlanController.TENANT_PLAN_ADMIN` (`tenant:update` o `tenant:manage`) protege `GET /plans/my-subscription`, `POST /plans/change`, `POST /plans/enterprise-inquiry` y `/billing/checkout/*` y `/billing/my-invoices`; el catálogo `GET /plans` sigue público para la bienvenida. En la web, `SubscriptionService.canManage` (`TENANT_PLAN_ADMIN` en `permission-rules.ts`) oculta el botón de plan, la insignia de prueba, el widget de uso y el modal, y la ruta `/billing` usa `hasPermissionGuard`. El interceptor no abre el modal por errores de `/api/v1/plans` (antes un 403 ahí lo reabría en bucle).
- Vínculos con terceros/clientes/proveedores son propuestas de ampliación, no un módulo existente.
- No generar datos demo para llenar estadísticas ni duplicar un workflow con lógica local.

Ejemplos de configuración futura, sin afirmar implementación: Contrato -> contraparte/vencimiento; Factura -> proveedor/importe; Certificado -> estudiante/gestión; Informe clínico -> paciente/servicio.

Escenario transversal de aceptación: dos tenants con tipos/catálogos distintos pueden crear, revisar y consultar documentos sin exponer filas, versiones o archivos del otro. Las pruebas deben utilizar roles reales del patrón RLS.

Fuentes: [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/model/DocumentType.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/model/DocumentType.java), [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/DocumentTypeService.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/DocumentTypeService.java), [backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/WorkflowEngineService.java](../../../backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/WorkflowEngineService.java). [Documentos](documentos-y-almacenamiento.md).
