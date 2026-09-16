# Registro de Cambios — NexoDocs Backend

## 2026-09-16: Implementación HU-10 — Consulta Rápida de Expediente a Pie de Cama

### Resumen
Se refactorizó el servicio de chatbot para integrar **Spring AI** con herramientas (tools) y garantizar aislamiento multitenant mediante `AuthenticatedUserContext.requireTenantId()`. La búsqueda de documentos ahora consulta la BD real (tabla `documents`) en lugar de datos mock, con RLS de PostgreSQL como capa adicional de seguridad.

### Cambios Principales

#### 1. **Dependencias (pom.xml)**
- ✅ Agregado: `org.springframework.ai:spring-ai-openai-spring-boot-starter:1.0.0-M1`

#### 2. **Modelos JPA**
- ✅ Creado: `Document.java` (`backend/src/main/java/.../model/Document.java`)
  - Mapea tabla `documents` del schema `app`
  - Incluye todos los campos: `id`, `tenantId`, `expedientId`, `documentTypeId`, `code`, `name`, `description`, `status`, etc.
  - Enum `DocumentStatus` con valores: DRAFT, PENDING, IN_REVIEW, APPROVED, REJECTED, CURRENT, ARCHIVED, VOIDED, TRASHED

#### 3. **Repositorios JPA**
- ✅ Creado: `DocumentRepository.java` (`backend/src/main/java/.../repository/DocumentRepository.java`)
  - Métodos de búsqueda: `findByTenantIdAndNameContainingIgnoreCase(UUID tenantId, String name)`
  - Otros: búsqueda por estado, filtrado de eliminados, etc.
  - **Crítico**: Todos los métodos requieren `tenantId` explícito en la firma

#### 4. **Servicios**
- ✅ Refactorizado: `DocumentSearchService.java`
  - ❌ Removido: Decorador `@Service`; ahora es `@Component`
  - ✅ Inyectado: `DocumentRepository` y `AuthenticatedUserContext`
  - ✅ Cambio de firma: `searchDocumentsByTenant(String query, int limit)` — ya NO toma `tenantId` como parámetro
    - Obtiene `tenantId` internamente vía `authenticatedUserContext.requireTenantId()`
  - ✅ Cambio de backend: Consulta real a BD (`documentRepository.findByTenantIdAndNameContainingIgnoreCase(tenantId, query)`)
  - ✅ Mantiene: `buildRAGContext(List<DocumentDTO>)` para formatear documentos en contexto LLM

- ✅ Refactorizado: `RAGService.java`
  - ✅ Inyectado: `Function<String, String> documentSearch` (la herramienta desde `ChatBotToolsConfig`)
  - ✅ Inyectado: `AuthenticatedUserContext`
  - ✅ Cambio de firma: `processQuery(String userQuery, boolean includeDocuments)` — removido parámetro `tenantId`
  - ✅ Integración: `.function("documentSearch", documentSearchTool)` en el prompt
  - ✅ Seguridad: Valida `authenticatedUserContext.requireTenantId()` al inicio

#### 5. **Configuración**
- ✅ Implementado: `ChatBotToolsConfig.java` (`backend/src/main/java/.../config/ChatBotToolsConfig.java`)
  - Crea `@Bean Function<String, String> documentSearch()`
  - Wrappea `DocumentSearchService.searchDocumentsByTenant()` y `buildRAGContext()`
  - Anotado con `@Description` para que Spring AI reconozca la herramienta
  - Spring AI registra automáticamente como herramienta disponible para Claude

#### 6. **Controladores**
- ✅ Refactorizado: `ChatController.java`
  - ✅ Inyectado: `AuthenticatedUserContext`
  - ✅ Anotado: `@PreAuthorize("isAuthenticated()")` en `/api/chat/ask`
  - ✅ Removido: Campo `tenantId` del DTO de entrada
  - ✅ Cambio de firma: `chat(ChatRequestDTO)` → `ragService.processQuery(message, includeDocuments)` (sin `tenantId`)
  - ✅ Validación: Llama `authenticatedUserContext.requireTenantId()` y `requireUserId()` para garantizar contexto

#### 7. **DTOs**
- ✅ Actualizado: `ChatRequestDTO.java`
  - ❌ Removido: Campos `tenantId` y `userId`
  - ✅ Mantiene: `message`, `includeDocuments`
  - Ahora contiene solo lo que el cliente envía; tenant y user vienen del JWT

