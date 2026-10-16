<!-- BEGIN AWS Agent Toolkit rules -->
# AWS Guidance
- Where these AWS rules conflict with the project's own instructions, the
  project's instructions take precedence.
- Prefer the AWS MCP Server for AWS interactions — it provides sandboxed
  execution, observability, and audit logging. If unavailable, use the
  AWS CLI directly.
- Before starting a task, check whether a relevant AWS skill is available.
  Load the skill with `retrieve_skill` and prefer its guidance over
  general knowledge.
- When uncertain about specific AWS details (API parameters, permissions,
  limits, error codes), verify against documentation rather than guessing.
  State uncertainty explicitly if you cannot confirm.
- When creating infrastructure, prefer infrastructure-as-code (AWS CDK or
  CloudFormation) over direct CLI commands.
- When working with infrastructure, follow AWS Well-Architected Framework
  principles.
- Do not use em dashes in AWS resource names or descriptions. Use
  hyphens instead.

## Secret Safety

- MUST load the `aws-secrets-manager` skill first for any secret,
  credential, API key, token, or password task. MUST NOT call
  `secretsmanager get-secret-value` or `batch-get-secret-value`, and MUST
  NOT hit the Secrets Manager Agent daemon directly. MUST use
  `{{resolve:secretsmanager:secret-id:SecretString:json-key}}` with
  `asm-exec` so the secret resolves at runtime without entering context.
<!-- END AWS Agent Toolkit rules -->

# NexoDocs Architecture & Wiki
Antes de realizar tareas o proponer cambios en el proyecto, consulta la wiki oficial en `docs/wiki/README.md`.
Respeta rigurosamente las convenciones documentadas en:
- `docs/wiki/01-arquitectura/convenciones-y-reglas.md`
- `docs/wiki/01-arquitectura/multi-tenancy-y-seguridad-rls.md`
- `docs/wiki/02-backend/estructura-spring-boot.md`
- `docs/wiki/03-frontend/arquitectura-angular.md`

## Protocolo de contexto y mantenimiento
- Lee el índice y las convenciones anteriores una vez al comenzar; conserva ese contexto durante la sesión.
- Después consulta solo los temas y las fuentes afectados. Relee si cambian instrucciones, revisión o archivos relevantes.
- Antes de editar revisa `git status -sb`; conserva cambios locales y distingue checkout, snapshot remoto y estado del servidor.
- La wiki es una referencia verificada, no reemplaza el código. Si difieren, informa la discrepancia y distingue implementación, convención y pendiente.
- No asumas que la siguiente migración tiene un número fijo ni que un resultado histórico sigue vigente.
- Al cambiar comportamiento, actualiza la página pertinente y sus contratos de `docs/wiki/verification.json`.
- Verifica documentación con `node scripts/validate-wiki.mjs` y usa `--include-remote` si dispone de los snapshots git documentados.
- Deja una entrega breve con revisión, archivos, pruebas reales y pendientes según `docs/wiki/05-guias-ia/como-promptear-en-nexodocs.md`.
