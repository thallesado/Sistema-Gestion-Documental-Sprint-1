import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

const INJECT_SRC = 'https://cdn.botpress.cloud/webchat/v5.0/inject.js';
const SCRIPT_MARK = 'data-nexodocs-chatbot';
/** Contenedores que crea el webchat de Botpress v5 en el <body> (ver window.botpress.webchatId / fabId / messagePreviewId). */
const WIDGET_ELEMENT_IDS = ['webchat-root', 'fab-root', 'message-preview-root'];

/** Identificadores públicos del webchat (los mismos del script de configuración que estaba en index.html). */
const BOTPRESS_CONFIG = {
  botId: '74d9ec2c-805c-434d-b92a-ff04c83c4196',
  clientId: '01223746-a182-4923-9295-c066c1bffc48',
  configuration: {
    version: 'v2',
    website: {},
    email: {},
    phone: {},
    termsOfService: {},
    privacyPolicy: {},
    citationsEnabled: true,
    agentPresenceEnabled: true,
  },
};

type BotpressWindow = Window & { botpress?: { close?: () => void } };

/**
 * Carga el webchat de Botpress solo mientras hay una sesión dentro del layout autenticado
 * y lo retira del DOM al salir (logout, sesión expirada o pantalla pública).
 */
@Injectable({ providedIn: 'root' })
export class ChatbotService {
  private readonly document = inject(DOCUMENT);
  private loading = false;
  private active = false;

  /** Idempotente: si ya está cargado o cargándose no hace nada. */
  load(): void {
    if (this.active || this.loading) return;
    this.loading = true;

    const inject = this.document.createElement('script');
    inject.src = INJECT_SRC;
    inject.async = true;
    inject.setAttribute(SCRIPT_MARK, 'inject');
    inject.onload = () => {
      // Si mientras descargaba el usuario ya salió del layout, no se inicializa.
      if (!this.loading) return;
      const init = this.document.createElement('script');
      init.setAttribute(SCRIPT_MARK, 'init');
      init.text = `window.botpress.init(${JSON.stringify(BOTPRESS_CONFIG)});`;
      this.document.body.appendChild(init);
      this.loading = false;
      this.active = true;
    };
    inject.onerror = () => { this.loading = false; };
    this.document.body.appendChild(inject);
  }

  /** Cierra el chat y elimina scripts y contenedores del DOM. */
  unload(): void {
    this.loading = false;
    this.active = false;
    const win = this.document.defaultView as BotpressWindow | null;
    try { win?.botpress?.close?.(); } catch { /* el widget aún no estaba listo */ }
    this.document.querySelectorAll(`script[${SCRIPT_MARK}]`).forEach((el) => el.remove());
    WIDGET_ELEMENT_IDS.forEach((id) => this.document.getElementById(id)?.remove());
    if (win) delete win.botpress;
  }
}