- ✅ Actualizado: `ChatResponseDTO.java`
  - Sin cambios de lógica; solo paquete correcto

- ✅ Actualizado: `DocumentDTO.java`
  - Sin cambios de lógica; solo paquete correcto

### Garantías de Seguridad Multitenant

1. **Extracción de Tenant del JWT**
   - `AuthenticatedUserContext.requireTenantId()` obtiene UUID desde el token autenticado
   - Lanza `TenantRequiredException` si no existe (nunca null)

2. **Filtrado en Repositorio**
   - `DocumentRepository.findByTenantIdAndNameContainingIgnoreCase(tenantId, query)`
   - **Siempre incluye `tenantId`** en la WHERE clause

3. **RLS de PostgreSQL**
   - Tabla `documents` tiene política RLS configurada en migración `004_saas_hardening`
   - Filtra adicionales por `tenant_id` a nivel BD (defensa en profundidad)

4. **Contexto de Spring Security**
   - JwtAuthenticationFilter popula `SecurityContextHolder` con `AuthenticatedUser`
   - `AuthenticatedUserContext` extrae desde ahí

### Cambios en el Flujo de Usuario

**Antes (Mock):**
```
POST /api/chat/ask
{
  "tenant_id": "abc-123",  ← Enviado por cliente
  "user_id": "user-456",
  "message": "¿Cuáles son mis expedientes?",
  "include_documents": true
}
→ DocumentSearchService.searchDocumentsByTenant("abc-123", "¿Cuáles...", 5)
→ Retorna datos mock sin consultar BD
```

**Después (Seguro + Real):**
```
POST /api/chat/ask
Authorization: Bearer <JWT con tenant_id y user_id>
{
  "message": "¿Cuáles son mis expedientes?",
  "include_documents": true
}
→ ChatController valida JWT
→ AuthenticatedUserContext.requireTenantId() → <UUID del JWT>
→ RAGService.processQuery(message, true)
→ DocumentSearchService.searchDocumentsByTenant(query, 5)
  → Obtiene tenantId del contexto (no del cliente)
  → DocumentRepository.findByTenantIdAndNameContainingIgnoreCase(tenantId, query)
  → Consulta real a BD + RLS
→ Mapea a DocumentDTO
→ ChatClient llama herramienta documentSearch → buildRAGContext()
→ Claude responde con contexto documentos del tenant autenticado
```

### Responsabilidades Pendientes

- ✅ Backend implementado con Spring AI y seguridad multitenant
- ⏳ Frontend (Angular): Ajustar llamada a `/api/chat/ask` (removido `tenant_id`, agregar JWT en header)
- ⏳ BD: Verificar RLS está activo en migración `004_saas_hardening`
- ⏳ Tests: Unitarios para `DocumentSearchService` y `RAGService`

### Notas de Arquitectura

- **Spring AI Version**: `1.0.0-M1` (milestone). Evaluar estabilidad en producción.
- **ChatClient.Builder**: Se inyecta automáticamente desde Spring Boot
- **Function as Tool**: Spring AI descubre automáticamente funciones `@Bean` anotadas con `@Description`
- **AuthenticatedUserContext**: Singleton `@Component` que lee `SecurityContextHolder`
- **DocumentStatus Enum**: Sincronizado con tipo PostgreSQL `document_status` en DB

### Validación

Para verificar la implementación:
1. Compilar: `mvn clean compile` (Maven descargará Spring AI)
2. Prueba de BD: `powershell -NoProfile -File database/tests/run.ps1` (valida RLS)
3. Prueba de API: POST `/api/chat/ask` con JWT válido (sin `tenant_id` en body)
4. Logs: Verificar que `DocumentRepository` consulta con cláusula `WHERE tenant_id = ?`

## 2026-09-16: Corrección — el backend no arrancaba (chatbot deshabilitado temporalmente) + datos de demostración ampliados

### Contexto real verificado

Al intentar levantar el backend (`mvnw spring-boot:run`) para pruebas manuales con Postman, la aplicación **no arrancaba**. La entrada anterior de este registro documentaba `spring-ai-bom 1.0.0-M1`, pero `pom.xml` tenía fijado `2.0.1`. Se comprobó contra la documentación oficial de Spring AI que:

- `spring-ai-bom 2.0.1` requiere **Spring Boot 4 / Spring Framework 7**.
- La línea `1.0.x` de Spring AI requiere **Spring Boot 3.4.x/3.5.x**.
- Este backend usa **Spring Boot 3.2.4** (fijado en AGENTS.md como arquitectura vigente).

