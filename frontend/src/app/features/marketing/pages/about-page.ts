import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { RevealDirective } from '../components/reveal.directive';
import { SiteFooter } from '../components/site-footer';
import { SiteHeader } from '../components/site-header';

/** Public «Nosotros» page: who we are, mission, vision, values and sectors. */
@Component({
  selector: 'app-about-page',
  standalone: true,
  imports: [RouterLink, TranslatePipe, RevealDirective, SiteHeader, SiteFooter],
  template: `
  <app-site-header />
  <main class="about-page">
    <section class="page-hero">
      <div class="blob" aria-hidden="true"></div>
      <div class="hero-inner">
        <span class="kicker fade-up">{{ 'site.aboutPage.kicker' | translate }}</span>
        <h1 class="fade-up d1">{{ 'site.aboutPage.title' | translate }}</h1>
        <p class="fade-up d2">{{ 'site.aboutPage.intro' | translate }}</p>
      </div>
    </section>

    <section class="section who">
      <div appReveal>
        <span class="kicker">{{ 'site.aboutPage.whoTitle' | translate }}</span>
        <h2>NexoDocs</h2>
      </div>
      <div class="who-text" appReveal="120">
        <p>{{ 'site.aboutPage.who1' | translate }}</p>
        <p>{{ 'site.aboutPage.who2' | translate }}</p>
      </div>
    </section>

    <section id="mision" class="mv">
      <div class="mv-inner">
        <article appReveal>
          <span class="icon">◎</span>
          <h2>{{ 'site.aboutPage.mission' | translate }}</h2>
          <p>{{ 'site.aboutPage.missionText' | translate }}</p>
        </article>
        <article appReveal="150">
          <span class="icon">✧</span>
          <h2>{{ 'site.aboutPage.vision' | translate }}</h2>
          <p>{{ 'site.aboutPage.visionText' | translate }}</p>
        </article>
      </div>
    </section>

    <section class="section">
      <header class="section-head" appReveal><h2>{{ 'site.aboutPage.valuesTitle' | translate }}</h2></header>
      <div class="values">
        <article appReveal="0"><b>🛡</b><h3>{{ 'site.aboutPage.v1' | translate }}</h3><p>{{ 'site.aboutPage.v1Text' | translate }}</p></article>
        <article appReveal="100"><b>⛓</b><h3>{{ 'site.aboutPage.v2' | translate }}</h3><p>{{ 'site.aboutPage.v2Text' | translate }}</p></article>
        <article appReveal="200"><b>✦</b><h3>{{ 'site.aboutPage.v3' | translate }}</h3><p>{{ 'site.aboutPage.v3Text' | translate }}</p></article>
        <article appReveal="300"><b>♡</b><h3>{{ 'site.aboutPage.v4' | translate }}</h3><p>{{ 'site.aboutPage.v4Text' | translate }}</p></article>
      </div>
    </section>

    <section class="section sectors-wrap">
      <header class="section-head" appReveal><h2>{{ 'site.aboutPage.sectorsTitle' | translate }}</h2></header>
      <div class="sectors">
        <article appReveal="0"><span>⌁</span><h3>{{ 'site.aboutPage.sHealth' | translate }}</h3><p>{{ 'site.aboutPage.sHealthText' | translate }}</p></article>
        <article appReveal="120"><span>◇</span><h3>{{ 'site.aboutPage.sBusiness' | translate }}</h3><p>{{ 'site.aboutPage.sBusinessText' | translate }}</p></article>
        <article appReveal="240"><span>◈</span><h3>{{ 'site.aboutPage.sPublic' | translate }}</h3><p>{{ 'site.aboutPage.sPublicText' | translate }}</p></article>
      </div>
    </section>

    <section class="cta">
      <div class="cta-inner" appReveal>
        <h2>{{ 'site.aboutPage.ctaTitle' | translate }}</h2>
        <p>{{ 'site.aboutPage.ctaText' | translate }}</p>
        <div class="cta-actions">
          <a routerLink="/register" class="btn btn-light">{{ 'site.nav.demo' | translate }}</a>
          <a routerLink="/contacto" class="btn btn-outline">{{ 'site.hero.contact' | translate }}</a>
        </div>
      </div>
    </section>
  </main>
  <app-site-footer />
  `,
  styles: [`
    :host { display: block; background: #f7fcfa; color: #133d36; }
    .about-page { overflow-x: clip; }
    .kicker { color: #0d9488; font-size: 11px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
    .page-hero { position: relative; overflow: hidden; padding: 88px 16px 72px; text-align: center; }
    .blob { position: absolute; width: 520px; height: 520px; border-radius: 50%; background: #b7f2db; filter: blur(70px); opacity: .55; top: -220px; left: 50%; translate: -50% 0; animation: drift 12s ease-in-out infinite alternate; }
    @keyframes drift { to { transform: scale(1.12) translateY(20px); } }
    .hero-inner { position: relative; max-width: 860px; margin: 0 auto; }
    .page-hero h1 { font-size: clamp(32px, 4.6vw, 54px); letter-spacing: -.05em; line-height: 1.06; margin: 16px 0; color: #123c36; }
    .page-hero p { color: #587972; font-size: 18px; line-height: 1.7; margin: 0 auto; max-width: 700px; }
    .fade-up { animation: fadeUp .8s cubic-bezier(.2, .7, .2, 1) both; }
    .d1 { animation-delay: .1s; } .d2 { animation-delay: .2s; }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }

    .section { max-width: 1180px; margin: 0 auto; padding: 80px 16px; }
    .section-head { text-align: center; margin-bottom: 40px; }
    h2 { font-size: clamp(26px, 3.4vw, 38px); letter-spacing: -.04em; margin: 10px 0 0; color: #123c36; }
    .who { display: grid; grid-template-columns: 1fr 1.6fr; gap: 48px; align-items: start; }
    .who-text p { color: #4c6f68; font-size: 17px; line-height: 1.75; margin: 0 0 16px; }

    .mv { background: linear-gradient(180deg, #0b2420, #071916); padding: 88px 16px; }
    .mv-inner { max-width: 1180px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
    .mv article { background: rgba(255, 255, 255, .05); border: 1px solid rgba(98, 227, 196, .18); border-radius: 22px; padding: 36px; transition: transform .25s, border-color .25s; }
    .mv article:hover { transform: translateY(-6px); border-color: rgba(98, 227, 196, .4); }
    .mv h2 { color: #fff; }
    .mv p { color: #a9d9cb; font-size: 17px; line-height: 1.7; margin: 14px 0 0; }
    .icon { width: 48px; height: 48px; border-radius: 14px; display: grid; place-items: center; background: rgba(98, 227, 196, .16); color: #62e3c4; font-size: 22px; }

    .values { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; }
    .values article, .sectors article { background: #fff; border: 1px solid #dbece7; border-radius: 18px; padding: 26px; transition: transform .25s, box-shadow .25s; }
    .values article:hover, .sectors article:hover { transform: translateY(-6px); box-shadow: 0 20px 40px rgba(11, 66, 50, .1); }
    .values b, .sectors span { width: 46px; height: 46px; border-radius: 14px; display: grid; place-items: center; background: #dff7f3; color: #0d9488; font-size: 21px; }
    .values h3, .sectors h3 { font-size: 17px; margin: 16px 0 8px; }
    .values p, .sectors p { color: #66847e; font-size: 14px; line-height: 1.6; margin: 0; }
    .sectors-wrap { padding-top: 0; }
    .sectors { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }

    .cta { padding: 0 16px 96px; }
    .cta-inner { max-width: 1180px; margin: 0 auto; text-align: center; border-radius: 28px; padding: 56px 28px; background: linear-gradient(135deg, #0f766e, #10b981); color: #fff; box-shadow: 0 24px 60px rgba(16, 185, 129, .3); }
    .cta-inner h2 { color: #fff; margin: 0 0 12px; }
    .cta-inner p { color: #e6fbf3; margin: 0 auto 26px; max-width: 560px; line-height: 1.6; }
    .cta-actions { display: flex; justify-content: center; flex-wrap: wrap; gap: 12px; }
    .btn { display: inline-flex; border-radius: 12px; padding: 13px 20px; font-size: 14px; font-weight: 800; text-decoration: none; transition: transform .2s; }
    .btn:hover { transform: translateY(-2px); }
    .btn-light { background: #fff; color: #0a3b31; }
    .btn-outline { border: 1px solid rgba(255, 255, 255, .7); color: #fff; }
    a:focus-visible { outline: 2px solid #0f766e; outline-offset: 3px; }

    @media (max-width: 900px) {
      .who, .mv-inner { grid-template-columns: 1fr; gap: 20px; }
      .values { grid-template-columns: 1fr 1fr; }
      .sectors { grid-template-columns: 1fr; }
    }
    @media (max-width: 560px) { .values { grid-template-columns: 1fr; } }
    @media (prefers-reduced-motion: reduce) { .blob, .fade-up { animation: none; } }
  `],
})
export class AboutPage implements OnInit {
  private readonly route = inject(ActivatedRoute);

  ngOnInit(): void {
    if (!this.route.snapshot.fragment) window.scrollTo(0, 0);
  }
}
