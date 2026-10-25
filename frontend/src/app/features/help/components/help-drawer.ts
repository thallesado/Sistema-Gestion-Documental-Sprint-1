import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AssistantContextService } from '../../../core/assistant/assistant-context.service';
import { HelpService } from '../help.service';

export interface HelpArticle {
  id: string;
  title: string;
  description: string;
  category: string;
  badge: string;
  tags: string[];
  content?: string;
}

export interface HelpFaq {
  id: string;
  question: string;
  answer: string;
  articleId?: string;
  tags: string[];
}

const ARTICLES: HelpArticle[] = [
  {
    id: 'ocr',
    title: 'Digitalización y OCR',
    description: 'Aprende a capturar documentos con cámara o archivo y extraer su texto con IA.',
    category: 'Digitalización',
    badge: 'OCR & IA',
    tags: ['ocr', 'digitalizacion', 'digitalización', 'camara', 'cámara', 'escaner', 'escáner', 'recetas', 'ia', 'reconocimiento'],
    content: `
### Digitalización y Reconocimiento Óptico (OCR)
El módulo de **Digitalización** de NexoDocs convierte documentos físicos (recetas, informes, formularios, facturas, contratos) escaneados o fotografiados en documentos digitales indexados. Sirve a cualquier rubro, no solo al clínico.

#### 1. ¿Cómo procesar un documento?
1. **Captura o carga**: En Digitalización > Escanear documento sube un PDF, JPEG, PNG o WebP, o captura el documento con la cámara del equipo.
2. **Reconocimiento con IA**: Un modelo de IA lee la imagen y extrae el texto y los campos que identifica. El resultado depende de la calidad de la imagen.
3. **Revisión humana**: En Digitalización > Procesamiento OCR el trabajo queda "Por validar". Corrige los campos y pulsa "Confirmar extracción", o "Rechazar resultado" si no sirve.
4. **Indexación**: En Indexación pulsa "Indexar Documento" para crear el documento en el repositorio con su versión 1. Después puedes ajustar sus metadatos en Corrección de metadatos mientras siga en borrador.

#### 2. Límites de páginas por mes
Cada página procesada (en un PDF, cada página cuenta) se descuenta de la cuota mensual de tu plan (*maxOcrPagesPerMonth*). Si se alcanza el límite, el sistema rechaza nuevos trabajos hasta el mes siguiente o hasta cambiar de plan.

#### 3. Consejos para mejorar la precisión
- **Iluminación**: evita reflejos y zonas oscuras al fotografiar.
- **Enfoque y resolución**: usa texto nítido; en escaneos se recomienda 300 DPI o más.
- **Encuadre**: el documento debe verse completo, derecho y sin recortes. El sistema no endereza ni corrige imágenes torcidas.
- El OCR solo transcribe texto; no interpreta imágenes médicas como radiografías.
    `,
  },
  {
    id: 'workflows',
    title: 'Flujos de Trabajo y Aprobaciones',
    description: 'Revisiones y aprobaciones por etapas con trazabilidad de cada decisión.',
    category: 'Procesos',
    badge: 'Workflows',
    tags: ['workflow', 'workflows', 'flujo', 'flujos', 'aprobacion', 'aprobación', 'revision', 'revisión', 'tareas', 'bandeja'],
    content: `
### Flujos de Trabajo y Aprobaciones Documentales
El motor de **Workflows** guía un documento, un expediente o un proceso por etapas de revisión y aprobación, y deja el rastro de cada decisión. Sirve para cualquier sector.

#### 1. Ciclo de vida del documento
- **Borrador**: redacción inicial y versionado.
- **En revisión**: el documento llega a los revisores asignados según la plantilla del flujo.
- **En aprobación**: espera la decisión del aprobador de la etapa.
- **Aprobado**: la aprobación queda registrada con quién, cuándo y sobre qué versión. Es un estado del sistema; no sustituye una firma electrónica ni un trámite legal.
- **Rechazado o devuelto**: el aprobador deja un comentario y el documento vuelve al autor para corregirlo.

#### 2. Mis tareas
- En Workflows > Mis tareas encuentras las solicitudes pendientes de tu revisión o aprobación.
- Puedes filtrar, comparar la versión actual con las anteriores, ver el checklist y comentar antes de decidir.

#### 3. Plantillas de flujo
- Los administradores diseñan plantillas en Workflows > Diseñador (requiere el permiso \`workflow:designer\`) con nodos de Inicio, Tarea, Revisión, Aprobación, Decisión, Notificación, Archivo y Fin.
- Las etapas se ejecutan en secuencia, con un aprobador por etapa. Para varios aprobadores se encadenan etapas consecutivas.
- El nodo Notificación genera un aviso dentro de NexoDocs (campana de notificaciones). El sistema no envía correos electrónicos.
- Editar una plantilla crea una versión nueva; los flujos ya iniciados conservan la suya.
    `,
  },
  {
    id: 'expedientes',
    title: 'Expedientes',
    description: 'Agrupa los documentos de un caso, cliente o paciente y controla su cierre.',
    category: 'Expedientes',
    badge: 'Expedientes',
    tags: ['expediente', 'expedientes', 'historia', 'clinica', 'clínica', 'paciente', 'pacientes', 'salud', 'custodia', 'archivo'],
    content: `
### Expedientes
Un **expediente** reúne los documentos de un caso, cliente, paciente, proyecto o trámite en un solo lugar. En organizaciones de salud, el módulo clínico (Módulo Clínico > Pacientes) añade pacientes, antecedentes y notas médicas; es opcional y otros sectores no lo necesitan.

#### 1. Estructura
- **Ficha del expediente**: título, estado y datos de identificación.
- **Documentos asociados**: los documentos se vinculan al expediente y se clasifican por tipo documental.
- **Versiones**: cada actualización de un documento crea una versión nueva, con autor y fecha, y las anteriores se conservan.

#### 2. Acceso y trazabilidad
- Cada usuario ve solo lo que sus permisos permiten, y los datos de cada organización están aislados de las demás.
- Las acciones relevantes (consultas, descargas, modificaciones) quedan registradas en Auditoría. El sistema no declara por sí mismo el cumplimiento de ninguna normativa; eso depende de cómo lo configure y opere cada organización.

#### 3. Cierre y archivo
- Un expediente puede pasar a los estados **Cerrado** o **Archivado** al terminar su ciclo.
    `,
  },
  {
    id: 'usuarios-roles',
    title: 'Gestión de Usuarios, Grupos y Permisos',
    description: 'Administración de cuentas, grupos y permisos (RBAC).',
    category: 'Seguridad',
    badge: 'RBAC',
    tags: ['usuario', 'usuarios', 'rol', 'roles', 'grupo', 'grupos', 'permisos', 'seguridad', 'acceso', 'rbac', 'admin', 'bloqueo', 'contraseña'],
    content: `
### Gestión de Usuarios, Grupos y Permisos (RBAC)
NexoDocs controla el acceso por roles (**RBAC**): los permisos se asignan a grupos (perfiles) y los grupos a los usuarios.

#### 1. Grupos y perfiles típicos
- **Administrador del tenant**: configura la organización, la marca, y gestiona usuarios.
- **Perfiles de trabajo** (por ejemplo revisor, aprobador, operador o personal clínico): se crean según el rubro en Usuarios y equipos > Grupos de usuarios (perfiles).
- **Auditor**: acceso de consulta a la auditoría y los reportes.
- Un usuario puede pertenecer a varios grupos; ve el menú y las acciones de la suma de sus permisos.

#### 2. Límite de usuarios por plan
Tu plan establece un máximo de usuarios activos (*maxUsers*). Al alcanzarlo no se pueden crear ni reactivar cuentas hasta desactivar otras o cambiar de plan.

#### 3. Contraseñas y acceso
- Al crear un usuario se define una contraseña temporal que debe cambiarse en el primer inicio de sesión. El sistema no envía correos: el administrador entrega la contraseña temporal por un canal seguro.
- Tras varios intentos de inicio de sesión fallidos en poco tiempo el acceso se bloquea temporalmente (error 429); espera el tiempo indicado y reintenta.
- Las cuentas pueden desactivarse sin perder el historial que generaron.
- Para ocultar o bloquear campos concretos de un formulario por grupo, consulta el artículo Privilegios por formulario.
    `,
  },
  {
    id: 'primer-uso',
    title: 'Guía de Primer Uso de NexoDocs',
    description: 'Pasos fundamentales para configurar tu organización e iniciar la gestión documental.',
    category: 'Inicio',
    badge: 'Onboarding',
    tags: ['primer uso', 'inicio', 'bienvenida', 'onboarding', 'empezar', 'configuracion', 'configuración', 'guia', 'guía', 'plan', 'planes', 'registro'],
    content: `
### Guía Rápida de Primer Uso
¡Bienvenido a **NexoDocs**! Si tu organización aún no tiene cuenta, en la pantalla de inicio de sesión pulsa "Crear cuenta de empresa", elige un plan y completa los datos; la cuenta que se crea es la de administrador. Después sigue estos pasos:

1. **Personaliza tu marca**: Entra a Configuración > Apariencia, elige el color primario, indica la URL del logotipo y fija moneda, zona horaria y formato de fecha.
2. **Invita a tu equipo**: Ve a Usuarios y equipos > Todos los usuarios, crea las cuentas y asigna a cada persona sus grupos. Cada usuario recibe una contraseña temporal que debe cambiar al ingresar.
3. **Sube o digitaliza documentos**: Documentos > Subir archivo, o Digitalización > Escanear documento para extraer el texto de un documento físico con OCR.
4. **Organiza expedientes**: Asocia los documentos a expedientes para tener cada caso centralizado.
5. **Protege tus datos**: Revisa en Respaldos > Respaldos y restauración que haya copias automáticas y crea un respaldo manual antes de cambios grandes.
    `,
  },
  {
    id: 'respaldos',
    title: 'Respaldos y restauración',
    description: 'Crea, descarga y restaura copias de los datos de tu organización.',
    category: 'Seguridad',
    badge: 'Respaldos',
    tags: ['respaldo', 'respaldos', 'backup', 'restaurar', 'restauración', 'restauracion', 'copia', 'retención', 'retencion'],
    content: `
### Respaldos y restauración
Los respaldos guardan una copia de los datos y archivos de tu organización para poder recuperarla. Están en Respaldos > Respaldos y restauración (\`/settings/backups\`) y requieren el permiso \`backup:read\` para verse.

#### 1. Crear un respaldo
1. Entra a Respaldos > Respaldos y restauración.
2. Pulsa "Crear respaldo" (requiere \`backup:create\`).
3. Espera a que el estado sea Completado; el sistema calcula una huella SHA-256 para comprobar su integridad.

#### 2. Respaldo automático y retención
- En "Configuración" (requiere \`backup:configure\`) defines la hora diaria, la zona horaria y los días de retención (de 1 a 365).
- Cada día se genera una copia automática a esa hora. Si el servidor estaba apagado, hace la copia del día al volver, sin inventar las de días anteriores.
- La retención elimina los respaldos ordinarios vencidos. Los respaldos de seguridad y la evidencia de restauraciones no se eliminan.

#### 3. Descargar un respaldo
- Abre el Detalle del respaldo y pulsa "Descargar ZIP" (requiere \`backup:download\`). El sistema verifica el paquete antes de habilitar la descarga.
- El ZIP contiene datos de tu organización sin cifrar: guárdalo en un lugar seguro. Los respaldos viven en el mismo servidor que el sistema, por lo que conviene guardar también una copia externa.

#### 4. Restaurar un respaldo
1. Abre el respaldo y pulsa "Restaurar" (requiere \`backup:restore\`).
2. El sistema verifica que el paquete sea válido y compatible.
3. Escribe exactamente el nombre de la organización para confirmar y pulsa "Restaurar respaldo".
4. Antes de restaurar se crea automáticamente un respaldo de seguridad protegido, y las modificaciones de tu organización se suspenden temporalmente. Las demás organizaciones no se ven afectadas.
5. Los cambios hechos después del respaldo dejan de estar vigentes. La auditoría original se conserva, y el estado anterior queda disponible en el respaldo de seguridad (Consultar evidencia).

Si cambió la estructura del sistema después de crear un respaldo, ese respaldo puede ser incompatible y no podrá restaurarse; crea uno nuevo.
    `,
  },
  {
    id: 'privilegios-formulario',
    title: 'Privilegios por formulario',
    description: 'Decide qué componentes ve o edita cada grupo: Visible y editable, Solo lectura o No visible.',
    category: 'Seguridad',
    badge: 'Privilegios',
    tags: ['privilegios', 'formulario', 'formularios', 'solo lectura', 'no visible', 'componente', 'permisos', 'campos'],
    content: `
### Privilegios por formulario
Permiten decidir, por grupo de usuarios, qué componentes de cada formulario se ven o se pueden editar. Están en Usuarios y equipos > Privilegios por formulario (\`/users/form-permissions\`) y requieren el permiso \`component_permission:manage\`.

#### 1. Los tres estados
- **Visible y editable**: el componente se muestra y se puede modificar.
- **Solo lectura**: se muestra, pero no se puede modificar.
- **No visible**: el componente no se muestra.

#### 2. Cómo se resuelven
- Por defecto todo es Visible y editable: sin configuración, nada se restringe.
- Si un usuario pertenece a varios grupos, gana el grupo más permisivo (Visible y editable sobre Solo lectura, y este sobre No visible).

#### 3. Cómo configurarlos
1. Abre Privilegios por formulario y elige el formulario y el grupo.
2. Fija el estado de cada componente.
3. Guarda los cambios.
    `,
  },
  {
    id: 'auditoria',
    title: 'Auditoría e integridad',
    description: 'Consulta quién hizo qué y verifica que el registro no fue alterado.',
    category: 'Seguridad',
    badge: 'Auditoría',
    tags: ['auditoria', 'auditoría', 'integridad', 'verificar', 'hash', 'registro', 'accesos', 'trazabilidad'],
    content: `
### Auditoría
El menú Auditoría registra quién hizo qué, cuándo, desde qué IP y qué cambió. Se ve con el permiso \`audit:read_tenant\` (tu organización) o \`audit:read_global\` (plataforma).

#### 1. Pantallas
- Registro general (\`/audit\`) y Accesos (\`/audit/access\`).
- Creación de documentos, Modificaciones, Descargas, Aprobaciones, Eliminaciones y Cambios de permisos, cada una filtrada por tipo de acción.

#### 2. Verificar integridad
- En el Registro general, el botón "Verificar integridad" recorre la cadena de eventos y comprueba que los hashes SHA-256 encadenados siguen coincidiendo, y la compara con el ancla externa cuando está configurada.
- Si la cadena es íntegra, indica cuántos eventos verificó: no se detectó ninguna alteración ni borrado de eventos pasados.
- Si falla, hay un evento modificado o eliminado y debes avisar a un administrador.
- Qué no demuestra: no prueba que el contenido de cada evento sea correcto, solo que no cambió después de registrarse.
    `,
  },
  {
    id: 'apariencia',
    title: 'Apariencia y Regionalización',
    description: 'Color, logotipo, moneda, zona horaria y formato de fecha de tu organización.',
    category: 'Configuración',
    badge: 'Apariencia',
    tags: ['apariencia', 'color', 'logo', 'logotipo', 'moneda', 'zona horaria', 'fecha', 'marca', 'regionalización', 'regionalizacion'],
    content: `
### Apariencia y Regionalización
La pantalla Configuración > Apariencia (\`/settings/appearance\`) personaliza la identidad y los formatos de tu organización. Se ve con el permiso \`configuration:read\`.

#### 1. Identidad visual
- **Color primario de la marca**: elige un color con el selector; la vista previa lo muestra antes de guardar.
- **URL del Logotipo**: pega la dirección pública de una imagen (por ejemplo \`https://ejemplo.com/logo.png\`). NexoDocs no sube archivos de logo: solo guarda la dirección. Si la imagen no carga, el campo se limpia.

#### 2. Regionalización
- **Moneda**: la que se usa para mostrar importes.
- **Zona horaria**: la que se usa para mostrar y agrupar fechas y horas.
- **Formato de fecha**: cómo se escriben las fechas.

#### 3. Guardar
1. Ajusta los campos.
2. Pulsa el botón de guardar de la pantalla.
3. Recarga si no ves el cambio de inmediato.
    `,
  },
];

