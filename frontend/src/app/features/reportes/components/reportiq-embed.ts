import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

export interface EmbedConfig {
  token: string;
  embedUrl: string;
  expiresAt: string;
  dataSourceId: string;
}

@Component({
  selector: 'app-reportiq-embed',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="reportiq-wrapper" [class.is-fullscreen]="isFullscreen()">
      <!-- Toolbar Header -->
      <header class="reportiq-header">
        <div class="header-left">
          <div class="title-row">
            <h1 class="title">{{ title }}</h1>
            <span class="status-badge" [class.offline]="errorMessage()">
              <span class="status-dot"></span>
              {{ errorMessage() ? 'ReportIQ Offline' : 'ReportIQ · Conectado' }}
            </span>
          </div>
          <p class="subtitle">{{ subtitle }}</p>
        </div>

        <div class="header-actions">
          <button
            type="button"
            class="btn-action"
            (click)="reloadIframe()"
            [disabled]="loading()"
            title="Recargar módulo de reportes"
          >
            <span class="action-icon" [class.spinning]="loading()">↻</span>
            <span class="action-text">Recargar</span>
          </button>

          @if (rawUrl) {
            <button
              type="button"
              class="btn-action"
              (click)="openInNewTab()"
              title="Abrir en pestaña independiente"
            >
              <span class="action-icon">↗</span>
              <span class="action-text">Abrir fuera</span>
            </button>
          }

          <button
            type="button"
            class="btn-action btn-fullscreen"
            (click)="toggleFullscreen()"
            [title]="isFullscreen() ? 'Salir de pantalla completa' : 'Pantalla completa'"
          >
            <span class="action-icon">{{ isFullscreen() ? '🗗' : '⛶' }}</span>
            <span class="action-text">{{ isFullscreen() ? 'Restaurar' : 'Maximizar' }}</span>
          </button>
        </div>
      </header>

      <!-- Iframe Container -->
      <div class="iframe-container">
        @if (loading()) {
          <div class="iframe-loader">
            <div class="loader-spinner"></div>
            <p class="loader-text">Conectando con ReportIQ (Analítica IA)...</p>
            <small class="loader-sub">Autenticando tenant y configurando sesión embebible</small>
          </div>
        }

        @if (errorMessage() && !loading()) {
          <div class="iframe-error">
            <div class="error-icon">⚠️</div>
            <h3>No se pudo cargar el módulo de reportes</h3>
            <p class="error-text">{{ errorMessage() }}</p>
            <button type="button" class="btn-retry" (click)="loadEmbedConfig()">
              ↻ Reintentar conexión
            </button>
          </div>
        }

        @if (toastMessage()) {
          <div class="embed-toast">
            <span>✓</span> {{ toastMessage() }}
          </div>
        }

        @if (safeUrl) {
          <iframe
            #reportIframe
            [src]="safeUrl"
            title="ReportIQ AI Reporting Module"
            (load)="onIframeLoad()"
            allow="microphone; clipboard-write; display-capture"
            class="reportiq-iframe"
          ></iframe>
        }
      </div>
    </div>
  `,
  styles: [`
    .reportiq-wrapper {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      width: 100%;
      height: 100%;
    }

    .reportiq-wrapper.is-fullscreen {
      position: fixed;
      inset: 0;
      z-index: 9999;
      background: var(--bg-surface, #ffffff);
      padding: 1.25rem;
      height: 100vh;
      width: 100vw;
    }

    .reportiq-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 1rem;
      padding: 0.25rem 0;
    }

    .header-left {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .title-row {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      flex-wrap: wrap;
    }

    .title {
      font-size: 1.45rem;
      font-weight: 800;
      color: var(--text-primary, #0f172a);
      margin: 0;
      letter-spacing: -0.02em;
    }

    .subtitle {
      font-size: 0.875rem;
      color: var(--text-secondary, #64748b);
      margin: 0;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.2rem 0.6rem;
      background: #ecfdf5;
      color: #047857;
      border: 1px solid #a7f3d0;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .status-badge.offline {
      background: #fef2f2;
      color: #b91c1c;
      border-color: #fecaca;
    }

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #10b981;
      animation: pulse 2s infinite;
    }

    .status-badge.offline .status-dot {
      background: #ef4444;
      animation: none;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(1.2); }
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .btn-action {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.5rem 0.85rem;
      background: #ffffff;
      border: 1px solid var(--border-color, #e2e8f0);
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-primary, #1e293b);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-action:hover:not(:disabled) {
      background: #f8fafc;
      border-color: #cbd5e1;
    }

    .btn-action:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-fullscreen {
      background: #087f7b;
      color: #ffffff;
      border-color: #087f7b;
    }

    .btn-fullscreen:hover:not(:disabled) {
      background: #066360;
    }

    .action-icon.spinning {
      display: inline-block;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .iframe-container {
      position: relative;
      flex: 1;
      min-height: 640px;
      border: 1px solid var(--border-color, #e2e8f0);
      border-radius: 12px;
      overflow: hidden;
      background: #ffffff;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }

    .reportiq-iframe {
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    }

    .iframe-loader, .iframe-error {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.96);
      z-index: 10;
      gap: 0.75rem;
      padding: 2rem;
      text-align: center;
    }

    .loader-spinner {
      width: 38px;
      height: 38px;
      border: 3px solid #e2e8f0;
      border-top-color: #087f7b;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .loader-text {
      font-size: 1rem;
      font-weight: 600;
      color: #1e293b;
      margin: 0;
    }

    .loader-sub {
      font-size: 0.8rem;
      color: #64748b;
    }

    .error-icon {
      font-size: 2.2rem;
    }

    .error-text {
      font-size: 0.9rem;
      color: #64748b;
      max-width: 440px;
      margin: 0;
    }

    .btn-retry {
      margin-top: 0.5rem;
      padding: 0.55rem 1.1rem;
      background: #087f7b;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-retry:hover {
      background: #066360;
    }

    .embed-toast {
      position: absolute;
      top: 1rem;
      right: 1rem;
      z-index: 20;
      background: #0f172a;
      color: #ffffff;
      padding: 0.6rem 1rem;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      animation: fadeIn 0.2s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-6px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class ReportiqEmbedComponent implements OnInit, OnDestroy {
  @Input() title = 'Reportes & Analítica IA';
  @Input() subtitle = 'Módulo inteligente de consultas en lenguaje natural, voz y constructor visual QBE';
  @Input() path = '';
  @Input() tab: 'visual' | 'qbe' | 'catalog' | '' = '';
  @Input() prompt = '';

  @ViewChild('reportIframe') iframeRef!: ElementRef<HTMLIFrameElement>;

  private readonly http = inject(HttpClient);
  private readonly sanitizer = inject(DomSanitizer);

  readonly loading = signal(true);
  readonly isFullscreen = signal(false);
  readonly toastMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  safeUrl: SafeResourceUrl | null = null;
  rawUrl = '';
  private messageListener?: (event: MessageEvent) => void;
  private toastTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.loadEmbedConfig();

    // Escuchar eventos emitidos por el iframe (como REPORTIQ_REPORT_GENERATED)
    this.messageListener = (event: MessageEvent) => {
      if (event.data?.type === 'REPORTIQ_REPORT_GENERATED') {
        const count = event.data?.payload?.rowCount ?? 0;
        this.showToast(`Reporte analítico generado (${count} registros)`);
      }
    };
    window.addEventListener('message', this.messageListener);
  }

  ngOnDestroy(): void {
    if (this.messageListener) {
      window.removeEventListener('message', this.messageListener);
    }
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
  }

  loadEmbedConfig(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.http.get<EmbedConfig>('/api/v1/reports/embed-config').subscribe({
      next: (config) => {
        let url = config.embedUrl;
        if (!url.includes('theme=')) {
          url += (url.includes('?') ? '&' : '?') + 'theme=light';
        }

        // Resolver la pestaña a visualizar según tab o path (p.ej. qbe / queries)
        let resolvedTab = this.tab;
        if (!resolvedTab && this.path) {
          if (this.path.includes('qbe') || this.path.includes('queries')) {
            resolvedTab = 'qbe';
          } else if (this.path.includes('catalog') || this.path.includes('kpi') || this.path.includes('dashboard')) {
            resolvedTab = 'catalog';
          }
        }
        if (resolvedTab) {
          url += '&tab=' + encodeURIComponent(resolvedTab);
        }

        if (this.prompt) {
          url += '&prompt=' + encodeURIComponent(this.prompt);
        }

        this.rawUrl = url;
        this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.rawUrl);
      },
      error: (err) => {
        this.loading.set(false);
        const msg =
          err?.error?.message ||
          err?.message ||
          'No se pudo conectar con el motor de Reportes ReportIQ.';
        this.errorMessage.set(msg);
      },
    });
  }

  onIframeLoad(): void {
    this.loading.set(false);
  }

  reloadIframe(): void {
    if (!this.rawUrl) {
      this.loadEmbedConfig();
      return;
    }
    this.loading.set(true);
    if (this.iframeRef?.nativeElement) {
      this.iframeRef.nativeElement.src = this.rawUrl;
    }
  }

  openInNewTab(): void {
    if (this.rawUrl) {
      window.open(this.rawUrl, '_blank');
    }
  }

  toggleFullscreen(): void {
    this.isFullscreen.update((v) => !v);
  }

  private showToast(msg: string): void {
    this.toastMessage.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastMessage.set(null), 3500);
  }
}
