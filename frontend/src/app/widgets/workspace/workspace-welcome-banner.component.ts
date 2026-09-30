import { CommonModule, UpperCasePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-workspace-welcome-banner',
  standalone: true,
  imports: [CommonModule, RouterLink, UpperCasePipe],
  template: `
    <section class="dashboard-welcome">
      <div class="welcome-left">
        <p class="eyebrow">{{ todayLabel() | uppercase }}</p>
        <h1>Buenos días, {{ displayName() }}</h1>
        <p class="welcome-copy">Aquí tienes un resumen de lo que está ocurriendo en tu organización.</p>
      </div>
      <div class="welcome-illustration-wrap">
        <svg viewBox="0 0 240 180" fill="none" xmlns="http://www.w3.org/2000/svg" class="hero-folder-svg">
          <circle cx="120" cy="90" r="75" fill="#d9f3ee" fill-opacity="0.7"/>
          <path d="M178 40 C194 36 206 48 202 65 C192 65 180 54 178 40 Z" fill="#8bc9bd"/>
          <path d="M192 30 C207 27 217 37 214 50 C207 50 197 42 192 30 Z" fill="#a4dcce"/>
          <path d="M188 112 C204 118 208 133 198 143 C188 138 183 123 188 112 Z" fill="#78bfb2"/>
          <rect x="74" y="42" width="72" height="92" rx="8" fill="#ffffff" stroke="#c8e4de" stroke-width="2"/>
          <rect x="88" y="58" width="44" height="4" rx="2" fill="#d4ece7"/>
          <rect x="88" y="68" width="36" height="4" rx="2" fill="#d4ece7"/>
          <rect x="88" y="78" width="28" height="4" rx="2" fill="#d4ece7"/>
          <path d="M58 84 C58 78 63 74 69 74 L98 74 L110 84 L171 84 C177 84 182 89 182 95 L182 136 C182 143 177 148 170 148 L70 148 C63 148 58 143 58 136 Z" fill="#4ea99b"/>
          <path d="M58 92 C58 86 63 82 69 82 L171 82 C177 82 182 87 182 93 L182 136 C182 143 177 148 170 148 L70 148 C63 148 58 143 58 136 Z" fill="#138072"/>
        </svg>
      </div>
      <div class="hero-actions">
        <a routerLink="/documents/new" class="btn-primary-action">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span>Crear documento</span>
        </a>
        <a routerLink="/documents/upload" class="btn-secondary-action">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
          <span>Subir archivo</span>
        </a>
      </div>
    </section>
  `
})
export class WorkspaceWelcomeBannerComponent {
  readonly todayLabel = input<string>(new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
  readonly displayName = input.required<string>();
}
