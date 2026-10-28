import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';

export type PaymentMethod = 'STRIPE_CARD' | 'BANK_QR' | 'CRYPTO_USDT';
export type BillingCycle = 'MONTHLY' | 'ANNUAL';
/** transactionId is null for a Stripe subscription checkout: paymentData.checkoutUrl must be opened instead. */
export interface CheckoutResponse { transactionId:string|null;paymentMethod:PaymentMethod; amountUsd:number; currency:string; externalReference:string; expiresAt:string; paymentData:Record<string, unknown>; }
export interface Invoice { id:string; amountUsd:number; currency:string; paymentMethod:PaymentMethod; status:string; externalReference:string; billingPeriod:BillingCycle; createdAt:string; completedAt?:string; }
export interface BillingOverview { subscriptionStatus:string; trialDaysRemaining:number; trialEndsAt?:string; currentPeriodEnd?:string; invoices:Invoice[]; stripeManaged:boolean; }
/** GET /api/v1/billing/subscription: plan, renovación, cambio programado y cancelación. */
export interface SubscriptionDetails {
  organizationName:string; status:'TRIAL'|'ACTIVE'|'PAST_DUE'|'EXPIRED'|'SUSPENDED'|'CANCELED';
  planCode:string|null; planName:string|null; priceMonthly:number|null; priceYearly:number|null;
  billingCycle:BillingCycle; paymentMethod:PaymentMethod|null; currentPeriodEnd:string|null; trialEndsAt:string|null;
  stripeManaged:boolean; autoRenew:boolean; scheduledPlanCode:string|null; scheduledBillingCycle:BillingCycle|null;
  scheduledChangeAt:string|null; canceledAt:string|null; deletionScheduledAt:string|null; retentionDays:number;
}
export interface RevenueDashboard { totalRevenueUsd:number; mrrUsd:number; arrUsd:number; activeSubscriptions:number; trialSubscriptions:number; conversionRate:number; revenueByMethod:Record<string,number>; revenueByPlan:Record<string,number>; transactions: Array<Record<string, unknown>>; }

@Injectable({providedIn:'root'})
export class BillingService {
  private readonly http=inject(HttpClient);
  readonly overview=signal<BillingOverview|null>(null); readonly revenue=signal<RevenueDashboard|null>(null);
  readonly checkout=signal<CheckoutResponse|null>(null); readonly loading=signal(false);
  loadOverview(){this.http.get<BillingOverview>('/api/v1/billing/my-invoices').subscribe({next:v=>this.overview.set(v)});}
  loadRevenue(){this.http.get<RevenueDashboard>('/api/v1/billing/revenue-dashboard').subscribe({next:v=>this.revenue.set(v)});}
  initiate(planCode:string,paymentMethod:PaymentMethod,billingCycle:BillingCycle,cryptoNetwork='TRC20'){this.loading.set(true);return this.http.post<CheckoutResponse>('/api/v1/billing/checkout/initiate',{planCode,paymentMethod,billingCycle,cryptoNetwork});}
  confirm(transactionId:string,confirmationReference=''){return this.http.post<BillingOverview>('/api/v1/billing/checkout/confirm',{transactionId,confirmationReference});}
  readonly subscription=signal<SubscriptionDetails|null>(null);
  loadSubscription(){return this.http.get<SubscriptionDetails>('/api/v1/billing/subscription');}
  upgradeNow(planCode:string,billingCycle:BillingCycle){return this.http.post<SubscriptionDetails>('/api/v1/billing/subscription/upgrade',{planCode,billingCycle});}
  scheduleChange(planCode:string,billingCycle:BillingCycle){return this.http.post<SubscriptionDetails>('/api/v1/billing/subscription/scheduled-change',{planCode,billingCycle});}
  cancelScheduledChange(){return this.http.delete<SubscriptionDetails>('/api/v1/billing/subscription/scheduled-change');}
  stopRenewal(){return this.http.post<SubscriptionDetails>('/api/v1/billing/subscription/stop-renewal',{});}
  resumeRenewal(){return this.http.post<SubscriptionDetails>('/api/v1/billing/subscription/resume-renewal',{});}
  /** Cancela ya y programa el borrado de la organización; exige nombre exacto y contraseña. */
  cancelSubscription(organizationName:string,password:string,reason:string){return this.http.post<{deletionScheduledAt:string}>('/api/v1/billing/subscription/cancel',{organizationName,password,reason});}
  /** Respaldo del webhook al volver de Stripe Checkout con ?session_id=. */
  confirmStripeCheckout(sessionId:string){return this.http.post<{status:string}>(`/api/v1/billing/checkout/stripe-sessions/${encodeURIComponent(sessionId)}/confirm`,{});}
  /** Stripe-hosted portal: card update, plan change, cancellation and invoices. */
  portal(){return this.http.post<{url:string}>('/api/v1/billing/portal',{});}
}
