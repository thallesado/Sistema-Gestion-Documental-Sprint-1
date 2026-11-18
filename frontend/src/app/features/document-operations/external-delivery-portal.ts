import { Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DocumentOperationsApi, operationError } from '../../core/api/document-operations-api.service';

@Component({selector:'app-external-delivery-portal',standalone:true,imports:[CommonModule,FormsModule],styleUrl:'./operations.css',template:`
<main class="external"><header><h1>NexoDocs · Entrega documental</h1><p>Acceso individual a la versión que te entregó la organización.</p></header>
 @if(error()){<p class="error" role="alert">{{error()}}</p>}@if(message()){<p class="success" role="status">{{message()}}</p>}
 @if(!token){<section class="card"><h2>Enlace no disponible</h2><p>Abre el enlace completo que recibiste por correo. Si venció o fue revocado, solicita una nueva entrega.</p></section>}
 @else if(!session){<section class="card"><h2>Verifica tu correo</h2><p>No se mostrará información del documento hasta completar la verificación.</p><button [disabled]="busy()" (click)="requestCode()">Enviar código al correo registrado</button><form #f="ngForm" (ngSubmit)="verify()"><label>Código de seis dígitos<input name="code" [(ngModel)]="code" required pattern="[0-9]{6}" inputmode="numeric" autocomplete="one-time-code" maxlength="6"></label><p class="muted">El código vence en 10 minutos. No lo compartas.</p><button class="primary" [disabled]="f.invalid||busy()">Verificar y continuar</button></form></section>}
 @if(info();as d){<section class="card"><h2>{{d.name}}</h2><p>Versión {{d.version}} · {{d.fileName}}</p><p>Acceso hasta {{d.expiresAt|date:'short'}}</p><div class="actions">@if(['application/pdf','image/png','image/jpeg'].includes(d.mimeType)){<button [disabled]="busy()" (click)="content(false)">Visualizar versión</button>}@if(d.allowDownload){<button [disabled]="busy()" (click)="content(true)">Descargar copia</button>}<button (click)="closeSession()">Cerrar acceso</button></div><p class="notice">El acceso puede vencer o ser revocado. La visualización no impide capturas ni copias del contenido mostrado.</p>@if(preview()){<iframe title="Documento entregado" class="preview" [src]="preview()"></iframe>}</section>}
</main>`})
export class ExternalDeliveryPortal {
 private readonly api=inject(DocumentOperationsApi);private readonly route=inject(ActivatedRoute);private readonly sanitizer=inject(DomSanitizer);
 readonly error=signal('');readonly message=signal('');readonly busy=signal(false);readonly info=signal<any>(null);readonly preview=signal<SafeResourceUrl|null>(null);
 token='';session='';code='';private objectUrl='';
 constructor(){this.token=this.route.snapshot.fragment||'';if(this.token)history.replaceState(null,'',location.pathname+location.search);inject(DestroyRef).onDestroy(()=>this.cleanup());}
 requestCode():void{if(this.busy())return;this.busy.set(true);this.error.set('');this.api.post<any>('external-deliveries/code',{token:this.token}).subscribe({next:r=>{this.busy.set(false);this.message.set(r.message);},error:e=>{this.busy.set(false);this.error.set(operationError(e));}});}
 verify():void{if(this.busy())return;this.busy.set(true);this.error.set('');this.api.post<any>('external-deliveries/verify',{token:this.token,code:this.code}).subscribe({next:r=>{this.session=r.session;this.code='';this.api.post<any>('external-deliveries/info',{token:this.token,session:this.session}).subscribe({next:d=>{this.info.set(d);this.message.set('Correo verificado.');this.busy.set(false);},error:e=>{this.busy.set(false);this.error.set(operationError(e));}});},error:e=>{this.busy.set(false);this.error.set(operationError(e));}});}
 content(download:boolean):void{if(this.busy())return;this.busy.set(true);this.error.set('');this.api.blob('external-deliveries/content',{token:this.token,session:this.session,download}).subscribe({next:blob=>{this.busy.set(false);if(download){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=this.info().fileName; a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}else{this.cleanup();this.objectUrl=URL.createObjectURL(blob);this.preview.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl));}},error:e=>{this.busy.set(false);this.cleanup();this.error.set(e.status===410?'El acceso venció o fue revocado. Solicita una nueva entrega.':operationError(e));}});}
 private cleanup():void{if(this.objectUrl)URL.revokeObjectURL(this.objectUrl);this.objectUrl='';this.preview.set(null);}
 closeSession():void{this.cleanup();this.session='';this.token='';this.info.set(null);this.message.set('Acceso cerrado en este navegador.');}
}
