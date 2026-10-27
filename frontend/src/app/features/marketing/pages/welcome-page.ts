import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { I18nService } from '../../../core/i18n/i18n.service';
import { SubscriptionService } from '../../../core/subscription/subscription.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { RevealDirective } from '../components/reveal.directive';
import { SiteFooter } from '../components/site-footer';
import { SiteHeader } from '../components/site-header';

@Component({
  selector: 'app-welcome-page',
  standalone: true,
  imports: [RouterLink, TranslatePipe, RevealDirective, SiteHeader, SiteFooter],
  template: `
  <app-site-header />
  <main class="welcome">
    <!-- Hero -->
    <section class="hero">
      <div class="blob blob-a" aria-hidden="true"></div>
      <div class="blob blob-b" aria-hidden="true"></div>
      <div class="hero-inner">
        <div class="hero-copy">
          <span class="kicker fade-up">{{ 'marketing.kicker' | translate }}</span>
          <h1 class="fade-up d1">{{ 'marketing.heroTitle' | translate }}</h1>
          <p class="fade-up d2">{{ 'marketing.heroSubtitle' | translate }}</p>
          <div class="hero-cta fade-up d3">
            <a routerLink="/register" class="btn btn-primary">{{ 'site.hero.demo' | translate }}</a>
            <a routerLink="/planes" class="btn btn-secondary">{{ 'site.hero.plans' | translate }}</a>
            <a routerLink="/contacto" class="btn btn-ghost">{{ 'site.hero.contact' | translate }} →</a>
          </div>
          <ul class="chips fade-up d4">
            <li>🛡 {{ 'site.hero.chipIsolation' | translate }}</li>
            <li>✦ {{ 'site.hero.chipOcr' | translate }}</li>
            <li>⛓ {{ 'site.hero.chipAudit' | translate }}</li>
          </ul>
        </div>

        <div class="hero-visual fade-up d2" aria-hidden="true">
          <div class="hero-preview">
            <div class="preview-top"><i></i><i></i><i></i><b>NexoDocs</b></div>
            <div class="preview-layout">
              <aside><b></b><b></b><b></b><b></b></aside>
              <section>
                <small>{{ 'marketing.previewLabel' | translate }}</small>
                <h3>{{ 'marketing.previewTitle' | translate }}</h3>
                <div class="preview-chart"><i></i><i></i><i></i><i></i><i></i></div>
                <div class="preview-cards"><b></b><b></b><b></b></div>
              </section>
            </div>
          </div>
          <div class="float-card float-a">
            <span class="dot ok">✓</span>
            <div><b>{{ 'site.hero.floatSigned' | translate }}</b><small>{{ 'site.hero.floatSignedText' | translate }}</small></div>
          </div>
          <div class="float-card float-b">
            <span class="dot">✦</span>
            <div><b>{{ 'site.hero.floatOcr' | translate }}</b><small>{{ 'site.hero.floatOcrText' | translate }}</small></div>
          </div>
        </div>
      </div>
    </section>

    <!-- Soluciones -->
    <section id="features" class="section">
      <header class="section-head" appReveal>
        <span class="kicker">{{ 'marketing.solutions' | translate }}</span>
        <h2>{{ 'marketing.solutionsTitle' | translate }}</h2>
      </header>
      <div class="module-grid">
        <article appReveal="0"><b>⌁</b><h3>{{ 'marketing.moduleClinical' | translate }}</h3><p>{{ 'marketing.moduleClinicalText' | translate }}</p></article>
        <article appReveal="100"><b>◇</b><h3>{{ 'marketing.moduleWorkflow' | translate }}</h3><p>{{ 'marketing.moduleWorkflowText' | translate }}</p></article>
        <article appReveal="200"><b>✦</b><h3>{{ 'marketing.moduleOcr' | translate }}</h3><p>{{ 'marketing.moduleOcrText' | translate }}</p></article>
        <article appReveal="300"><b>◈</b><h3>{{ 'marketing.moduleSecurity' | translate }}</h3><p>{{ 'marketing.moduleSecurityText' | translate }}</p></article>
      </div>
    </section>

    <!-- Módulo clínico -->
    <section id="clinical" class="clinical">
      <div class="clinical-inner">
        <div appReveal>
          <span class="kicker light">{{ 'site.clinical.kicker' | translate }}</span>
          <h2>{{ 'site.clinical.title' | translate }}</h2>
          <p>{{ 'site.clinical.text' | translate }}</p>
          <ul>
            <li>{{ 'site.clinical.b1' | translate }}</li>
            <li>{{ 'site.clinical.b2' | translate }}</li>
            <li>{{ 'site.clinical.b3' | translate }}</li>
            <li>{{ 'site.clinical.b4' | translate }}</li>
          </ul>
          <a routerLink="/register" class="btn btn-light">{{ 'site.clinical.cta' | translate }} →</a>
        </div>
        <div class="record-card" appReveal="150" aria-hidden="true">
          <div class="record-head"><span class="avatar">MP</span><div><b>{{ 'site.clinical.cardTitle' | translate }}</b><small>HC-2026-0418</small></div></div>
          <div class="record-row"><span>{{ 'site.clinical.cardRow1' | translate }}</span><i class="tag">v4</i></div>
          <div class="record-row"><span>{{ 'site.clinical.cardRow2' | translate }}</span><i class="tag">12</i></div>
          <div class="record-row"><span>{{ 'site.clinical.cardRow3' | translate }}</span><i class="tag">3</i></div>
          <div class="record-row"><span>{{ 'site.clinical.cardRow4' | translate }}</span><i class="tag">OCR</i></div>
          <div class="pulse-line"></div>
        </div>
      </div>
    </section>

    <!-- Cómo funciona -->
    <section class="section how">
      <header class="section-head" appReveal>
        <span class="kicker">{{ 'site.how.kicker' | translate }}</span>
        <h2>{{ 'site.how.title' | translate }}</h2>
      </header>
      <ol class="steps">
        <li appReveal="0"><span class="step-num">1</span><h3>{{ 'site.how.s1' | translate }}</h3><p>{{ 'site.how.s1Text' | translate }}</p></li>
        <li appReveal="120"><span class="step-num">2</span><h3>{{ 'site.how.s2' | translate }}</h3><p>{{ 'site.how.s2Text' | translate }}</p></li>
        <li appReveal="240"><span class="step-num">3</span><h3>{{ 'site.how.s3' | translate }}</h3><p>{{ 'site.how.s3Text' | translate }}</p></li>
      </ol>
    </section>

    <!-- Quiénes somos -->
    <section id="about" class="section about">
      <div class="about-copy" appReveal>
        <span class="kicker">{{ 'site.about.kicker' | translate }}</span>
        <h2>{{ 'site.about.title' | translate }}</h2>
        <p>{{ 'site.about.text' | translate }}</p>
        <a routerLink="/nosotros" class="text-link">{{ 'site.about.more' | translate }} →</a>
      </div>
      <div class="about-cards">
        <article appReveal="100"><span class="icon">◎</span><h3>{{ 'site.about.mission' | translate }}</h3><p>{{ 'site.about.missionText' | translate }}</p></article>
        <article appReveal="220"><span class="icon">✧</span><h3>{{ 'site.about.vision' | translate }}</h3><p>{{ 'site.about.visionText' | translate }}</p></article>
      </div>
    </section>

    <!-- Planes -->
    <section id="pricing" class="pricing">
      <header class="section-head" appReveal>
        <span class="kicker">{{ 'marketing.pricing' | translate }}</span>
        <h2>{{ 'marketing.pricingTitle' | translate }}</h2>
      </header>
      <div class="pricing-grid">
        @for (plan of subscription.plans(); track plan.code; let i = $index) {
          <article [appReveal]="i * 120" [class.pro]="plan.code === 'PRO'" [class.enterprise]="plan.code === 'ENTERPRISE'">
            @if (plan.code === 'PRO') { <em>✨ {{ 'subscription.recommended' | translate }}</em> }
            <small>{{ plan.code === 'PRO' ? ('subscription.advanced' | translate) : plan.code === 'ENTERPRISE' ? 'ENTERPRISE' : ('subscription.starter' | translate) }}</small>
            <h3>{{ 'subscription.plans.' + plan.code + '.name' | translate }}</h3>
            <p>{{ 'subscription.plans.' + plan.code + '.description' | translate }}</p>
            <ul>
              <li>✓ {{ 'marketing.planUsers' | translate }}</li>
              <li>✓ {{ 'marketing.planStorage' | translate }}</li>
              <li>✓ {{ 'marketing.planSecurity' | translate }}</li>
            </ul>
            <a routerLink="/planes" [queryParams]="{ comprar: plan.code }">{{ plan.code === 'BASIC' ? ('marketing.startBasic' | translate) : plan.code === 'PRO' ? ('marketing.buyPro' | translate) : ('billing.activate' | translate) }}</a>
          </article>
        } @empty {
          <p>{{ 'common.loading' | translate }}</p>
        }
      </div>
      <p class="pricing-more" appReveal><a routerLink="/planes" class="text-link">{{ 'site.hero.plans' | translate }} →</a></p>
    </section>

    <!-- Enterprise -->
    <section id="enterprise" class="enterprise-banner">
      <div appReveal>
        <span class="kicker light">ENTERPRISE</span>
        <h2>{{ 'marketing.enterpriseTitle' | translate }}</h2>
        <p>{{ 'marketing.enterpriseText' | translate }}</p>
      </div>
      <a routerLink="/planes" [queryParams]="{ comprar: 'ENTERPRISE' }" class="btn btn-light" appReveal="120">{{ 'billing.activate' | translate }} →</a>
    </section>

    <!-- Contacto -->
    <section class="contact-band">
      <div class="contact-inner" appReveal>
        <h2>{{ 'site.band.title' | translate }}</h2>
        <p>{{ 'site.band.text' | translate }}</p>
        <div class="band-actions">
          <a routerLink="/contacto" class="btn btn-primary">{{ 'site.band.contact' | translate }}</a>
          <a routerLink="/register" class="btn btn-secondary">{{ 'site.band.demo' | translate }}</a>
        </div>
      </div>
    </section>
  </main>
  <app-site-footer />
  `,
  styles: [`
    :host { display: block; background: #f7fcfa; color: #133d36; }
    .welcome { overflow-x: clip; }
    .kicker { color: #0d9488; font-size: 11px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
    .kicker.light { color: #62e3c4; }
    .btn { display: inline-flex; align-items: center; justify-content: center; border-radius: 12px; padding: 13px 20px; font-size: 14px; font-weight: 800; text-decoration: none; transition: transform .2s, box-shadow .2s, background .2s; }
    .btn:hover { transform: translateY(-2px); }
    .btn-primary { background: linear-gradient(135deg, #0f766e, #10b981); color: #fff; box-shadow: 0 10px 24px rgba(16, 185, 129, .3); }
    .btn-primary:hover { box-shadow: 0 14px 30px rgba(16, 185, 129, .4); }
    .btn-secondary { background: #fff; color: #176056; border: 1px solid #b6dcd2; }
    .btn-ghost { color: #0f766e; padding-inline: 10px; }
    .btn-light { background: #d8faec; color: #0a3b31; }
    .text-link { color: #0f766e; font-weight: 800; text-decoration: none; }
    .text-link:hover { text-decoration: underline; }
    a:focus-visible { outline: 2px solid #0f766e; outline-offset: 3px; }

    /* Hero */
    .hero { position: relative; padding: 72px 16px 96px; overflow: hidden; }
    .blob { position: absolute; border-radius: 50%; filter: blur(60px); opacity: .55; animation: drift 14s ease-in-out infinite alternate; }
    .blob-a { width: 460px; height: 460px; background: #b7f2db; top: -140px; left: -120px; }
    .blob-b { width: 380px; height: 380px; background: #c9f1ec; bottom: -120px; right: -80px; animation-delay: -6s; }
    @keyframes drift { to { transform: translate(40px, 30px) scale(1.08); } }
    .hero-inner { position: relative; max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: 1.05fr 1fr; gap: 64px; align-items: center; }
    .hero h1 { font-size: clamp(36px, 4.4vw, 58px); letter-spacing: -.055em; line-height: 1.03; margin: 16px 0; color: #123c36; }
    .hero-copy p { color: #587972; font-size: 18px; line-height: 1.65; max-width: 580px; margin: 0; }
    .hero-cta { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 30px; }
    .chips { list-style: none; padding: 0; margin: 28px 0 0; display: flex; flex-wrap: wrap; gap: 10px; }
    .chips li { background: rgba(255, 255, 255, .8); border: 1px solid #d4e9e3; border-radius: 999px; padding: 7px 13px; font-size: 13px; font-weight: 600; color: #2f6a60; }
    .fade-up { animation: fadeUp .8s cubic-bezier(.2, .7, .2, 1) both; }
    .d1 { animation-delay: .1s; } .d2 { animation-delay: .2s; } .d3 { animation-delay: .3s; } .d4 { animation-delay: .4s; }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }

    .hero-visual { position: relative; }
    .hero-preview { background: #fff; border: 1px solid #d4e9e3; border-radius: 22px; box-shadow: 0 30px 70px rgba(11, 64, 55, .16); overflow: hidden; transform: perspective(1200px) rotateY(-8deg) rotateX(4deg); animation: floatY 7s ease-in-out infinite; }
    @keyframes floatY { 0%, 100% { translate: 0 0; } 50% { translate: 0 -10px; } }
    .preview-top { display: flex; align-items: center; gap: 6px; background: #0b2420; color: #e6fbf3; padding: 13px; }
    .preview-top i { width: 7px; height: 7px; border-radius: 50%; background: #5b8a80; }
    .preview-top b { font-size: 11px; margin-left: 8px; }
    .preview-layout { display: grid; grid-template-columns: 78px 1fr; min-height: 300px; }
    .preview-layout aside { background: #f0faf7; padding: 22px 14px; }
    .preview-layout aside b { display: block; height: 9px; margin: 13px 0; border-radius: 5px; background: #b5ded4; }
    .preview-layout section { padding: 28px; }
    .preview-layout small { color: #0d9488; font-size: 10px; font-weight: 800; }
    .preview-layout h3 { font-size: 19px; margin: 6px 0 14px; }
    .preview-chart { display: flex; align-items: end; gap: 10px; height: 110px; padding: 12px; background: #f4fbf9; border-radius: 12px; }
    .preview-chart i { flex: 1; border-radius: 5px 5px 0 0; background: linear-gradient(#10b981, #0f766e); transform-origin: bottom; animation: grow 1.2s cubic-bezier(.2, .7, .2, 1) both; }
    .preview-chart i:nth-child(1) { height: 35%; animation-delay: .5s; } .preview-chart i:nth-child(2) { height: 60%; animation-delay: .6s; }
    .preview-chart i:nth-child(3) { height: 48%; animation-delay: .7s; } .preview-chart i:nth-child(4) { height: 85%; animation-delay: .8s; }
    .preview-chart i:nth-child(5) { height: 73%; animation-delay: .9s; }
    @keyframes grow { from { transform: scaleY(0); } }
    .preview-cards { display: flex; gap: 10px; margin-top: 14px; }
    .preview-cards b { flex: 1; height: 34px; border-radius: 8px; background: #dff2ec; }
    .float-card { position: absolute; display: flex; align-items: center; gap: 10px; background: #fff; border: 1px solid #d4e9e3; border-radius: 14px; padding: 11px 14px; box-shadow: 0 16px 34px rgba(11, 64, 55, .14); animation: floatY 6s ease-in-out infinite; }
    .float-card b { display: block; font-size: 13px; color: #123c36; }
    .float-card small { font-size: 11px; color: #66847e; }
    .float-a { left: -34px; bottom: 46px; animation-delay: -2s; }
    .float-b { right: -18px; top: 70px; animation-delay: -4s; }
    .dot { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: #dff7f3; color: #0f766e; font-weight: 900; font-size: 13px; }
    .dot.ok { background: #0f766e; color: #fff; }

    /* Secciones */
    .section { max-width: 1180px; margin: 0 auto; padding: 96px 16px; }
    .section-head { text-align: center; max-width: 720px; margin: 0 auto 44px; }
    .section-head h2, .about-copy h2 { font-size: clamp(28px, 3.6vw, 40px); letter-spacing: -.04em; line-height: 1.12; margin: 12px 0 0; color: #123c36; }
    .module-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; }
    .module-grid article { background: #fff; border: 1px solid #dbece7; border-radius: 18px; padding: 26px; transition: transform .25s, box-shadow .25s, border-color .25s; }
    .module-grid article:hover { transform: translateY(-6px); border-color: #a8dccf; box-shadow: 0 20px 40px rgba(11, 66, 50, .1); }
    .module-grid b { width: 46px; height: 46px; border-radius: 14px; display: grid; place-items: center; background: #dff7f3; color: #0d9488; font-size: 22px; }
    .module-grid h3 { font-size: 17px; margin: 18px 0 8px; }
    .module-grid p { color: #66847e; font-size: 14px; line-height: 1.6; margin: 0; }

    .clinical { background: linear-gradient(180deg, #0b2420, #071916); color: #dcf8ee; padding: 96px 16px; }
    .clinical-inner { max-width: 1180px; margin: 0 auto; display: grid; grid-template-columns: 1.1fr 1fr; gap: 64px; align-items: center; }
    .clinical h2 { font-size: clamp(28px, 3.6vw, 40px); letter-spacing: -.04em; line-height: 1.12; color: #fff; margin: 12px 0 16px; }
    .clinical p { color: #a9d9cb; font-size: 16px; line-height: 1.65; }
    .clinical ul { list-style: none; padding: 0; margin: 22px 0 30px; display: grid; gap: 12px; }
    .clinical li { position: relative; padding-left: 30px; color: #dcf8ee; }
    .clinical li::before { content: '✓'; position: absolute; left: 0; top: 0; width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; font-size: 11px; font-weight: 900; background: rgba(98, 227, 196, .18); color: #62e3c4; }
    .record-card { background: rgba(255, 255, 255, .05); border: 1px solid rgba(98, 227, 196, .18); border-radius: 20px; padding: 24px; position: relative; overflow: hidden; }
    .record-head { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
    .avatar { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: linear-gradient(135deg, #0f766e, #10b981); color: #fff; font-weight: 800; }
    .record-head b { display: block; color: #fff; }
    .record-head small { color: #8fc7b8; font-size: 12px; }
    .record-row { display: flex; justify-content: space-between; align-items: center; padding: 14px 0; border-top: 1px solid rgba(98, 227, 196, .12); color: #dcf8ee; font-size: 14px; }
    .tag { font-style: normal; font-size: 12px; font-weight: 800; color: #62e3c4; background: rgba(98, 227, 196, .14); border-radius: 999px; padding: 3px 10px; }
    .pulse-line { position: absolute; left: 0; bottom: 0; height: 3px; width: 40%; background: linear-gradient(90deg, transparent, #62e3c4, transparent); animation: scan 3.2s ease-in-out infinite; }
    @keyframes scan { from { transform: translateX(-100%); } to { transform: translateX(260%); } }

    .steps { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; counter-reset: step; position: relative; }
    .steps::before { content: ''; position: absolute; top: 28px; left: 16%; right: 16%; height: 2px; background: linear-gradient(90deg, #b6dcd2, #10b981, #b6dcd2); }
    .steps li { position: relative; text-align: center; padding: 0 12px; }
    .step-num { position: relative; width: 56px; height: 56px; margin: 0 auto 18px; border-radius: 50%; display: grid; place-items: center; background: #fff; border: 2px solid #10b981; color: #0f766e; font-size: 20px; font-weight: 900; box-shadow: 0 8px 20px rgba(16, 185, 129, .18); }
    .steps h3 { font-size: 18px; margin: 0 0 8px; }
    .steps p { color: #66847e; font-size: 14px; line-height: 1.6; margin: 0; }

    .about { display: grid; grid-template-columns: 1.1fr 1fr; gap: 48px; align-items: center; }
    .about-copy p { color: #587972; font-size: 16px; line-height: 1.7; margin: 18px 0 22px; }
    .about-cards { display: grid; gap: 16px; }
    .about-cards article { background: #fff; border: 1px solid #dbece7; border-radius: 18px; padding: 24px; box-shadow: 0 12px 30px rgba(11, 66, 50, .06); }
    .about-cards .icon { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; background: #dff7f3; color: #0d9488; font-size: 20px; }
    .about-cards h3 { margin: 14px 0 6px; font-size: 18px; }
    .about-cards p { margin: 0; color: #66847e; line-height: 1.6; font-size: 14px; }

    .pricing { background: #f0faf7; padding: 96px 16px; }
    .pricing-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 340px)); justify-content: center; gap: 18px; }
    .pricing-grid article { position: relative; display: flex; flex-direction: column; min-height: 340px; background: #fff; border: 1px solid #d3e8e2; border-radius: 20px; padding: 26px; transition: transform .25s, box-shadow .25s; }
    .pricing-grid article:hover { transform: translateY(-6px); box-shadow: 0 22px 44px rgba(11, 66, 50, .12); }
    .pricing-grid article.pro { border: 2px solid #0d9488; box-shadow: 0 14px 32px rgba(13, 148, 136, .16); }
    .pricing-grid article.enterprise { background: linear-gradient(180deg, #0b2420, #071916); color: #e8fbf4; border-color: transparent; }
    .pricing-grid em { position: absolute; right: 14px; top: -12px; background: #0d9488; color: #fff; border-radius: 999px; font-size: 10px; font-style: normal; font-weight: 800; padding: 5px 9px; }
    .pricing-grid small { color: #0d9488; font-weight: 800; letter-spacing: .1em; }
    .pricing-grid .enterprise small { color: #62e3c4; }
    .pricing-grid h3 { font-size: 26px; margin: 12px 0 6px; }
    .pricing-grid p { color: #66847e; min-height: 50px; }
    .pricing-grid .enterprise p { color: #bad5ce; }
    .pricing-grid ul { list-style: none; padding: 0; color: #397069; font-size: 14px; line-height: 2; }
    .pricing-grid .enterprise ul { color: #a9d9cb; }
    .pricing-grid a { margin-top: auto; text-align: center; text-decoration: none; background: #e9f7f3; color: #0d6d60; border-radius: 12px; padding: 12px; font-size: 14px; font-weight: 800; transition: transform .2s; }
    .pricing-grid a:hover { transform: translateY(-1px); }
    .pricing-grid .pro a { background: linear-gradient(135deg, #0f766e, #10b981); color: #fff; }
    .pricing-grid .enterprise a { background: #d5fae9; color: #083a31; }
    .pricing-more { text-align: center; margin: 30px 0 0; }

    .enterprise-banner { display: flex; align-items: center; justify-content: space-between; gap: 24px; background: #0b2420; color: #e5fbf3; padding: 64px max(16px, calc((100% - 1180px) / 2)); }
    .enterprise-banner h2 { font-size: clamp(24px, 3vw, 32px); margin: 10px 0; }
    .enterprise-banner p { color: #b6d7ce; margin: 0; }

    .contact-band { padding: 96px 16px; background: radial-gradient(circle at 15% 20%, #b7f2db, transparent 40%), radial-gradient(circle at 85% 80%, #c9f1ec, transparent 40%), #f7fcfa; }
    .contact-inner { max-width: 760px; margin: 0 auto; text-align: center; background: rgba(255, 255, 255, .85); border: 1px solid #d4e9e3; border-radius: 28px; padding: 52px 28px; box-shadow: 0 24px 60px rgba(11, 66, 50, .1); }
    .contact-inner h2 { font-size: clamp(26px, 3.4vw, 38px); letter-spacing: -.04em; margin: 0 0 12px; }
    .contact-inner p { color: #587972; line-height: 1.65; margin: 0 auto 26px; max-width: 560px; }
    .band-actions { display: flex; justify-content: center; flex-wrap: wrap; gap: 12px; }

    @media (max-width: 960px) {
      .hero-inner, .clinical-inner, .about { grid-template-columns: 1fr; gap: 44px; }
      .hero-preview { transform: none; }
      .float-a { left: 8px; } .float-b { right: 8px; }
      .module-grid { grid-template-columns: 1fr 1fr; }
      .pricing-grid { grid-template-columns: minmax(0, 460px); }
      .enterprise-banner { flex-direction: column; align-items: flex-start; }
    }
    @media (max-width: 600px) {
      .module-grid, .steps { grid-template-columns: 1fr; }
      .steps::before { display: none; }
      .float-card { display: none; }
      .hero { padding-top: 44px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .blob, .hero-preview, .float-card, .pulse-line, .fade-up, .preview-chart i { animation: none; }
    }
  `],
})
export class WelcomePage implements OnInit {
  readonly i18n = inject(I18nService);
  readonly subscription = inject(SubscriptionService);
  private readonly route = inject(ActivatedRoute);

  constructor() { this.subscription.loadPlans(); }

  ngOnInit(): void {
    // Coming from another page without an anchor: start at the top instead of the old scroll position.
    if (!this.route.snapshot.fragment) window.scrollTo(0, 0);
  }
}
