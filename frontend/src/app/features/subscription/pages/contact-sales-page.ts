import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { SubscriptionService } from '../../../core/subscription/subscription.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-contact-sales-page', standalone: true,
  imports: [FormsModule, RouterLink, TranslatePipe],
  template: `
    <main class="sales-page">
      <header class="sales-topbar">
        <div class="sales-topbar-left"><a routerLink="/" class="sales-back">← {{ 'sales.back' | translate }}</a><a routerLink="/" class="sales-brand"><b>NexoDocs</b><small>{{ 'shell.documentManagement' | translate }}</small></a></div>
        <div class="sales-topbar-actions"><label [attr.aria-label]="'language.label' | translate"><select [ngModel]="i18n.language()" (ngModelChange)="i18n.setLanguage($event)" [ngModelOptions]="{ standalone: true }">@for (language of i18n.languages; track language.code) { <option [value]="language.code">{{ language.label }}</option> }</select></label><span class="sales-tenant">{{ organization() }}</span></div>
      </header>
      <div class="sales-content">
      <nav class="sales-breadcrumb"><a routerLink="/">{{ 'sales.home' | translate }}</a><span>›</span><span>{{ 'sales.breadcrumb' | translate }}</span></nav>
      <section class="sales-shell">
        <aside class="sales-value">
          <span class="sales-kicker">NEXODOCS ENTERPRISE</span>
          <h1>{{ 'sales.title' | translate }}</h1>
          <p>{{ 'sales.subtitle' | translate }}</p>
          <ul>
            <li><b>✓</b><span>{{ 'sales.executive' | translate }}</span></li>
            <li><b>✓</b><span>{{ 'sales.sla' | translate }}</span></li>
            <li><b>✓</b><span>{{ 'sales.dicom' | translate }}</span></li>
            <li><b>✓</b><span>{{ 'sales.api' | translate }}</span></li>
            <li><b>✓</b><span>{{ 'sales.implementation' | translate }}</span></li>
          </ul>
          <a class="sales-meeting" href="mailto:ventas@nexodocs.com?subject=NexoDocs%20Enterprise">{{ 'sales.schedule' | translate }} ↗</a>
        </aside>
        <section class="sales-form-card">
          @if (submitted()) {
            <div class="sales-confirmation" role="status"><span>✓</span><h2>{{ 'sales.successTitle' | translate }}</h2><p>{{ 'sales.successBody' | translate }}</p><a routerLink="/">{{ 'sales.return' | translate }}</a></div>
          } @else {
            <header><p>{{ 'sales.formKicker' | translate }}</p><h2>{{ 'sales.formTitle' | translate }}</h2><span>{{ 'sales.formSubtitle' | translate }}</span></header>
            <form (ngSubmit)="submit()">
              <label>{{ 'sales.organization' | translate }}<input [value]="organization()" disabled></label>
              <div class="sales-two-columns"><label>{{ 'sales.contactName' | translate }}<input name="contactName" [(ngModel)]="contactName" required></label><label>{{ 'sales.email' | translate }}<input type="email" name="email" [(ngModel)]="email" required></label></div>
              <div class="sales-two-columns"><label>{{ 'sales.phone' | translate }}<input name="phone" [(ngModel)]="phone"></label><label>{{ 'sales.teamSize' | translate }}<select name="estimatedUsers" [(ngModel)]="estimatedUsers"><option [ngValue]="10">1–10</option><option [ngValue]="50">11–50</option><option [ngValue]="200">51–200</option><option [ngValue]="500">201–500</option><option [ngValue]="1000">500+</option></select></label></div>
              <fieldset><legend>{{ 'sales.interests' | translate }}</legend><label><input type="checkbox" name="dicom" [(ngModel)]="dicom"> {{ 'sales.interestDicom' | translate }}</label><label><input type="checkbox" name="bulkOcr" [(ngModel)]="bulkOcr"> {{ 'sales.interestOcr' | translate }}</label><label><input type="checkbox" name="interoperability" [(ngModel)]="interoperability"> {{ 'sales.interestInterop' | translate }}</label></fieldset>
              <label>{{ 'sales.message' | translate }}<textarea name="message" [(ngModel)]="message" rows="4" [placeholder]="'sales.messagePlaceholder' | translate"></textarea></label>
              @if (error()) { <p class="sales-error">{{ error() }}</p> }
              <button type="submit" [disabled]="sending()">{{ (sending() ? 'sales.sending' : 'sales.submit') | translate }}</button>
            </form>
          }
        </section>
      </section>
      </div>
    </main>
  `,
  styles: [`
    .sales-page{max-width:1180px;margin:0 auto;padding:30px;color:#183f39}.sales-breadcrumb{display:flex;gap:9px;font-size:13px;margin:0 0 18px}.sales-breadcrumb a{color:#0f766e;text-decoration:none}.sales-shell{background:#fff;border:1px solid #d6e9e4;border-radius:24px;box-shadow:0 16px 45px rgba(8,73,62,.09);display:grid;grid-template-columns:.9fr 1.1fr;overflow:hidden}.sales-value{background:linear-gradient(180deg,#0b2420,#071916);color:#e7faf3;padding:48px}.sales-kicker,.sales-form-card header p{color:#5ee0c3;font-size:11px;font-weight:800;letter-spacing:.14em}.sales-value h1{font-size:34px;letter-spacing:-.04em;line-height:1.1;margin:16px 0}.sales-value>p{color:#b8d8ce;line-height:1.65}.sales-value ul{display:grid;gap:15px;list-style:none;margin:32px 0;padding:0}.sales-value li{align-items:center;display:flex;gap:10px}.sales-value b{color:#34d399}.sales-meeting{color:#d9fff1;font-weight:800;text-decoration:none}.sales-form-card{padding:42px}.sales-form-card header h2{font-size:25px;margin:8px 0}.sales-form-card header span{color:#66847f;font-size:14px}.sales-form-card form{display:grid;gap:17px;margin-top:26px}.sales-form-card label{color:#28554e;display:grid;font-size:13px;font-weight:750;gap:7px}.sales-form-card input,.sales-form-card select,.sales-form-card textarea{background:#fbfefd;border:1px solid #cfe3de;border-radius:10px;color:#173f39;font:inherit;font-weight:500;padding:11px}.sales-form-card input:disabled{background:#f0f8f5;color:#66847f}.sales-two-columns{display:grid;gap:14px;grid-template-columns:1fr 1fr}.sales-form-card fieldset{border:1px solid #dcece8;border-radius:12px;display:flex;flex-wrap:wrap;gap:12px;padding:13px}.sales-form-card legend{color:#416a63;font-size:12px;font-weight:800;padding:0 5px}.sales-form-card fieldset label{align-items:center;display:flex;font-size:12px;gap:5px}.sales-form-card button,.sales-confirmation a{background:linear-gradient(135deg,#0f766e,#0d9488);border:0;border-radius:11px;color:#fff;cursor:pointer;font:800 14px inherit;padding:13px;text-align:center;text-decoration:none}.sales-form-card button:disabled{opacity:.65}.sales-error{color:#a34520;margin:0}.sales-confirmation{align-items:center;display:flex;flex-direction:column;justify-content:center;min-height:480px;text-align:center}.sales-confirmation>span{align-items:center;background:#e7fbf2;border-radius:50%;color:#07835e;display:flex;font-size:25px;height:58px;justify-content:center;width:58px}.sales-confirmation h2{margin-bottom:5px}.sales-confirmation p{color:#60817b;max-width:380px}.sales-confirmation a{margin-top:16px}@media(max-width:800px){.sales-page{padding:18px}.sales-shell{grid-template-columns:1fr}.sales-value,.sales-form-card{padding:30px}.sales-two-columns{grid-template-columns:1fr}}
  `, `
    .sales-page{box-sizing:border-box;max-width:none;min-height:100vh;padding:0;background:radial-gradient(circle at 8% 8%,rgba(16,185,129,.14),transparent 27%),radial-gradient(circle at 94% 90%,rgba(13,148,136,.13),transparent 30%),#f5fbf9}.sales-topbar{align-items:center;background:rgba(255,255,255,.83);border-bottom:1px solid rgba(13,148,136,.12);box-sizing:border-box;display:flex;justify-content:space-between;min-height:72px;padding:0 clamp(20px,5vw,74px);backdrop-filter:blur(14px)}.sales-topbar-left,.sales-topbar-actions,.sales-brand{align-items:center;display:flex}.sales-topbar-left{gap:26px}.sales-back{color:#21695f;font-size:13px;font-weight:750;text-decoration:none}.sales-brand{border-left:1px solid #d8e9e4;flex-direction:column;line-height:1;padding-left:26px;text-decoration:none}.sales-brand b{color:#123c36;font-size:18px}.sales-brand small{color:#0d9488;font-size:8px;font-weight:800;letter-spacing:.13em;margin-top:4px;text-transform:uppercase}.sales-topbar-actions{gap:12px}.sales-topbar select{appearance:none;background:#eff9f6;border:1px solid #cbe7df;border-radius:999px;color:#21695f;font:800 11px inherit;letter-spacing:.04em;padding:8px 11px}.sales-tenant{background:#e7f6f1;border:1px solid #cae9df;border-radius:999px;color:#195a51;font-size:12px;font-weight:800;padding:8px 12px}.sales-content{box-sizing:border-box;max-width:1240px;margin:0 auto;padding:34px 30px 54px;width:100%}.sales-shell{min-height:610px}.sales-value{padding:58px}.sales-form-card{padding:52px}@media(max-width:800px){.sales-topbar{min-height:64px;padding:0 18px}.sales-topbar-left{gap:13px}.sales-brand{padding-left:13px}.sales-back{font-size:0}.sales-back:first-letter{font-size:19px}.sales-tenant{max-width:105px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sales-content{padding:20px 16px 36px}.sales-value,.sales-form-card{padding:30px}}
  `],
})
export class ContactSalesPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly subscriptions = inject(SubscriptionService);
  readonly i18n = inject(I18nService);
  readonly organization = computed(() => this.auth.user()?.tenantName || 'NexoDocs');
  readonly sending = signal(false);
  readonly submitted = signal(false);
  readonly error = signal('');
  contactName = '';
  email = '';
  phone = '';
  estimatedUsers = 50;
  dicom = false;
  bulkOcr = false;
  interoperability = false;
  message = '';

  ngOnInit(): void {
    const user = this.auth.user();
    this.contactName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
    this.email = user?.email || '';
    this.phone = user?.phone || '';
  }

  submit(): void {
    this.sending.set(true); this.error.set('');
    this.subscriptions.submitEnterpriseInquiry({ contactName: this.contactName, email: this.email, phone: this.phone,
      estimatedUsers: this.estimatedUsers, dicom: this.dicom, bulkOcr: this.bulkOcr,
      interoperability: this.interoperability, message: this.message }).subscribe({
        next: () => { this.sending.set(false); this.submitted.set(true); },
        error: (response) => { this.sending.set(false); this.error.set(response?.error?.message || this.i18n.t('sales.error')); },
      });
  }
}
