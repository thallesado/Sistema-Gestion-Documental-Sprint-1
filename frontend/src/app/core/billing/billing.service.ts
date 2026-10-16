import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';

export type PaymentMethod = 'STRIPE_CARD' | 'BANK_QR' | 'CRYPTO_USDT';
export type BillingCycle = 'MONTHLY' | 'ANNUAL';
export interface CheckoutResponse { transactionId:string; paymentMethod:PaymentMethod; amountUsd:number; currency:string; externalReference:string; expiresAt:string; paymentData:Record<string, unknown>; }
export interface Invoice { id:string; amountUsd:number; currency:string; paymentMethod:PaymentMethod; status:string; externalReference:string; billingPeriod:BillingCycle; createdAt:string; completedAt?:string; }
export interface BillingOverview { subscriptionStatus:string; trialDaysRemaining:number; trialEndsAt?:string; currentPeriodEnd?:string; invoices:Invoice[]; }
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
}