const FAQS: HelpFaq[] = [
  {
    id: 'faq-ocr',
    question: '¿Cómo digitalizo un documento físico?',
    answer: 'Entra a Digitalización > Escanear documento y sube un PDF o imagen (JPEG, PNG, WebP) o captura con la cámara. Luego revisa el resultado en Procesamiento OCR, confírmalo e indéxalo. Usa imágenes nítidas, derechas y bien iluminadas.',
    articleId: 'ocr',
    tags: ['ocr', 'digitalización', 'cámara', 'receta', 'escanear'],
  },
  {
    id: 'faq-limits',
    question: '¿Qué ocurre si mi organización supera los límites de su plan?',
    answer: 'El sistema rechaza la acción que excede el límite (usuarios, documentos, almacenamiento u OCR) y muestra un aviso. Libera cupo o cambia de plan para continuar.',
    articleId: 'primer-uso',
    tags: ['limites', 'límites', 'plan', 'cuota', 'usuarios', 'documentos', 'almacenamiento'],
  },
  {
    id: 'faq-workflows',
    question: '¿Cómo envío un documento a aprobación?',
    answer: 'Desde el detalle del documento o en Workflows, inicia un flujo, elige la plantilla y confirma los responsables. Las etapas se ejecutan en orden, una tras otra.',
    articleId: 'workflows',
    tags: ['workflow', 'flujo', 'aprobación', 'revisión'],
  },
  {
    id: 'faq-branding',
    question: '¿Cómo personalizo el logotipo, color y moneda?',
    answer: 'En Configuración > Apariencia: elige el color primario, pega la URL del logotipo y define moneda, zona horaria y formato de fecha. Requiere el permiso configuration:read.',
    articleId: 'apariencia',
    tags: ['marca', 'logo', 'color', 'apariencia', 'moneda', 'zona horaria'],
  },
  {
    id: 'faq-users',
    question: '¿Quién puede dar de alta usuarios y cómo reciben su clave?',
    answer: 'Quien tenga permisos de gestión de usuarios (normalmente el administrador). Se asigna una contraseña temporal que el usuario debe cambiar en su primer inicio de sesión; el administrador se la entrega, el sistema no envía correos.',
    articleId: 'usuarios-roles',
    tags: ['usuarios', 'alta', 'invitacion', 'contraseña', 'credenciales'],
  },
  {
    id: 'faq-backup-restore',
    question: '¿Cómo restauro un respaldo?',
    answer: 'En Respaldos > Respaldos y restauración abre el respaldo, pulsa "Restaurar", escribe exactamente el nombre de la organización y confirma. Antes se crea un respaldo de seguridad automático. Requiere el permiso backup:restore.',
    articleId: 'respaldos',
    tags: ['respaldo', 'restaurar', 'backup', 'copia'],
  },
  {
    id: 'faq-backup-create',
    question: '¿Cómo creo o programo un respaldo?',
    answer: 'En Respaldos > Respaldos y restauración pulsa "Crear respaldo". Para el automático diario, usa "Configuración" y define hora, zona horaria y días de retención (1 a 365).',
    articleId: 'respaldos',
    tags: ['respaldo', 'crear', 'automático', 'retención', 'programar'],
  },
  {
    id: 'faq-privileges',
    question: '¿Cómo oculto un campo a un grupo?',
    answer: 'En Usuarios y equipos > Privilegios por formulario elige formulario y grupo, y pon el componente en No visible (o Solo lectura). Si el usuario está en varios grupos, gana el más permisivo. Por defecto todo es visible y editable.',
    articleId: 'privilegios-formulario',
    tags: ['privilegios', 'formulario', 'oculto', 'solo lectura', 'grupo'],
  },
  {
    id: 'faq-audit-verify',
    question: '¿Qué hace "Verificar integridad" en Auditoría?',
    answer: 'Comprueba que la cadena de hashes SHA-256 de los eventos no se haya alterado y la compara con el ancla externa si está configurada. Prueba que los eventos no cambiaron tras registrarse, no que su contenido sea correcto.',
    articleId: 'auditoria',
    tags: ['auditoría', 'integridad', 'verificar', 'hash'],
  },
  {
    id: 'faq-lockout',
    question: 'No puedo iniciar sesión y veo un error 429',
    answer: 'Se superó el máximo de intentos de inicio de sesión fallidos en poco tiempo. Espera el tiempo indicado y vuelve a intentarlo.',
    articleId: 'usuarios-roles',
    tags: ['login', 'bloqueo', '429', 'intentos', 'contraseña'],
  },
];

