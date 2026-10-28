import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

/** Public site footer shared by /welcome, /nosotros and /contacto. */
@Component({
  selector: 'app-site-footer',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  template: `
    <footer class="site-footer">
      <div class="grid">
        <div class="about">
          <a routerLink="/welcome" class="brand"><span class="brand-mark" aria-hidden="true">N</span><b>NexoDocs</b></a>
          <p>{{ 'site.footer.tagline' | translate }}</p>
          <a routerLink="/contacto" class="contact">{{ 'site.band.contact' | translate }} →</a>
        </div>
        <div>
          <h4>{{ 'site.footer.product' | translate }}</h4>
          <a routerLink="/welcome" fragment="features">{{ 'site.nav.solutions' | translate }}</a>
          <a routerLink="/welcome" fragment="clinical">{{ 'site.nav.clinical' | translate }}</a>
          <a routerLink="/planes">{{ 'site.nav.pricing' | translate }}</a>
          <a routerLink="/register">{{ 'site.footer.demo' | translate }}</a>
        </div>
        <div>
          <h4>{{ 'site.footer.company' | translate }}</h4>
          <a routerLink="/nosotros">{{ 'site.nav.about' | translate }}</a>
          <a routerLink="/nosotros" fragment="mision">{{ 'site.about.mission' | translate }} · {{ 'site.about.vision' | translate }}</a>
          <a routerLink="/contacto">{{ 'site.nav.contact' | translate }}</a>
        </div>
        <div>
          <h4>{{ 'site.footer.access' | translate }}</h4>
          <a routerLink="/login">{{ 'marketing.login' | translate }}</a>
          <a routerLink="/forgot-password">{{ 'site.footer.forgot' | translate }}</a>
          <a routerLink="/planes">{{ 'marketing.start' | translate }}</a>
        </div>
      </div>
      <div class="bottom">
        <span>{{ 'site.footer.rights' | translate: { year: year } }}</span>
        <button type="button" (click)="toTop()">{{ 'site.footer.top' | translate }} ↑</button>
      </div>
    </footer>
  `,
  styles: [`
    .site-footer { background: linear-gradient(180deg, #0b2420, #071916); color: #b6d7ce; padding: 64px clamp(16px, 5vw, 72px) 28px; }
    .grid { max-width: 1180px; margin: 0 auto; display: grid; grid-template-columns: 1.6fr 1fr 1fr 1fr; gap: 36px; }
    .brand { display: inline-flex; align-items: center; gap: 10px; text-decoration: none; }
    .brand-mark { width: 32px; height: 32px; border-radius: 10px; display: grid; place-items: center; background: linear-gradient(135deg, #0f766e, #10b981); color: #fff; font-weight: 900; }
    .brand b { color: #fff; font-size: 19px; }
    .about p { max-width: 320px; line-height: 1.6; font-size: 14px; margin: 16px 0; }
    .contact { color: #62e3c4; font-weight: 800; text-decoration: none; font-size: 14px; }
    h4 { color: #fff; font-size: 13px; letter-spacing: .1em; text-transform: uppercase; margin: 4px 0 14px; }
    .grid > div:not(.about) { display: flex; flex-direction: column; gap: 10px; }
    .grid a:not(.brand):not(.contact) { color: #b6d7ce; text-decoration: none; font-size: 14px; transition: color .2s; }
    .grid a:hover { color: #62e3c4; }
    .bottom { max-width: 1180px; margin: 44px auto 0; padding-top: 22px; border-top: 1px solid rgba(98, 227, 196, 0.15); display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; font-size: 13px; }
    .bottom button { background: none; border: 1px solid rgba(98, 227, 196, 0.3); color: #62e3c4; border-radius: 999px; padding: 6px 14px; font-weight: 700; font-size: 12px; font-family: inherit; cursor: pointer; }
    a:focus-visible, button:focus-visible { outline: 2px solid #62e3c4; outline-offset: 3px; }
    @media (max-width: 860px) { .grid { grid-template-columns: 1fr 1fr; } .about { grid-column: 1 / -1; } }
  `],
})
export class SiteFooter {
  readonly year = new Date().getFullYear();

  toTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
