import { Component, HostListener, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

/** Public site header shared by /welcome, /nosotros and /contacto. */
@Component({
  selector: 'app-site-header',
  standalone: true,
  imports: [FormsModule, RouterLink, RouterLinkActive, TranslatePipe],
  template: `
    <header class="site-header" [class.scrolled]="scrolled()">
      <a routerLink="/welcome" class="brand" (click)="menuOpen.set(false)">
        <span class="brand-mark" aria-hidden="true">N</span>
        <span><b>NexoDocs</b><small>{{ 'shell.documentManagement' | translate }}</small></span>
      </a>
      <button type="button" class="menu-toggle" [attr.aria-expanded]="menuOpen()" [attr.aria-label]="'site.nav.menu' | translate" (click)="menuOpen.set(!menuOpen())">
        <span></span><span></span><span></span>
      </button>
      <div class="menu" [class.open]="menuOpen()">
        <nav (click)="menuOpen.set(false)">
          <a routerLink="/welcome" fragment="features">{{ 'site.nav.solutions' | translate }}</a>
          <a routerLink="/welcome" fragment="clinical">{{ 'site.nav.clinical' | translate }}</a>
          <a routerLink="/planes">{{ 'site.nav.pricing' | translate }}</a>
          <a routerLink="/nosotros" routerLinkActive="active">{{ 'site.nav.about' | translate }}</a>
          <a routerLink="/contacto" routerLinkActive="active">{{ 'site.nav.contact' | translate }}</a>
        </nav>
        <div class="actions">
          <select [ngModel]="i18n.language()" (ngModelChange)="i18n.setLanguage($event)" [ngModelOptions]="{ standalone: true }" aria-label="Idioma">
            @for (language of i18n.languages; track language.code) {
              <option [value]="language.code">{{ language.label }}</option>
            }
          </select>
          <a routerLink="/login" class="login">{{ 'marketing.login' | translate }}</a>
          <a routerLink="/planes" class="start">{{ 'marketing.start' | translate }}</a>
        </div>
      </div>
    </header>
  `,
  styles: [`
    :host { position: sticky; top: 0; z-index: 30; display: block; }
    .site-header {
      display: flex; align-items: center; justify-content: space-between; gap: 24px;
      padding: 14px clamp(16px, 5vw, 72px);
      background: rgba(255, 255, 255, 0.78); backdrop-filter: blur(14px);
      border-bottom: 1px solid transparent; transition: box-shadow .25s, border-color .25s, background .25s;
    }
    .site-header.scrolled { background: rgba(255, 255, 255, 0.94); border-color: #dcebe8; box-shadow: 0 8px 30px rgba(11, 66, 50, 0.08); }
    .brand { display: flex; align-items: center; gap: 10px; text-decoration: none; }
    .brand-mark {
      width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center;
      background: linear-gradient(135deg, #0f766e, #10b981); color: #fff; font-weight: 900; font-size: 17px;
      box-shadow: 0 6px 16px rgba(16, 185, 129, 0.35);
    }
    .brand b { display: block; color: #123c36; font-size: 19px; line-height: 1; }
    .brand small { display: block; color: #0d9488; font-size: 8px; font-weight: 800; letter-spacing: .14em; margin-top: 4px; }
    .menu { display: flex; align-items: center; gap: 28px; flex: 1; justify-content: flex-end; }
    nav { display: flex; gap: 22px; }
    nav a { position: relative; color: #477068; font-size: 14px; font-weight: 600; text-decoration: none; padding: 4px 0; transition: color .2s; }
    nav a::after { content: ''; position: absolute; left: 0; right: 0; bottom: -2px; height: 2px; border-radius: 2px; background: #10b981; transform: scaleX(0); transition: transform .25s; }
    nav a:hover, nav a.active { color: #0f766e; }
    nav a:hover::after, nav a.active::after { transform: scaleX(1); }
    .actions { display: flex; align-items: center; gap: 12px; }
    select { background: #eef9f6; border: 1px solid #cee8e1; border-radius: 999px; color: #1c6157; font-weight: 800; font-size: 11px; font-family: inherit; padding: 7px; }
    .login { color: #1c6157; font-size: 14px; font-weight: 700; text-decoration: none; }
    .start {
      background: linear-gradient(135deg, #0f766e, #10b981); color: #fff; border-radius: 10px;
      padding: 10px 16px; font-size: 14px; font-weight: 800; text-decoration: none; white-space: nowrap;
      box-shadow: 0 8px 20px rgba(16, 185, 129, 0.28); transition: transform .2s, box-shadow .2s;
    }
    .start:hover { transform: translateY(-1px); box-shadow: 0 12px 26px rgba(16, 185, 129, 0.36); }
    a:focus-visible, button:focus-visible, select:focus-visible { outline: 2px solid #0f766e; outline-offset: 3px; }
    .menu-toggle { display: none; background: none; border: 0; padding: 8px; cursor: pointer; }
    .menu-toggle span { display: block; width: 22px; height: 2px; margin: 4px 0; background: #123c36; border-radius: 2px; }
    @media (max-width: 960px) {
      .menu-toggle { display: block; }
      .menu {
        position: absolute; top: 100%; left: 0; right: 0; flex-direction: column; align-items: stretch; gap: 16px;
        padding: 16px; background: #fff; border-bottom: 1px solid #dcebe8; box-shadow: 0 16px 30px rgba(11, 66, 50, 0.1);
        opacity: 0; transform: translateY(-8px); pointer-events: none; transition: opacity .2s, transform .2s;
      }
      .menu.open { opacity: 1; transform: none; pointer-events: auto; }
      nav { flex-direction: column; gap: 4px; }
      nav a { padding: 10px 4px; font-size: 15px; }
      nav a::after { display: none; }
      .actions { justify-content: space-between; flex-wrap: wrap; }
    }
  `],
})
export class SiteHeader {
  readonly i18n = inject(I18nService);
  readonly scrolled = signal(false);
  readonly menuOpen = signal(false);

  @HostListener('window:scroll')
  onScroll(): void {
    this.scrolled.set(window.scrollY > 8);
  }
}