@Component({
  selector: 'app-help-drawer',
  imports: [CommonModule, FormsModule],
  template: `
    @if (help.isOpen()) {
      <div class="help-backdrop" (click)="help.close()" role="presentation"></div>

      <aside class="help-drawer" role="dialog" aria-label="Centro de ayuda" (click)="$event.stopPropagation()">
        <!-- Header -->
        <header class="help-header">
          <div class="header-title">
            <span class="header-icon">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </span>
            <div>
              <h2>Centro de ayuda</h2>
              <p>Guías, tutoriales y soporte de NexoDocs</p>
            </div>
          </div>
          <button type="button" class="close-btn" (click)="help.close()" aria-label="Cerrar el centro de ayuda">✕</button>
        </header>

        <!-- Buscador de Artículos y FAQs -->
        <div class="help-search-box">
          <div class="search-input-wrap">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="search"
              [(ngModel)]="searchQuery"
              placeholder="Buscar 'OCR', 'flujos', 'usuarios', 'expedientes'..."
              aria-label="Buscar artículos y preguntas frecuentes"
            />
            @if (searchQuery()) {
              <button type="button" class="clear-search-btn" (click)="searchQuery.set('')" aria-label="Limpiar búsqueda">✕</button>
            }
          </div>
        </div>

        <!-- Contenido principal con scroll -->
        <div class="help-body">
          @if (selectedArticle(); as article) {
            <!-- Vista de Artículo Seleccionado -->
            <article class="article-view">
              <div class="article-nav">
                <button type="button" class="back-btn" (click)="selectedArticle.set(null)">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
                  </svg>
                  <span>Volver a la lista de temas</span>
                </button>
                <span class="article-badge">{{ article.badge }}</span>
              </div>

              <h1 class="article-title">{{ article.title }}</h1>
              <p class="article-meta">Categoría: <strong>{{ article.category }}</strong> · Manual oficial de NexoDocs</p>

              <div class="article-content">
                @for (paragraph of parseContent(article.content || ''); track $index) {
                  @if (paragraph.type === 'h3') {
                    <h3 class="content-h3">{{ paragraph.text }}</h3>
                  } @else if (paragraph.type === 'h4') {
                    <h4 class="content-h4">{{ paragraph.text }}</h4>
                  } @else if (paragraph.type === 'ul') {
                    <ul class="content-ul">
                      @for (item of paragraph.items; track $index) {
                        <li>{{ item }}</li>
                      }
                    </ul>
                  } @else if (paragraph.type === 'ol') {
                    <ol class="content-ol">
                      @for (item of paragraph.items; track $index) {
                        <li>{{ item }}</li>
                      }
                    </ol>
                  } @else {
                    <p class="content-p">{{ paragraph.text }}</p>
                  }
                }
              </div>
            </article>
          } @else {
            <!-- Sugerencia Contextual (si no hay búsqueda activa) -->
            @if (!searchQuery() && contextualArticle(); as ctx) {
              <div class="contextual-card">
                <div class="contextual-header">
                  <span class="contextual-pill">Ayuda sugerida para esta sección</span>
                  <span class="contextual-route">{{ currentRouteLabel() }}</span>
                </div>
                <h3>{{ ctx.title }}</h3>
                <p>{{ ctx.description }}</p>
                <button type="button" class="contextual-action" (click)="openArticle(ctx)">
                  <span>Abrir guía de esta pantalla</span>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                  </svg>
                </button>
              </div>
            }

            <!-- Conexión con Asistente Diego H2 -->
            <div class="assistant-cta-card">
              <div class="assistant-cta-text">
                <strong>¿Dudas sobre tus documentos o el sistema?</strong>
                <span>Consulta al Asistente Inteligente de NexoDocs</span>
              </div>
              <button type="button" class="assistant-btn" (click)="connectWithAssistant()">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <span>Preguntar al asistente</span>
              </button>
            </div>

            <!-- Navegación por pestañas -->
            <div class="help-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                class="tab-btn"
                [class.active]="activeTab() === 'articles'"
                (click)="activeTab.set('articles')"
              >
                Artículos y Guías ({{ filteredArticles().length }})
              </button>
              <button
                type="button"
                role="tab"
                class="tab-btn"
                [class.active]="activeTab() === 'faqs'"
                (click)="activeTab.set('faqs')"
              >
                Preguntas Frecuentes ({{ filteredFaqs().length }})
              </button>
            </div>

            <!-- Lista de Artículos -->
            @if (activeTab() === 'articles') {
              <div class="articles-list">
                @if (filteredArticles().length === 0) {
                  <div class="empty-state">
                    <p>No se encontraron artículos con "{{ searchQuery() }}".</p>
                    <button type="button" class="link-btn" (click)="searchQuery.set('')">Ver todos los artículos</button>
                  </div>
                }
                @for (art of filteredArticles(); track art.id) {
                  <div class="article-card" (click)="openArticle(art)" tabindex="0" (keydown.enter)="openArticle(art)">
                    <div class="card-head">
                      <span class="badge">{{ art.badge }}</span>
                      <span class="category">{{ art.category }}</span>
                    </div>
                    <h4>{{ art.title }}</h4>
                    <p>{{ art.description }}</p>
                  </div>
                }
              </div>
            }

            <!-- Lista de Preguntas Frecuentes (FAQs) -->
            @if (activeTab() === 'faqs') {
              <div class="faqs-list">
                @if (filteredFaqs().length === 0) {
                  <div class="empty-state">
                    <p>No se encontraron respuestas con "{{ searchQuery() }}".</p>
                    <button type="button" class="link-btn" (click)="searchQuery.set('')">Ver todas las preguntas</button>
                  </div>
                }
                @for (faq of filteredFaqs(); track faq.id) {
                  <div class="faq-item" [class.expanded]="expandedFaqId() === faq.id">
                    <button type="button" class="faq-question" (click)="toggleFaq(faq.id)">
                      <span>{{ faq.question }}</span>
                      <svg class="chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </button>
                    @if (expandedFaqId() === faq.id) {
                      <div class="faq-answer">
                        <p>{{ faq.answer }}</p>
                        @if (faq.articleId) {
                          <button type="button" class="faq-link" (click)="openArticleById(faq.articleId)">
                            Leer artículo completo relacionado →
                          </button>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
            }
          }
        </div>
      </aside>
    }
  `,
  styles: [`
    .help-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(10, 35, 33, 0.45);
      backdrop-filter: blur(2px);
      z-index: 899;
      animation: fadeIn 0.15s ease-out;
    }

    .help-drawer {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: 440px;
      max-width: 100vw;
      background: #ffffff;
      border-left: 1px solid #dcebe8;
      box-shadow: -10px 0 35px rgba(10, 50, 48, 0.16);
      z-index: 900;
      display: flex;
      flex-direction: column;
      animation: slideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      font-family: Inter, system-ui, -apple-system, sans-serif;
    }

    @keyframes slideIn {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .help-header {
      padding: 18px 20px;
      background: #f7fbfa;
      border-bottom: 1px solid #e1eee8;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .header-title {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .header-icon {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: #e6f6f3;
      color: var(--primary-color, #087f7b);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .help-header h2 {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      color: #123835;
    }
    .help-header p {
      margin: 2px 0 0;
      font-size: 12px;
      color: #557774;
    }
    .close-btn {
      width: 32px;
      height: 32px;
      background: #ffffff;
      border: 1px solid #d7e7e3;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      color: #557774;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s, color 0.15s;
    }
    .close-btn:hover {
      background: #edf6f4;
      color: #123835;
    }

    .help-search-box {
      padding: 14px 20px;
      border-bottom: 1px solid #eaf2ef;
      background: #ffffff;
    }
    .search-input-wrap {
      display: flex;
      align-items: center;
      background: #f4f8f7;
      border: 1.5px solid #d9e7e4;
      border-radius: 10px;
      padding: 0 12px;
      gap: 8px;
      color: #557774;
    }
    .search-input-wrap:focus-within {
      border-color: var(--primary-color, #087f7b);
      background: #ffffff;
      box-shadow: 0 0 0 3px rgba(8, 127, 123, 0.12);
    }
    .search-input-wrap input {
      width: 100%;
      height: 38px;
      border: none;
      background: transparent;
      outline: none;
      font-size: 13px;
      color: #143634;
    }
    .clear-search-btn {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 12px;
      color: #7b9997;
      padding: 4px;
    }

    .help-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* Contextual card */
    .contextual-card {
      background: linear-gradient(135deg, #effaf8 0%, #e0f4f0 100%);
      border: 1.5px solid #bce6dc;
      border-radius: 12px;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .contextual-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .contextual-pill {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background: #11786f;
      color: #ffffff;
      padding: 2px 7px;
      border-radius: 4px;
    }
    .contextual-route {
      font-size: 11px;
      color: #3b746e;
      font-weight: 600;
    }
    .contextual-card h3 {
      margin: 4px 0 0;
      font-size: 14px;
      font-weight: 700;
      color: #0b4e47;
    }
    .contextual-card p {
      margin: 0;
      font-size: 12px;
      color: #245e56;
      line-height: 1.4;
    }
    .contextual-action {
      align-self: flex-start;
      margin-top: 6px;
      background: #087f7b;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: background 0.15s;
    }
    .contextual-action:hover {
      background: #066b67;
    }

    /* Assistant CTA */
    .assistant-cta-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .assistant-cta-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .assistant-cta-text strong {
      font-size: 12px;
      color: #1e293b;
    }
    .assistant-cta-text span {
      font-size: 11px;
      color: #64748b;
    }
    .assistant-btn {
      background: #0284c7;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      padding: 6px 12px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 5px;
      white-space: nowrap;
      transition: background 0.15s;
    }
    .assistant-btn:hover {
      background: #0369a1;
    }

    /* Tabs */
    .help-tabs {
      display: flex;
      gap: 8px;
      border-bottom: 1px solid #e8f0ee;
      padding-bottom: 8px;
    }
    .tab-btn {
      background: transparent;
      border: none;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 12px;
      font-weight: 600;
      color: #607d7b;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .tab-btn.active {
      background: #eef7f5;
      color: var(--primary-color, #087f7b);
    }

    /* Articles list */
    .articles-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .article-card {
      background: #ffffff;
      border: 1px solid #e2eeeb;
      border-radius: 10px;
      padding: 12px 14px;
      cursor: pointer;
      transition: border-color 0.15s, transform 0.1s, box-shadow 0.15s;
    }
    .article-card:hover {
      border-color: var(--primary-color, #087f7b);
      box-shadow: 0 4px 12px rgba(8, 127, 123, 0.08);
      transform: translateY(-1px);
    }
    .card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .card-head .badge {
      font-size: 10px;
      font-weight: 700;
      color: var(--primary-color, #087f7b);
      background: #eaf7f4;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .card-head .category {
      font-size: 11px;
      color: #7b9997;
    }
    .article-card h4 {
      margin: 0 0 4px;
      font-size: 13px;
      font-weight: 700;
      color: #143634;
    }
    .article-card p {
      margin: 0;
      font-size: 12px;
      color: #557774;
      line-height: 1.4;
    }

    /* FAQs */
    .faqs-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .faq-item {
      background: #ffffff;
      border: 1px solid #e5eee9;
      border-radius: 8px;
      overflow: hidden;
      transition: border-color 0.15s;
    }
    .faq-item.expanded {
      border-color: var(--primary-color, #087f7b);
    }
    .faq-question {
      width: 100%;
      background: transparent;
      border: none;
      padding: 12px 14px;
      text-align: left;
      font-size: 12.5px;
      font-weight: 600;
      color: #153936;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .chevron {
      color: #7b9997;
      transition: transform 0.2s;
      flex-shrink: 0;
    }
    .faq-item.expanded .chevron {
      transform: rotate(180deg);
      color: var(--primary-color, #087f7b);
    }
    .faq-answer {
      padding: 0 14px 12px;
      font-size: 12px;
      color: #4b6b68;
      line-height: 1.45;
      border-top: 1px dashed #e8f0ed;
      padding-top: 10px;
    }
    .faq-answer p {
      margin: 0 0 8px;
    }
    .faq-link {
      background: none;
      border: none;
      color: var(--primary-color, #087f7b);
      font-size: 11.5px;
      font-weight: 600;
      padding: 0;
      cursor: pointer;
      text-decoration: underline;
    }

    /* Article view */
    .article-view {
      display: flex;
      flex-direction: column;
      gap: 12px;
      animation: fadeIn 0.15s ease-out;
    }
    .article-nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .back-btn {
      background: #f1f7f5;
      border: 1px solid #dce8e5;
      border-radius: 6px;
      padding: 5px 10px;
      color: var(--primary-color, #087f7b);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .back-btn:hover {
      background: #e4f2ee;
    }
    .article-badge {
      font-size: 11px;
      font-weight: 700;
      color: #10665b;
      background: #daf1eb;
      padding: 3px 8px;
      border-radius: 6px;
    }
    .article-title {
      margin: 4px 0 0;
      font-size: 18px;
      font-weight: 800;
      color: #0f3a35;
      line-height: 1.3;
    }
    .article-meta {
      margin: 0;
      font-size: 11px;
      color: #7b9997;
    }
    .article-content {
      border-top: 1px solid #e7efe9;
      padding-top: 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      font-size: 12.5px;
      color: #244644;
      line-height: 1.5;
    }
    .content-h3 {
      margin: 10px 0 2px;
      font-size: 14px;
      font-weight: 700;
      color: #105951;
    }
    .content-h4 {
      margin: 6px 0 0;
      font-size: 13px;
      font-weight: 700;
      color: #1b4b47;
    }
    .content-p {
      margin: 0;
    }
    .content-ul, .content-ol {
      margin: 4px 0 4px 20px;
      padding: 0;
    }
    .content-ul li, .content-ol li {
      margin-bottom: 4px;
    }

    .empty-state {
      padding: 24px 16px;
      text-align: center;
      color: #7b9997;
      font-size: 13px;
    }
    .link-btn {
      margin-top: 8px;
      background: none;
      border: none;
      color: var(--primary-color, #087f7b);
      font-weight: 700;
      font-size: 12px;
      cursor: pointer;
      text-decoration: underline;
    }
  `],
})
export class HelpDrawer {
  readonly help = inject(HelpService);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly assistantContext = inject(AssistantContextService);

