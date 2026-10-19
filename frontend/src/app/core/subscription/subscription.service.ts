import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { finalize, tap } from 'rxjs';
import { PermissionService } from '../auth/permission.service';
import { TENANT_PLAN_ADMIN } from '../auth/permission-rules';

const API_URL = '/api/v1/plans';

export interface PlanLimit { resourceKey: string; resourceValue: number; unit: string | null; }
export interface PlanFeature { featureKey: string; enabled: boolean; description: string | null; }
export interface SubscriptionPlan {
  id: string; code: string; name: string; description: string | null;
  priceMonthly: number; priceYearly: number;
  limits: PlanLimit[]; features: PlanFeature[];
}
export interface MySubscription {
  plan: SubscriptionPlan; activeUsersCount: number; maxUsers: number;
  usedStorageBytes: number; maxStorageBytes: number; enabledFeatures: string[];
  subscriptionStatus: 'TRIAL'|'ACTIVE'|'PAST_DUE'|'EXPIRED'|'SUSPENDED'|'CANCELED'; trialEndsAt?: string;
  trialDaysRemaining: number; billingCycle?: string; preferredPaymentMethod?: string;
}
export interface EnterpriseInquiryRequest {
  contactName: string; email: string; phone?: string; estimatedUsers: number;
  dicom: boolean; bulkOcr: boolean; interoperability: boolean; message?: string;
}
export interface EnterpriseInquiryResponse { inquiryId: string; accepted: boolean; message: string; }

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private readonly http = inject(HttpClient);
  private readonly permissions = inject(PermissionService);
  private catalogRequested = false;
  private subscriptionRequested = false;

  readonly plans = signal<SubscriptionPlan[]>([]);
  readonly currentSubscription = signal<MySubscription | null>(null);
  readonly loading = signal(false);
  readonly upgradeOpen = signal(false);
  readonly upgradeReason = signal<string | null>(null);
  readonly changingPlan = signal<string | null>(null);
  readonly planChangeError = signal<string | null>(null);
  readonly planChangeSuccess = signal<string | null>(null);
  readonly isBasicPlan = computed(() => this.currentSubscription()?.plan.code === 'BASIC');
  /** Solo el administrador del tenant ve el plan, el uso, los precios y la mejora de plan. */
  readonly canManage = computed(() => this.permissions.can(TENANT_PLAN_ADMIN));

  load(): void {
    if (!this.canManage()) return;
    this.loadPlans();
    this.loadCurrentSubscription();
  }

  loadPlans(force = false): void {
    if (this.catalogRequested && !force) return;
    this.catalogRequested = true;
    this.http.get<SubscriptionPlan[]>(API_URL).subscribe({
      next: plans => this.plans.set(plans),
      error: () => { this.catalogRequested = false; },
    });
  }

  loadCurrentSubscription(force = false): void {
    if (this.subscriptionRequested && !force) return;
    this.subscriptionRequested = true;
    this.loading.set(true);
    this.http.get<MySubscription>(`${API_URL}/my-subscription`).subscribe({
      next: subscription => this.currentSubscription.set(subscription),
      error: () => { this.subscriptionRequested = false; this.loading.set(false); },
      complete: () => this.loading.set(false),
    });
  }

  openUpgrade(reason?: string | null): void {
    if (!this.canManage()) return;
    this.upgradeReason.set(reason?.trim() || null);
    this.upgradeOpen.set(true);
    this.loadPlans();
    this.loadCurrentSubscription(true);
  }

  closeUpgrade(): void { this.upgradeOpen.set(false); this.upgradeReason.set(null); this.planChangeError.set(null); }

  changePlan(planCode: string) {
    this.changingPlan.set(planCode);
    this.planChangeError.set(null);
    this.planChangeSuccess.set(null);
    return this.http.post<MySubscription>(`${API_URL}/change`, { planCode }).pipe(
      tap(subscription => {
        this.currentSubscription.set(subscription);
        this.planChangeSuccess.set('subscription.changeSuccess');
      }),
      finalize(() => this.changingPlan.set(null)),
    );
  }

  submitEnterpriseInquiry(request: EnterpriseInquiryRequest) {
    return this.http.post<EnterpriseInquiryResponse>(`${API_URL}/enterprise-inquiry`, request);
  }
}
