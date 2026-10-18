# Tareas de Edixon: consultas dinámicas, idiomas y voz

Carga estimada: 10 días. Migraciones reservadas: 045 y 046. Lee antes `README.md`. En git aparece como `elkin`.

Orden recomendado: D2, luego E1 y, si el tiempo lo permite, D4. D4 depende de D2.

## D2. Consultas dinámicas por ejemplo, QBE (requisito 4, P1, 3 días)

### Qué pide el docente

Un segundo nivel de reportes en el que el desarrollador no sabe de antemano qué columnas ni qué criterios querrá el usuario. El usuario los indica en un formulario "por ejemplo" ("productos con precio mayor a 15") y el sistema construye la consulta. Es la técnica clásica de Query By Example.

### Qué ya existe

Nada: ni componente en el frontend ni endpoint en el backend.

### Qué implementar

1. **Catálogo permitido** en el backend: lista de entidades y columnas consultables (documentos, expedientes, usuarios, tareas de flujos de trabajo, digitalizaciones OCR). Pacientes y datos clínicos solo con el permiso correspondiente. Nada fuera del catálogo.
2. `POST /api/v1/queries/run` recibe una definición en JSON:
   `{ entity, columns[], filters[{field, op, value}], sort, limit }` y la compila con parámetros (JPA Criteria o un generador propio con consultas parametrizadas). **Nunca SQL escrito por el usuario.** Aplicar el contexto del tenant (RLS), el permiso de lectura de cada entidad, un límite de filas y un tiempo máximo.
3. Guardar y reutilizar consultas con nombre (tabla `saved_queries`, migración 045).
4. Frontend en `features/reportes/qbe/`: una cuadrícula estilo QBE donde cada columna admite un criterio de ejemplo (`> 15`, `= 'APPROVED'`, `entre`), con selección de columnas, orden y resultados en tabla con exportación a CSV.

### Criterio de aceptación

Sin escribir SQL, un usuario consulta "documentos aprobados del último mes del área Legal" y obtiene la tabla. Un intento de pedir una columna fuera del catálogo o inyectar texto en un valor es rechazado. Tests de la compilación y de los rechazos.

## E1. Idiomas (requisito 5, P1, 2 días)

### Qué pide el docente

Si el sistema es para todo el mundo, debe poder cambiar el idioma. La zona horaria, la moneda y los colores los hace Mauricio (E2).

### Qué ya existe

Nada. `package.json` no incluye ninguna librería de traducción y todos los textos están escritos en español en el código.

### Qué implementar

1. Elegir una librería de traducción **en tiempo de ejecución** (por ejemplo `@ngx-translate/core` o Transloco). `@angular/localize` genera una compilación por idioma y no permite cambiar en caliente. Verifica antes la compatibilidad con Angular 20.
2. `TranslationService` (el vacío lo deja el PR 0) y archivos `assets/i18n/es.json` y `en.json`.
3. Alcance de esta tarea: la infraestructura, más el shell, el inicio de sesión, el menú, la pantalla de OCR y el centro de ayuda. **No hace falta traducir todo el sistema ahora.** Cada persona añade las claves de sus pantallas nuevas.
4. Selector de idioma en la barra superior. El idioma se guarda en el perfil del usuario (`users.preferred_language`, que crea Mauricio en la migración 038) y en `localStorage`, y por defecto sale del tenant (`default_language` de `/tenants/current/settings`).
5. El backend ya devuelve un campo `code` en sus errores: traducir los mensajes de error en el frontend a partir de ese código.

### Criterio de aceptación

Al cambiar a inglés cambian el menú, el inicio de sesión, la pantalla de digitalización y los mensajes de error conocidos. La preferencia sobrevive a recargar y a cerrar sesión.

### Coordinación

Acuerda con Mauricio el contrato de `/tenants/current/settings` antes de que él lo implemente. Para no generar conflictos, no edites `shell/app.ts` ni `app.html`: usa el servicio que deja el PR 0.

## D4. Reportes por voz (requisito 4, P3 opcional, 5 días)

### Qué pide el docente

Un cuarto nivel: pedir el reporte hablando, sin tocar el teclado. Mencionó un agente conectado por MCP a la base de datos o herramientas como n8n, con una advertencia: un agente con acceso libre puede destruir la base de datos. Lo presentó como difícil (dudoso si es obligatorio: confirmarlo).

### Diseño recomendado

El agente **nunca escribe SQL**: solo produce una definición de consulta de D2. Así la frontera de seguridad es el motor de consultas, que ya es de solo lectura por construcción. Es el equivalente a una "herramienta" de MCP limitada a leer.

### Qué implementar

1. Frontend: `features/reportes/voice/` con la Web Speech API (`SpeechRecognition`, disponible en Chrome y Edge; requiere HTTPS, que ya tenemos). Mostrar la transcripción.
2. Backend: `POST /api/v1/reports/voice` recibe el texto, usa el `GeminiClient` (lo extrae Diego en la tarea G0) para convertirlo en una definición de consulta con un esquema JSON estricto, y la valida con el motor de D2.
3. **Confirmación antes de ejecutar:** mostrar "Entendí: documentos aprobados del último mes. ¿Ejecutar?".
4. Defensa adicional: un rol de base de datos de solo lectura (`nexodocs_reader`, migración 046) con acceso solo a los objetos del catálogo, usado por el motor de consultas.

### Criterio de aceptación

Decir "documentos pendientes de este mes" muestra la consulta interpretada y, tras confirmar, la tabla. Una orden como "borra todos los documentos" no produce ninguna operación de escritura.

## Dependencias y coordinación

- D2 antes que D4. D4 necesita el `GeminiClient` de Diego (G0).
- Con Cruz: los reportes fijos viven en `/api/v1/reports/**` y los tuyos en `/api/v1/queries/**`. Acordar el formato de filtros y paginación.
- Con Mauricio: contrato de ajustes del tenant y migración 038 (columna de idioma).
- Revisor cruzado: Cruz.
