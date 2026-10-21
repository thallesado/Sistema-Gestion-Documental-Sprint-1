import { DatePipe } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
interface Backup { id:string; origin:string; status:string; created_at:string; file_size_bytes:number|null; checksum:string|null; error_message:string|null; pinned:boolean; creator:string; }
interface Operation { id:string; backup_id:string; safety_backup_id:string|null; status:string; stage:string; error_message:string|null; }
interface Overview { backups:Backup[]; operations:Operation[]; settings:{enabled:boolean;daily_time:string;timezone:string;retention_days:number;next_run:string|null};permissions:string[]; }
interface Verification { valid:boolean;compatible:boolean;message:string;files?:number; }
@Component({selector:'app-backups-page',imports:[FormsModule,DatePipe,RouterLink],templateUrl:'./backups-page.html',styleUrl:'./backups-page.css'})
export class BackupsPage {
 private readonly http=inject(HttpClient);private readonly auth=inject(AuthService);private readonly element=inject<ElementRef<HTMLElement>>(ElementRef);private previousFocus:HTMLElement|null=null;
 readonly organization=computed(()=>this.auth.user()?.tenantName||'Organización actual');
 readonly data=signal<Overview|null>(null);readonly error=signal('');readonly message=signal('');readonly loading=signal(false);readonly busy=signal(false);
 readonly selected=signal<Backup|null>(null);readonly verification=signal<Verification|null>(null);readonly panel=signal<string|null>(null);
 readonly operation=computed(()=>this.data()?.operations[0]??null);readonly active=computed(()=>this.data()?.backups.some(b=>b.status==='RUNNING')||this.data()?.operations.some(o=>o.status==='RUNNING'));
 readonly latest=computed(()=>this.data()?.backups.find(b=>b.status==='COMPLETED')??null);
 readonly filters=signal({search:'',origin:'',status:''});readonly page=signal(0);
 readonly filtered=computed(()=>{const f=this.filters();return(this.data()?.backups??[]).filter(b=>(!f.status||b.status===f.status)&&(!f.origin||b.origin===f.origin)&&`${b.id} ${b.creator}`.toLowerCase().includes(f.search.toLowerCase()));});
 readonly rows=computed(()=>this.filtered().slice(this.page()*10,this.page()*10+10));
 enabled=true;hour='02:00';timezone='America/La_Paz';retention=30;confirmation=''; evidenceTable='document_versions';evidenceRow='';readonly evidence=signal('');
 constructor(){this.reload();const t=window.setInterval(()=>this.reload(),5000);inject(DestroyRef).onDestroy(()=>clearInterval(t));}
 reload():void{if(this.loading())return;this.loading.set(true);this.http.get<Overview>('/api/v1/backups').subscribe({next:d=>{this.data.set(d);this.loading.set(false);},error:e=>{this.loading.set(false);this.error.set(this.describe(e));}});}
 can(c:string):boolean{return this.data()?.permissions.includes(`backup:${c}`)??false;}
 filter(k:'search'|'origin'|'status',v:string):void{this.filters.update(f=>({...f,[k]:v}));this.page.set(0);}
 label(v:string):string{return({MANUAL:'Manual',AUTOMATIC:'Automático',SAFETY:'Seguridad',RUNNING:'En proceso',COMPLETED:'Completado',FAILED:'Fallido',EXPIRED:'Eliminado'} as Record<string,string>)[v]||v;}
 size(b:number|null):string{return b==null?'—':`${(b/1048576).toFixed(2)} MB`;}
 open(p:string,b?:Backup):void{this.previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;this.error.set('');this.panel.set(p);queueMicrotask(()=>this.element.nativeElement.querySelector<HTMLElement>('[role=dialog] button')?.focus());this.confirmation='';if(b){this.evidence.set('');this.selected.set(b);this.verification.set(null);if(b.status==='COMPLETED')this.verify();}if(p==='configuration'&&this.data()){const s=this.data()!.settings;this.enabled=s.enabled;this.hour=s.daily_time.slice(0,5);this.timezone=s.timezone;this.retention=s.retention_days;}}
 create():void{this.act(this.http.post('/api/v1/backups',{}),()=>{this.message.set('Respaldo iniciado en el servidor.');this.reload();});}
 save():void{this.act(this.http.put('/api/v1/backups/settings',{enabled:this.enabled,hour:this.hour,timezone:this.timezone,retentionDays:this.retention}),()=>{this.message.set('Configuración guardada.');this.panel.set(null);this.reload();});}
 verify():void{const b=this.selected();if(!b)return;this.busy.set(true);this.http.post<Verification>(`/api/v1/backups/${b.id}/verify`,{}).subscribe({next:v=>{this.verification.set(v);this.busy.set(false);},error:e=>{this.error.set(this.describe(e));this.busy.set(false);}});}
 download():void{const b=this.selected();if(!b)return;this.busy.set(true);this.http.get(`/api/v1/backups/${b.id}/download`,{responseType:'blob'}).subscribe({next:blob=>{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`nexodocs-${b.id}.zip`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);this.busy.set(false);},error:e=>{this.error.set(this.describe(e));this.busy.set(false);}});}
 inspectEvidence():void{const b=this.selected();if(!b)return;this.busy.set(true);this.evidence.set('');this.http.get(`/api/v1/backups/${b.id}/evidence`,{params:{table:this.evidenceTable,rowId:this.evidenceRow}}).subscribe({next:r=>{this.evidence.set(JSON.stringify(r,null,2));this.busy.set(false);},error:e=>{this.error.set(this.describe(e));this.busy.set(false);}});}
 restore():void{const b=this.selected();if(!b||this.confirmation!==this.organization())return;this.act(this.http.post(`/api/v1/backups/${b.id}/restore`,{organizationName:this.confirmation}),()=>{this.panel.set('progress');this.reload();});}
 close():void{if(this.panel()==='configuration'&&this.data()){const s=this.data()!.settings;if((this.enabled!==s.enabled||this.hour!==s.daily_time.slice(0,5)||this.timezone!==s.timezone||this.retention!==s.retention_days)&&!window.confirm('Hay cambios sin guardar. ¿Deseas cerrar sin guardarlos?'))return;}this.panel.set(null);this.previousFocus?.focus();}
 @HostListener('document:keydown',['$event']) onKeydown(e:KeyboardEvent):void{if(!this.panel())return;if(e.key==='Escape'){e.preventDefault();this.close();}if(e.key!=='Tab')return;const a=Array.from(this.element.nativeElement.querySelectorAll<HTMLElement>('[role=dialog] button:not([disabled]),[role=dialog] input:not([disabled]),[role=dialog] select:not([disabled])'));if(e.shiftKey&&document.activeElement===a[0]){e.preventDefault();a[a.length-1]?.focus();}else if(!e.shiftKey&&document.activeElement===a[a.length-1]){e.preventDefault();a[0]?.focus();}}
 private act(r:import('rxjs').Observable<unknown>,ok:()=>void):void{this.busy.set(true);this.error.set('');r.subscribe({next:()=>{this.busy.set(false);ok();},error:e=>{this.busy.set(false);this.error.set(this.describe(e));}});}
 private describe(e:HttpErrorResponse):string{return e.status===403?'Tu usuario no tiene permiso de respaldos.':e.status===0?'No se pudo actualizar el estado. La operación puede seguir en curso.':e.error?.detail||e.error?.message||`No se pudo completar la solicitud (HTTP ${e.status}).`;}
}
