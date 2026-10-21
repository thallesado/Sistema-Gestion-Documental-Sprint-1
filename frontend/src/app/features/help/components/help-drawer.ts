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
    title: 'Digitalización y OCR Clínico',
    description: 'Aprende a capturar documentos con cámara o escáner y extraer datos médicos con IA.',
    category: 'Digitalización',
    badge: 'OCR & IA',
    tags: ['ocr', 'digitalizacion', 'digitalización', 'camara', 'cámara', 'escaner', 'escáner', 'recetas', 'ia', 'reconocimiento'],
    content: `
### Digitalización y Reconocimiento Óptico (OCR)
El módulo de **Digitalización y OCR Clínico** de NexoDocs permite transformar documentos físicos, recetas médicas, informes de laboratorio e historias clínicas escaneadas o fotografiadas en registros digitales indexados.

#### 1. ¿Cómo procesar un documento?
1. **Captura o Carga**: Sube archivos en formato PDF, TIFF, PNG o JPEG, o usa la cámara web integrada para capturar recetas y hojas clínicas en tiempo real.
2. **Preprocesamiento Óptico**: El motor realiza corrección de perspectiva, eliminación de sombras, binarización y normalización del contraste.
3. **Reconocimiento Inteligente**: Los modelos de IA extraen texto y campos clínicos estructurados (paciente, diagnóstico CIE-10, médico, fecha, posología).
4. **Revisión Humana**: Revisa y corrige el texto en la pantalla comparativa antes de la indexación final en el expediente.

#### 2. Límites de Páginas por Mes
Cada página procesada se descuenta de la cuota mensual de tu plan (*maxOcrPagesPerMonth*). Puedes revisar tu consumo actual en **Configuración > Apariencia y Uso**.
    `,
  },
  {
    id: 'workflows',
    title: 'Flujos de Trabajo y Aprobaciones',
    description: 'Automatiza revisiones colegiadas, comités médicos y firmas de documentos.',
    category: 'Procesos',
    badge: 'Workflows',
    tags: ['workflow', 'workflows', 'flujo', 'flujos', 'aprobacion', 'aprobación', 'revision', 'revisión', 'tareas', 'bandeja'],
    content: `
### Flujos de Trabajo y Aprobaciones Documentales
El motor de **Workflows** automatiza el ciclo de vida de los documentos clínicos y administrativos dentro de la organización de salud.

#### 1. Ciclo de Vida del Documento
- **Borrador (Draft)**: Redacción inicial y versionado colaborativo.
- **En Revisión**: Revisión técnica por especialistas o auditores de calidad.
- **En Aprobación**: Visto bueno formal de las autoridades médicas designadas.
- **Aprobado / Publicado**: Adquiere validez legal e integración al expediente.
- **Rechazado**: Vuelve al autor con observaciones detalladas para subsanación.

#### 2. Bandeja de Tareas Personales
En **Workflows > Mis tareas** encontrarás las solicitudes que requieren tu visto bueno, con comparador de versiones, checklist y registro de comentarios.
    `,
  },
  {
    id: 'expedientes',
    title: 'Expedientes e Historias Clínicas',
    description: 'Gestión integral del historial médico, confidencialidad y retención legal.',
    category: 'Clínica',
    badge: 'Historias',
    tags: ['expediente', 'expedientes', 'historia', 'clinica', 'clínica', 'paciente', 'pacientes', 'salud', 'custodia', 'archivo'],
    content: `
### Expedientes e Historias Clínicas Digitales
Centraliza toda la documentación asistencial asociada a un paciente o proceso hospitalario de forma unificada y segura.

#### 1. Estructura del Expediente
- **Ficha Demográfica del Paciente**: Identificación, contactos de urgencia y antecedentes.
- **Árbol Documental**: Consultas médicas, consentimientos informados, analíticas de laboratorio, imagenología y epicrisis.
- **Versionado Inmutable**: Cada cambio genera una versión sellada en tiempo (timestamp de auditoría).

#### 2. Confidencialidad y Retención
El acceso está protegido por políticas estrictas de RBAC y RLS en la base de datos. Toda consulta o descarga queda auditada para garantizar el cumplimiento normativo.
    `,
  },
  {
    id: 'usuarios-roles',
    title: 'Gestión de Usuarios, Grupos y Roles',
    description: 'Administración de cuentas, perfiles clínicos y permisos granulares RBAC.',
    category: 'Seguridad',
    badge: 'RBAC',
    tags: ['usuario', 'usuarios', 'rol', 'roles', 'grupo', 'grupos', 'permisos', 'seguridad', 'acceso', 'rbac', 'admin'],
    content: `
### Gestión de Usuarios, Grupos y Roles (RBAC)
NexoDocs implementa un modelo de control de acceso por roles que permite definir exactamente qué puede hacer cada colaborador.

#### 1. Perfiles y Grupos Típicos
- **Administrador de Tenant**: Configura la empresa, marca, límites y gestiona usuarios.
- **Médico Especialista**: Consulta y crea historias clínicas, aprueba órdenes.
- **Enfermería**: Registro de signos vitales, administración de fármacos.
- **Auditor Clínico**: Lectura y verificación de registros y auditoría.

#### 2. Límite de Usuarios por Plan
Tu plan contratado establece un número máximo de usuarios (*maxUsers*). Las cuentas inactivas pueden suspenderse para liberar cupos sin perder el historial.
    `,
  },
  {
    id: 'primer-uso',
    title: 'Guía de Primer Uso de NexoDocs',
    description: 'Pasos fundamentales para configurar tu clínica e iniciar la gestión documental.',
    category: 'Inicio',
    badge: 'Onboarding',
    tags: ['primer uso', 'inicio', 'bienvenida', 'onboarding', 'empezar', 'configuracion', 'configuración', 'guia', 'guía'],
    content: `
### Guía Rápida de Primer Uso
¡Bienvenido a **NexoDocs**! Sigue estos sencillos pasos para iniciar:

1. **Personaliza tu Marca**: Entra a **Configuración > Apariencia** y sube el logotipo de tu clínica, selecciona tu color corporativo y fija tu moneda y zona horaria.
2. **Invita a tu Equipo**: Ve a **Gestión > Usuarios y equipos** y da de alta a tus médicos y personal administrativo con sus perfiles correspondientes.
3. **Sube o Digitaliza Documentos**: Carga tus primeros archivos o utiliza la cámara web en el módulo de OCR para digitalizar recetas en segundos.
4. **Organiza Expedientes**: Asocia los documentos a los expedientes de tus pacientes para tener el historial centralizado.
    `,
  },
];

