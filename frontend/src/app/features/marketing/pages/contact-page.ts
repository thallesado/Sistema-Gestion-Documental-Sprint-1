import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { RevealDirective } from '../components/reveal.directive';
import { SiteFooter } from '../components/site-footer';
import { SiteHeader } from '../components/site-header';

type Topic = 'VENTAS' | 'SOPORTE' | 'DEMO' | 'ALIANZAS' | 'OTRO';

/** Public «Contáctanos» page; the backend emails the message to the sales inbox. */
@Component({
  selector: 'app-contact-page',
  standalone: true,
  imports: [FormsModule, RouterLink, TranslatePipe, RevealDirective, SiteHeader, SiteFooter],
  template: `
  <app-site-header />
  <main class="contact-page">
    <section class="page-hero">
      <div class="blob" aria-hidden="true"></div>
      <div class="hero-inner">
        <span class="kicker fade-up">{{ 'site.contactPage.kicker' | translate }}</span>
        <h1 class="fade-up d1">{{ 'site.contactPage.title' | translate }}</h1>
        <p class="fade-up d2">{{ 'site.contactPage.intro' | translate }}</p>
      </div>
    </section>

    <section class="layout">
      <div class="form-card fade-up d2">
        @if (sentMessage()) {
          <div class="sent" role="status">
            <span class="sent-icon">✓</span>
            <h2>{{ 'site.contactPage.sentTitle' | translate }}</h2>
            <p>{{ sentMessage() }}</p>
            <button type="button" class="btn btn-secondary" (click)="reset()">{{ 'site.contactPage.another' | translate }}</button>
          </div>
        } @else {
          <form #contactForm="ngForm" (ngSubmit)="contactForm.valid && send()" novalidate>
            <div class="row">
              <label>{{ 'site.contactPage.name' | translate }}
                <input name="name" [(ngModel)]="form.name" required maxlength="120" autocomplete="name">
              </label>
              <label>{{ 'site.contactPage.email' | translate }}
                <input name="email" type="email" [(ngModel)]="form.email" required email maxlength="150" autocomplete="email">
              </label>
            </div>
            <div class="row">
              <label>{{ 'site.contactPage.organization' | translate }}
                <input name="organization" [(ngModel)]="form.organization" maxlength="160" autocomplete="organization">
              </label>
              <label>{{ 'site.contactPage.phone' | translate }}
                <input name="phone" type="tel" [(ngModel)]="form.phone" maxlength="40" autocomplete="tel">
              </label>
            </div>
            <fieldset>
              <legend>{{ 'site.contactPage.topic' | translate }}</legend>
              <div class="topics">
                @for (topic of topics; track topic.code) {
                  <button type="button" [class.active]="form.topic === topic.code" [attr.aria-pressed]="form.topic === topic.code" (click)="form.topic = topic.code">
                    {{ topic.key | translate }}
                  </button>
                }
              </div>
            </fieldset>
            <label>{{ 'site.contactPage.message' | translate }}
              <textarea name="message" rows="6" [(ngModel)]="form.message" required minlength="10" maxlength="4000" [placeholder]="'site.contactPage.messagePlaceholder' | translate"></textarea>
            </label>
            @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
            <button type="submit" class="btn btn-primary" [disabled]="sending() || !contactForm.valid">
              {{ (sending() ? 'site.contactPage.sending' : 'site.contactPage.send') | translate }}
            </button>
          </form>
        }
      </div>

      <aside class="side">
        <article appReveal="0">
          <span class="icon">◇</span>
          <h3>{{ 'site.contactPage.salesTitle' | translate }}</h3>
          <p>{{ 'site.contactPage.salesText' | translate }}</p>
          <a routerLink="/planes">{{ 'site.contactPage.salesLink' | translate }} →</a>
        </article>
        <article appReveal="120">
          <span class="icon">✦</span>
          <h3>{{ 'site.contactPage.demoTitle' | translate }}</h3>
          <p>{{ 'site.contactPage.demoText' | translate }}</p>
          <a routerLink="/register">{{ 'site.contactPage.demoLink' | translate }} →</a>
        </article>
        <article appReveal="240">
          <span class="icon">◈</span>
          <h3>{{ 'site.contactPage.supportTitle' | translate }}</h3>
          <p>{{ 'site.contactPage.supportText' | translate }}</p>
          <a routerLink="/login">{{ 'site.contactPage.supportLink' | translate }} →</a>
        </article>
      </aside>
    </section>
  </main>
  <app-site-footer />
  `,
  styles: [`
    :host { display: block; background: #f7fcfa; color: #133d36; }
    .contact-page { overflow-x: clip; }
    .kicker { color: #0d9488; font-size: 11px; font-weight: 800; letter-spacing: .16em; }
    .page-hero { position: relative; overflow: hidden; padding: 80px 16px 48px; text-align: center; }
    .blob { position: absolute; width: 520px; height: 520px; border-radius: 50%; background: #b7f2db; filter: blur(70px); opacity: .55; top: -240px; left: 50%; translate: -50% 0; animation: drift 12s ease-in-out infinite alternate; }
    @keyframes drift { to { transform: scale(1.12) translateY(20px); } }
    .hero-inner { position: relative; max-width: 760px; margin: 0 auto; }
    h1 { font-size: clamp(32px, 4.4vw, 50px); letter-spacing: -.05em; line-height: 1.06; margin: 14px 0; color: #123c36; }
    .page-hero p { color: #587972; font-size: 18px; line-height: 1.6; margin: 0; }
    .fade-up { animation: fadeUp .8s cubic-bezier(.2, .7, .2, 1) both; }
    .d1 { animation-delay: .1s; } .d2 { animation-delay: .2s; }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }

    .layout { max-width: 1180px; margin: 0 auto; padding: 16px 16px 96px; display: grid; grid-template-columns: 1.6fr 1fr; gap: 24px; align-items: start; }
    .form-card { background: #fff; border: 1px solid #dbece7; border-radius: 24px; padding: 34px; box-shadow: 0 24px 60px rgba(11, 66, 50, .1); }
    form { display: grid; gap: 18px; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    label, legend { display: grid; gap: 7px; font-size: 13px; font-weight: 750; color: #123c36; }
    input, textarea { border: 1px solid #cfe5df; border-radius: 10px; padding: 12px; font: inherit; color: #123c36; background: #fff; transition: border-color .15s, box-shadow .15s; resize: vertical; }
    input:focus, textarea:focus { outline: none; border-color: #0f766e; box-shadow: 0 0 0 3px rgba(15, 118, 110, .15); }
    input.ng-invalid.ng-touched, textarea.ng-invalid.ng-touched { border-color: #e2a08f; }
    fieldset { border: 0; padding: 0; margin: 0; }
    legend { margin-bottom: 8px; }
    .topics { display: flex; flex-wrap: wrap; gap: 8px; }
    .topics button { border: 1px solid #cfe5df; background: #f6faf9; color: #3f6b62; border-radius: 999px; padding: 8px 14px; font-weight: 700; font-size: 13px; font-family: inherit; cursor: pointer; transition: background .15s, color .15s; }
    .topics button.active { background: #0f766e; border-color: #0f766e; color: #fff; }
    .error { color: #a23b28; margin: 0; }
    .btn { display: inline-flex; justify-content: center; border-radius: 12px; padding: 14px 22px; font-weight: 800; font-size: 15px; font-family: inherit; text-decoration: none; cursor: pointer; border: 0; transition: transform .2s, box-shadow .2s, opacity .2s; }
    .btn-primary { background: linear-gradient(135deg, #0f766e, #10b981); color: #fff; box-shadow: 0 10px 24px rgba(16, 185, 129, .3); }
    .btn-primary:hover:not(:disabled) { transform: translateY(-2px); }
    .btn:disabled { opacity: .55; cursor: not-allowed; }
    .btn-secondary { background: #e9f7f3; color: #0d6d60; }
    .sent { text-align: center; padding: 40px 10px; }
    .sent-icon { width: 64px; height: 64px; margin: 0 auto 16px; border-radius: 50%; display: grid; place-items: center; background: #dff7f3; color: #0f766e; font-size: 30px; font-weight: 900; animation: pop .5s cubic-bezier(.2, .9, .3, 1.4) both; }
    @keyframes pop { from { transform: scale(.4); opacity: 0; } }
    .sent h2 { margin: 0 0 8px; }
    .sent p { color: #587972; margin: 0 0 22px; line-height: 1.6; }

    .side { display: grid; gap: 16px; }
    .side article { background: #fff; border: 1px solid #dbece7; border-radius: 18px; padding: 22px; transition: transform .25s, box-shadow .25s; }
    .side article:hover { transform: translateY(-4px); box-shadow: 0 16px 34px rgba(11, 66, 50, .1); }
    .icon { width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center; background: #dff7f3; color: #0d9488; font-size: 20px; }
    .side h3 { margin: 14px 0 6px; font-size: 17px; }
    .side p { margin: 0 0 12px; color: #66847e; font-size: 14px; line-height: 1.55; }
    .side a { color: #0f766e; font-weight: 800; text-decoration: none; font-size: 14px; }
    a:focus-visible, button:focus-visible { outline: 2px solid #0f766e; outline-offset: 3px; }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }
    @media (max-width: 560px) { .row { grid-template-columns: 1fr; } .form-card { padding: 24px 18px; } }
    @media (prefers-reduced-motion: reduce) { .blob, .fade-up, .sent-icon { animation: none; } }
  `],
})
export class ContactPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(I18nService);

  readonly topics: ReadonlyArray<{ code: Topic; key: string }> = [
    { code: 'VENTAS', key: 'site.contactPage.tVentas' },
    { code: 'DEMO', key: 'site.contactPage.tDemo' },
    { code: 'SOPORTE', key: 'site.contactPage.tSoporte' },
    { code: 'ALIANZAS', key: 'site.contactPage.tAlianzas' },
    { code: 'OTRO', key: 'site.contactPage.tOtro' },
  ];
  readonly sending = signal(false);
  readonly error = signal('');
  readonly sentMessage = signal('');
  form = { name: '', email: '', organization: '', phone: '', topic: 'VENTAS' as Topic, message: '' };

  ngOnInit(): void {
    window.scrollTo(0, 0);
  }

  send(): void {
    this.sending.set(true);
    this.error.set('');
    this.http.post<{ message: string }>('/api/v1/public/contact', this.form).subscribe({
      next: (response) => {
        this.sending.set(false);
        this.sentMessage.set(response.message);
      },
      error: (err) => {
        this.sending.set(false);
        this.error.set(err?.status === 429
          ? 'Demasiados mensajes desde esta conexión. Inténtalo más tarde.'
          : err?.error?.message || this.i18n.t('site.contactPage.error'));
      },
    });
  }

  reset(): void {
    this.form = { name: '', email: '', organization: '', phone: '', topic: 'VENTAS', message: '' };
    this.sentMessage.set('');
  }
}