  readonly articles = signal<HelpArticle[]>(ARTICLES);
  readonly faqs = signal<HelpFaq[]>(FAQS);
  readonly searchQuery = signal('');
  readonly selectedArticle = signal<HelpArticle | null>(null);
  readonly expandedFaqId = signal<string | null>(null);
  readonly activeTab = signal<'articles' | 'faqs'>('articles');

  /**
   * Identifica la ruta activa actual y sugiere el artículo de ayuda correspondiente.
   */
  readonly contextualArticle = computed<HelpArticle | null>(() => {
    const url = (this.router.url || '').toLowerCase();
    const arts = this.articles();

    if (url.includes('/settings/backups')) return arts.find((a) => a.id === 'respaldos') ?? null;
    if (url.includes('/form-permissions')) return arts.find((a) => a.id === 'privilegios-formulario') ?? null;
    if (url.startsWith('/audit')) return arts.find((a) => a.id === 'auditoria') ?? null;
    if (url.includes('/settings/appearance')) return arts.find((a) => a.id === 'apariencia') ?? null;
    if (url.includes('/ocr') || url.includes('/digitalizacion') || url.includes('/digitalización')) {
      return arts.find((a) => a.id === 'ocr') ?? null;
    }
    if (url.includes('/workflows') || url.includes('/bandeja') || url.includes('/tasks')) {
      return arts.find((a) => a.id === 'workflows') ?? null;
    }
    if (url.includes('/expedient') || url.includes('/clinical') || url.includes('/paciente')) {
      return arts.find((a) => a.id === 'expedientes') ?? null;
    }
    if (url.includes('/users') || url.includes('/roles') || url.includes('/permissions') || url.includes('/tenants')) {
      return arts.find((a) => a.id === 'usuarios-roles') ?? null;
    }
    // Por defecto en otras pantallas (dashboard, inicio, configuracion), sugiere la guía de primer uso
    return arts.find((a) => a.id === 'primer-uso') ?? null;
  });