const FAQS: HelpFaq[] = [
  {
    id: 'faq-ocr',
    question: '¿Cómo digitalizo una receta o documento físico con la cámara?',
    answer: 'Ingresa a la sección de Digitalización y pulsa en "Abrir cámara" o sube una fotografía. El sistema corregirá la perspectiva y extraerá los datos médicos automáticamente con OCR e IA.',
    articleId: 'ocr',
    tags: ['ocr', 'digitalización', 'cámara', 'receta', 'escanear'],
  },
  {
    id: 'faq-limits',
    question: '¿Qué ocurre si mi organización supera los límites de su plan?',
    answer: 'El sistema te notificará mediante un aviso claro indicando el límite alcanzado (usuarios, documentos, almacenamiento u OCR). El administrador puede solicitar un upgrade de plan desde la pantalla de planes.',
    articleId: 'primer-uso',
    tags: ['limites', 'límites', 'plan', 'cuota', 'usuarios', 'documentos', 'almacenamiento'],
  },
  {
    id: 'faq-workflows',
    question: '¿Cómo enviar un documento a aprobación colegiada?',
    answer: 'Desde el visor del documento o en la sección de Workflows, haz clic en "Iniciar flujo", elige la plantilla correspondiente y selecciona a los revisores médicos necesarios.',
    articleId: 'workflows',
    tags: ['workflow', 'flujo', 'aprobación', 'comité', 'revisión'],
  },
  {
    id: 'faq-branding',
    question: '¿Cómo personalizar el logotipo, color y moneda de la clínica?',
    answer: 'El Administrador del Tenant puede ingresar a Configuración > Apariencia para cambiar el color primario, subir el logo en PNG o SVG, y establecer la moneda y zona horaria.',
    articleId: 'primer-uso',
    tags: ['marca', 'logo', 'color', 'apariencia', 'moneda', 'zona horaria'],
  },
  {
    id: 'faq-users',
    question: '¿Quién puede dar de alta nuevos usuarios y cómo reciben sus claves?',
    answer: 'Solo los usuarios con rol de Administrador pueden crear cuentas. El sistema genera una contraseña temporal y envía un correo electrónico de bienvenida obligando a cambiarla en el primer inicio de sesión.',
    articleId: 'usuarios-roles',
    tags: ['usuarios', 'alta', 'invitacion', 'contraseña', 'credenciales'],
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
      const botpress = (window as unknown as { botpress?: { open?: () => void } }).botpress;
      if (typeof botpress?.open === 'function') {
        botpress.open();
      }
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
