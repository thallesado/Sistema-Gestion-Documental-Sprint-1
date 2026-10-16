import { Routes } from '@angular/router';

/** Public on purpose: a company that is not a customer yet must be able to see the plans. */
export const pricingRoutes: Routes = [
  {
    path: 'planes',
    loadComponent: () => import('./pages/pricing-page').then((m) => m.PricingPage),
    title: 'Planes - NexoDocs',
  },
];