  readonly currentRouteLabel = computed(() => {
    const url = (this.router.url || '').toLowerCase();
    if (url.includes('/ocr') || url.includes('/digitalizacion')) return 'Módulo Digitalización';
    if (url.includes('/workflows') || url.includes('/bandeja')) return 'Módulo Workflows';
    if (url.includes('/expedient')) return 'Módulo Expedientes';
    if (url.includes('/users') || url.includes('/tenants')) return 'Módulo Administración';
    return 'Pantalla actual';
  });

  /**
   * Artículos filtrados por el buscador.
   */
  readonly filteredArticles = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.articles();
    return this.articles().filter((a) =>
      a.title.toLowerCase().includes(q)
      || a.description.toLowerCase().includes(q)
      || a.category.toLowerCase().includes(q)
      || a.tags.some((t) => t.includes(q))
      || (a.content && a.content.toLowerCase().includes(q))
    );
  });

  /**
   * Preguntas frecuentes filtradas por el buscador.
   */
  readonly filteredFaqs = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.faqs();
    return this.faqs().filter((f) =>
      f.question.toLowerCase().includes(q)
      || f.answer.toLowerCase().includes(q)
      || f.tags.some((t) => t.includes(q))
    );
  });

  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    if (this.help.isOpen()) this.help.close();
  }

  openArticle(article: HelpArticle): void {
    this.selectedArticle.set(article);
    // Intenta cargar el archivo markdown remoto desde assets/help si está disponible
    this.http.get(`/assets/help/${article.id}.md`, { responseType: 'text' }).subscribe({
      next: (text) => {
        if (text && text.trim().length > 0) {
          this.selectedArticle.update((curr) => curr ? { ...curr, content: text } : curr);
        }
      },
      error: () => {
        // Mantiene el contenido embebido por defecto
      },
    });
  }

  openArticleById(id: string): void {
    const found = this.articles().find((a) => a.id === id);
    if (found) this.openArticle(found);
  }

  toggleFaq(faqId: string): void {
    this.expandedFaqId.update((curr) => curr === faqId ? null : faqId);
  }

  /**
   * Conecta con el asistente de Diego (H2) y el contexto global.
   */
  connectWithAssistant(): void {
    this.assistantContext.recordNavigation(this.router.url);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('assistant:open', {
        detail: {
          route: this.router.url,
          source: 'help_drawer',
        },
      }));
    }
    this.help.close();
  }

  /**
   * Parser sencillo de markdown básico para renderizar texto estructurado.
   */
  parseContent(raw: string): Array<{ type: 'h3' | 'h4' | 'p' | 'ul' | 'ol'; text?: string; items?: string[] }> {
    const lines = raw.split('\n');
    const blocks: Array<{ type: 'h3' | 'h4' | 'p' | 'ul' | 'ol'; text?: string; items?: string[] }> = [];

    let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;

    for (let line of lines) {
      line = line.trim();
      if (!line) {
        if (currentList) {
          blocks.push(currentList);
          currentList = null;
        }
        continue;
      }

      if (line.startsWith('### ')) {
        if (currentList) { blocks.push(currentList); currentList = null; }
        blocks.push({ type: 'h3', text: line.replace('### ', '') });
      } else if (line.startsWith('#### ')) {
        if (currentList) { blocks.push(currentList); currentList = null; }
        blocks.push({ type: 'h4', text: line.replace('#### ', '') });
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        const itemText = line.substring(2);
        if (!currentList || currentList.type !== 'ul') {
          if (currentList) blocks.push(currentList);
          currentList = { type: 'ul', items: [itemText] };
        } else {
          currentList.items.push(itemText);
        }
      } else if (/^\d+\.\s/.test(line)) {
        const itemText = line.replace(/^\d+\.\s/, '');
        if (!currentList || currentList.type !== 'ol') {
          if (currentList) blocks.push(currentList);
          currentList = { type: 'ol', items: [itemText] };
        } else {
          currentList.items.push(itemText);
        }
      } else {
        if (currentList) { blocks.push(currentList); currentList = null; }
        blocks.push({ type: 'p', text: line });
      }
    }

    if (currentList) {
      blocks.push(currentList);
    }

    return blocks;
  }
}
