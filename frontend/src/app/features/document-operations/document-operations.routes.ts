import { Routes } from '@angular/router';
import { authGuard, hasPermissionGuard } from '../../core/auth/auth.guard';

export const documentOperationsRoutes: Routes = [
 {path:'deliveries',loadComponent:()=>import('./external-deliveries-page').then(m=>m.ExternalDeliveriesPage),title:'Entregas externas - NexoDocs',canActivate:[authGuard,hasPermissionGuard('delivery:read')]},
 {path:'external/delivery',loadComponent:()=>import('./external-delivery-portal').then(m=>m.ExternalDeliveryPortal),title:'Entrega documental - NexoDocs'},
 {path:'mail-intake',loadComponent:()=>import('./mail-intake-page').then(m=>m.MailIntakePage),title:'Buzón documental - NexoDocs',canActivate:[authGuard,hasPermissionGuard('mail-intake:read')]},
 {path:'physical-archive',loadComponent:()=>import('./physical-archive-page').then(m=>m.PhysicalArchivePage),title:'Archivo físico - NexoDocs',canActivate:[authGuard,hasPermissionGuard('physical:read')]},
 {path:'physical-archive/:id',loadComponent:()=>import('./physical-archive-page').then(m=>m.PhysicalArchivePage),title:'Custodia del original - NexoDocs',canActivate:[authGuard,hasPermissionGuard('physical:read')]},
 {path:'translations',loadComponent:()=>import('./translations-page').then(m=>m.TranslationsPage),title:'Traducción documental - NexoDocs',canActivate:[authGuard,hasPermissionGuard('translation:read')]},
 {path:'translations/:id',loadComponent:()=>import('./translations-page').then(m=>m.TranslationsPage),title:'Revisión de traducción - NexoDocs',canActivate:[authGuard,hasPermissionGuard('translation:read')]},
];
