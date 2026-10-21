# Guía Completa: Generación del Diagrama de Clases en Enterprise Architect
**Proyecto:** NexoDocs - Sistema de Gestión Documental Multi-Tenant (Sprint 1)  
**Materia:** Sistemas de Información II (SI2)  
**Total de Entidades:** 53 clases / tablas con 111 relaciones de asociación

---

## 📂 Archivos Generados en esta Carpeta

1. [`schema_enterprise_architect.sql`](file:///c:/Users/Mauricio/OneDrive/Desktop/ProyectoSI2/Sistema-Gestion-Documental-Sprint-1/database/enterprise_architect/schema_enterprise_architect.sql): Script SQL DDL estandarizado y limpio con todas las tablas, columnas, claves primarias y foráneas, diseñado para el motor de importación DDL de Enterprise Architect.
2. [`java_classes/`](file:///c:/Users/Mauricio/OneDrive/Desktop/ProyectoSI2/Sistema-Gestion-Documental-Sprint-1/database/enterprise_architect/java_classes/com/nexodocs/model): Carpeta con las 53 clases Java (POJOs / Entidades) con atributos privados, métodos getters/setters y asociaciones tipadas.
3. [`ea_import_script.js`](file:///c:/Users/Mauricio/OneDrive/Desktop/ProyectoSI2/Sistema-Gestion-Documental-Sprint-1/database/enterprise_architect/ea_import_script.js): Script de automatización en JScript para ejecutar dentro de Enterprise Architect (Tools > Scripting) y generar el diagrama en 1 clic.
4. [`diagrama_clases.puml`](file:///c:/Users/Mauricio/OneDrive/Desktop/ProyectoSI2/Sistema-Gestion-Documental-Sprint-1/database/enterprise_architect/diagrama_clases.puml): Especificación completa en PlantUML del diagrama de clases organizada por módulos.

---

## 🚀 Método 1: Mediante Código Fuente Java (Ingeniería Inversa) - **Recomendado**

Este es el método más rápido y estándar en Enterprise Architect para generar un **Diagrama de Clases UML puro**:

1. **Abrir Enterprise Architect**:
   - Abre tu proyecto `.eap` o `.qea` (o crea uno nuevo: `File > New Project`).
2. **Crear o Seleccionar un Paquete (Package)**:
   - En el panel **Project Browser** (Explorador del Proyecto), haz clic derecho en el Modelo (o dentro de una vista lógica) y selecciona:  
     `Add a Package...`  
   - Nómbralo: `Modelo de Clases NexoDocs`.
3. **Ejecutar la Ingeniería Inversa de Código**:
   - Haz clic derecho sobre el paquete creado en el Project Browser y selecciona:  
     `Code Engineering > Import Source Directory...`  
     *(O en el menú superior: Cinta `Develop` > grupo `Source Code` > `Reverse Engineer Source Code`)*.
4. **Configurar el Asistente de Importación**:
   - **Root Directory:** Selecciona la ruta de la carpeta:  
     `c:\Users\Mauricio\OneDrive\Desktop\ProyectoSI2\Sistema-Gestion-Documental-Sprint-1\database\enterprise_architect\java_classes`
   - **Source Type:** Selecciona `Java (*.java)`.
   - **Package Structure:** Marca `Recursively Process Subdirectories`.
   - **Diagrams:** Marca la casilla `[x] Automatically create Diagram for each Package`.
5. **Generar**:
   - Presiona el botón **OK**.
   - Enterprise Architect procesará los archivos y creará automáticamente el **Diagrama de Clases** con las 53 clases, sus atributos tipados, métodos y flechas de asociación.

---

## 🗄️ Método 2: Mediante el Script SQL DDL (Importar Base de Datos)

Si tu docente solicita importar el script SQL de la base de datos y luego transformarlo al modelo de clases:

1. **Importar el DDL en Enterprise Architect**:
   - En el **Project Browser**, haz clic derecho en el paquete destino y selecciona:  
     `Code Engineering > Import DDL file...`  
     *(O en la cinta `Develop` > `Data Modeling` > `Import DDL`)*.
2. **Configurar la Importación DDL**:
   - **File:** Busca y selecciona [`schema_enterprise_architect.sql`](file:///c:/Users/Mauricio/OneDrive/Desktop/ProyectoSI2/Sistema-Gestion-Documental-Sprint-1/database/enterprise_architect/schema_enterprise_architect.sql).
   - **Database / DBMS Type:** Selecciona `PostgreSQL` o `ANSI`.
   - **Options:** Marca `[x] Automatically create Diagram`.
   - Haz clic en **Import**.
   - Enterprise Architect importará las 53 tablas como entidades relacionales con el estereotipo `«table»` y claves foráneas.
3. **Transformar a Diagrama de Clases UML (MDA Transform)**:
   - Haz clic derecho sobre el paquete de tablas importadas y selecciona:  
     `Transform Elements...` (o `Design > Tools > Transform > Transform Selection`).
   - En la lista de transformaciones, selecciona `DDL to Class`.
   - Elige el paquete de destino y presiona **Do Transform**.
   - Enterprise Architect creará el **Diagrama de Clases de Dominio** a partir de las tablas de la base de datos.

---

## ⚡ Método 3: Mediante el Script de Automatización Interno de EA (JScript)

Si quieres que Enterprise Architect dibuje el diagrama programáticamente mediante código interno:

1. Abre tu proyecto en **Enterprise Architect**.
2. En el **Project Browser**, haz clic izquierdo sobre el paquete donde deseas crear el diagrama (debe quedar seleccionado).
3. Abre la consola de scripting:
   - Ve al menú superior: Cinta `Develop` (o `Specialize`) > grupo `Tools` > botón **Scripting**.
4. En el panel **Scripting**:
   - Haz clic en **New JScript** (icono de nuevo script).
   - Asigna un nombre, por ejemplo: `GenerarClasesNexoDocs`.
5. Abre el script creado, borra cualquier plantilla que tenga y copia/pega todo el contenido de:  
   [`ea_import_script.js`](file:///c:/Users/Mauricio/OneDrive/Desktop/ProyectoSI2/Sistema-Gestion-Documental-Sprint-1/database/enterprise_architect/ea_import_script.js).
6. Presiona el botón **Run** (ícono de triángulo verde / Play) o presiona `F5`.
7. Enterprise Architect creará automáticamente el diagrama `"NexoDocs - Diagrama de Clases Completo"`, agregará las 53 clases con sus atributos y trazará todas las relaciones de asociación.

---

## 📊 Estructura de Módulos del Sistema (53 Entidades)

| Módulo | Entidades Principales |
|---|---|
| **1. Plataforma y Multi-Tenencia** | `Plan`, `PlanLimit`, `PlanFeature`, `Tenant`, `TenantDepartment`, `User`, `Role`, `Permission`, `RolePermission`, `UserRole`, `UserGroup`, `UserGroupMember` |
| **2. Autenticación y Seguridad** | `AuthSession`, `RevokedAccessToken`, `PasswordRecoveryRequest`, `UserPushToken` |
| **3. Gestión Documental y Expedientes** | `RetentionPolicy`, `DocumentCategory`, `DocumentType`, `MetadataDefinition`, `ExpedientType`, `Expedient`, `ExpedientParticipant`, `Document`, `DocumentVersion`, `DocumentMetadataValue`, `Tag`, `DocumentTag`, `DocumentComment` |
| **4. Workflows y Tareas** | `WorkflowTemplate`, `WorkflowTemplateStage`, `WorkflowTemplateTransition`, `Workflow`, `WorkflowDocument`, `WorkflowTask`, `WorkflowEvent`, `WorkflowComment`, `TaskDelegation` |
| **5. Operaciones y Auditoría** | `OcrJob`, `Notification`, `AuditEvent`, `ReportTemplate`, `TenantUsageMonthly`, `BackupHistory` |
| **6. Dominio Clínico y DICOM** | `Patient`, `ClinicalStaff`, `ClinicalHistory`, `ClinicalEpisode`, `ClinicalDocumentLink`, `MedicalNote`, `DicomStudy`, `DicomSeries`, `DicomInstance` |