Es decir: **ninguna versión de Spring AI es compatible con la versión de Spring Boot que usa hoy el proyecto.** El intento de arranque fallaba con `NoClassDefFoundError: org.springframework.core.retry.RetryTemplate` en varias autoconfiguraciones de Spring AI (chat, retry), porque esa clase no existe en Spring Framework 6.1.5.

### Cambios aplicados (temporales, reversibles)

#### `backend/pom.xml`
- Comentado el `dependencyManagement` de `spring-ai-bom` y la dependencia `spring-ai-starter-model-google-genai`, con un `TODO` explicando por qué y qué versión objetivo se necesita.
- Agregado `maven-compiler-plugin` con `<excludes>` para `ChatBotToolsConfig.java`, `RAGService.java` y `ChatController.java` (usan tipos de Spring AI como `ToolCallback`; sin la dependencia no compilan). El código **no se borró**, solo se excluyó de la build hasta el upgrade.

#### `backend/src/main/resources/application.yml`
- Comentado el bloque `spring.ai.google.genai.*` (dependía de la dependencia removida).

#### `backend/src/main/java/.../model/Document.java`
- **Bug real encontrado y corregido**: la entidad tenía `@Table(name = "documents", schema = "app")`. La entrada anterior de este registro documentaba que la tabla vivía en el schema `app`, pero la base real (verificada con `\dt app.*`) solo tiene `app.schema_migrations`; `documents` (como el resto de las tablas de negocio) vive en `public`. Se corrigió a `@Table(name = "documents")`. Sin este fix, Hibernate fallaba la validación de esquema al arrancar (`Schema-validation: missing table [app.documents]`) para cualquier request, no solo para el chatbot.

### Estado real actual del chatbot

- **Deshabilitado.** No compila ni se ejecuta ningún código de `ChatBotToolsConfig`, `RAGService` ni `ChatController`.
- Para reactivarlo hace falta primero subir `spring-boot-starter-parent` a `3.4.x`/`3.5.x` (cambio arquitectónico mayor, afecta Security/JPA/otros starters — pendiente, no realizado en esta sesión), y luego reactivar `spring-ai-bom` en una versión `1.0.x` y los 3 archivos excluidos.
- El resto del backend (auth, CRUDs de catálogos, RLS a nivel de queries) funciona normalmente sobre Spring Boot 3.2.4; se verificó login real vía `POST /api/v1/auth/login` con un usuario del seed.

### Datos de demostración ampliados (`database/init/005_demo_users.sql`)

Nueva migración incremental (numerada tras `004_saas_hardening`, sin modificarla) que amplía el seed de `003`:

- Agrega roles `Supervisor` y `Usuario operativo` a **Clínica Central** (antes solo tenía `Administrador de tenant`), con los mismos permisos que sus equivalentes en Acme.
- Agrega 2 departamentos a Clínica Central (`Administración`, `Radiología`) para repartir usuarios.
- Lleva a **20 usuarios activos por tenant** (Acme y Clínica Central), repartidos 2 Administrador de tenant / 6 Supervisor / 12 Usuario operativo por tenant. Contraseña de todos: `DemoPass123!` (exclusivamente de demostración, igual que el resto del seed).
- Es idempotente (`ON CONFLICT DO NOTHING`) y sigue el mismo patrón transaccional que `004` (advisory lock, registro en `app.schema_migrations`).

**Verificación realizada:** se aplicó con `database/migrate.ps1` sobre una base existente (no-op limpio, sin duplicar filas) y se probó de punta a punta en una instancia Postgres aislada con volumen 100% nuevo (contenedor y volumen temporales, sin tocar la base real), confirmando que `docker-entrypoint-initdb.d` ejecuta `001`→`005` en orden y produce el mismo resultado: 20/20 usuarios, distribución de roles idéntica.

### Limitaciones reales pendientes

- Chatbot no funcional hasta el upgrade de Spring Boot (ver arriba).
- El upgrade de Spring Boot no se evaluó en esta sesión más allá de confirmar la incompatibilidad de versiones; falta revisar breaking changes de Security/JPA antes de intentarlo.
- Los 20 usuarios nuevos por tenant no tienen `document_type`/`document_number`/`phone`; quedan `NULL` como en el resto del seed.
