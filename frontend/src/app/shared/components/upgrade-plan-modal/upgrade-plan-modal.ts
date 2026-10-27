import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SubscriptionPlan, SubscriptionService } from '../../../core/subscription/subscription.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-upgrade-plan-modal', standalone: true, imports: [CommonModule, TranslatePipe],
  templateUrl: './upgrade-plan-modal.html', styleUrl: './upgrade-plan-modal.css',
})
export class UpgradePlanModalComponent {
  readonly subscription = inject(SubscriptionService);
  readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  readonly plans = this.subscription.plans;
  readonly current = this.subscription.currentSubscription;
  readonly isOpen = this.subscription.upgradeOpen;
  readonly reason = this.subscription.upgradeReason;
  readonly changingPlan = this.subscription.changingPlan;
  readonly changeError = this.subscription.planChangeError;
  readonly changeSuccess = this.subscription.planChangeSuccess;
  readonly currentPlanCode = computed(() => this.current()?.plan.code);
  close(): void { this.subscription.closeUpgrade(); }
  isCurrent(plan: SubscriptionPlan): boolean { return plan.code === this.currentPlanCode(); }
  limit(plan: SubscriptionPlan, key: string): number | undefined { return plan.limits.find(item => item.resourceKey === key)?.resourceValue; }
  users(plan: SubscriptionPlan): string { const value = this.limit(plan, 'maxUsers'); return value === -1 ? this.i18n.t('subscription.unlimitedUsers') : this.i18n.t('subscription.users', { count: value ?? 0 }); }
  storage(plan: SubscriptionPlan): string { const value = this.limit(plan, 'maxStorageMB'); if (value === -1) return this.i18n.t('subscription.unlimitedStorage'); if (value == null) return this.i18n.t('subscription.configurableStorage'); return value >= 1024 ? `${(value / 1024).toLocaleString(this.i18n.language(), { maximumFractionDigits: 1 })} GB` : `${value} MB`; }
  planName(plan: SubscriptionPlan): string { return this.i18n.t(`subscription.plans.${plan.code}.name`); }
  planDescription(plan: SubscriptionPlan): string { return this.i18n.t(`subscription.plans.${plan.code}.description`); }
  featureLabel(feature: string): string { return this.i18n.t(`subscription.features.${({ workflows: 'workflows', ocr_scanning: 'ocr', advanced_analytics: 'analytics', clinical_module: 'clinical', dicom_imaging: 'dicom' } as Record<string, string>)[feature] ?? feature}`); }
  featureEnabled(plan: SubscriptionPlan, feature: string): boolean { return plan.features.some(item => item.featureKey === feature && item.enabled); }
  choose(plan: SubscriptionPlan): void {
    if (this.isCurrent(plan)) return;
    this.close();
    void this.router.navigate(['/billing/subscription'], { queryParams: { plan: plan.code } });
  }

  actionLabel(plan: SubscriptionPlan): string {
    if (this.isCurrent(plan)) return this.i18n.t('subscription.current');
    if (this.changingPlan() === plan.code) return this.i18n.t('subscription.changing');
    return this.i18n.t('billing.activate');
  }
}
