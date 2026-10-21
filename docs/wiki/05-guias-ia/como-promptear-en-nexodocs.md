# Contexto mínimo para IA y entrega de sesión

> Revisión documental: 2026-10-16. Base de código `a590a6d`; los antecedentes históricos se identifican por separado. No certifica producción.

## Lectura por demanda

Al comenzar: instrucciones aplicables, [índice](../README.md), git status y [estado verificado](estado-verificado-y-pendientes.md). Las cuatro convenciones enlazadas desde AGENTS/CLAUDE/GEMINI siguen siendo obligatorias cuando se trabaja en sus áreas; leerlas una vez y reutilizar ese contexto dentro de la sesión.

Después abrir solo el tema y las fuentes de la tarea. No releer toda la wiki antes de cada edición. Releer si cambian rama/revisión, instrucciones, archivos fuente relevantes o se detecta contradicción. No confundir caché de contexto con permiso para dejar de inspeccionar código afectado.

## Prompt recomendado

```text
Trabajaremos en NexoDocs para [objetivo].
Consulta docs/wiki/README.md y la guía del área.
Revisa git status y las fuentes afectadas antes de editar.
Indica qué revisión estás usando y cualquier discrepancia.
Conserva cambios ajenos y el aislamiento tenant.
Implementa el cambio mínimo, verifica lo afectado y actualiza su documentación.
No migres datos, publiques ni despliegues sin autorización aplicable.
```

No exigir generar entidad/repositorio/controlador para cualquier endpoint: reutilizar los existentes. Para SQL no fijar número de migración en el prompt; inspeccionar local/remoto primero.

`@archivo` es una convención de algunos editores, no garantía de lectura universal. Un asistente sin acceso al repositorio necesita el fragmento mínimo pertinente; no adjuntar .env ni credenciales.

## Entrega breve entre sesiones

```text
Objetivo y alcance:
Rama / revisión / cambios locales:
Hecho y archivos afectados:
Pruebas ejecutadas y resultados reales:
Pendientes, bloqueos y próximo paso:
Documentación actualizada:
```

La entrega debe describir resultados, no copiar conversaciones ni datos personales. No usar una entrega antigua como estado actual de EC2.

## Mantenimiento

En un cambio funcional actualizar página(s), referencias y verification.json si se modificó un contrato intencionalmente. Ejecutar verificador. Sus asserts son alertas estructurales y no sustituyen pruebas de negocio ni revisión humana.

[Pruebas](pruebas-y-validacion.md), [pendientes](estado-verificado-y-pendientes.md).
