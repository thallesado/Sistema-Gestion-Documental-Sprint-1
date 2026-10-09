import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WorkflowApi } from '../workflow-api.service';
import { DocumentApiService } from '../../../core/api/document-api.service';
import { ExpedientApiService } from '../../../core/api/expedient-api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { Observable } from 'rxjs';
import { Subject, debounceTime, takeUntil } from 'rxjs';

@Component({
  selector: 'app-workflow-start', standalone: true, imports: [CommonModule, FormsModule],
  styleUrls: ['../workflow-start.css'],
  template: `
  <div class="wf-overlay" (click)="close.emit()"><section class="wf-dialog" role="dialog" aria-modal="true" aria-labelledby="start-title" (click)="$event.stopPropagation()">
    <header><div><p class="wf-eyebrow">NUEVO WORKFLOW · PASO {{ step }} DE 6</p><h2 id="start-title">{{ titles[step-1] }}</h2></div><button aria-label="Cerrar" (click)="close.emit()">✕</button></header>
    <div class="wf-steps">@for (title of titles; track title; let i=$index) { <span [class.selected]="step===i+1">{{ i+1 }}. {{ title }}</span> }</div>
    @if (error()) { <p class="wf-error" role="alert">{{ error() }}</p> }
    @if (step===1) {
      <label>Origen<select [(ngModel)]="origin" (ngModelChange)="documentId='';expedientId='';searchOrigin()"><option value="DOCUMENT">Documento</option><option value="EXPEDIENT">Expediente</option><option value="INDEPENDENT">Proceso independiente</option></select></label>
      @if (origin!=='INDEPENDENT') {
        <label>Buscar {{ origin==='DOCUMENT'?'documento':'expediente' }}<input [(ngModel)]="originSearch" (ngModelChange)="searchOrigin()" placeholder="Nombre o código"></label>
        <label>Seleccionar<select [ngModel]="origin==='DOCUMENT'?documentId:expedientId" (ngModelChange)="selectOrigin($event)"><option value="">Selecciona un registro</option>@for (item of origins(); track item.id) { <option [value]="item.id">{{ item.code }} · {{ item.name }}</option> }</select></label>
      }
      <label>Nombre del workflow<input [(ngModel)]="title" maxlength="255" required></label><label>Descripción<textarea [(ngModel)]="description" maxlength="4000"></textarea></label>
    }
    @if (step===2) {
      <label>Buscar plantilla<input [(ngModel)]="templateSearch" (ngModelChange)="searchTemplates()"></label>
      <label>Plantilla<select [(ngModel)]="templateId" (ngModelChange)="loadTemplate()"><option value="">Selecciona una plantilla activa</option>@for (item of templates(); track item.id) { @if(item.is_active&&(item.origin_type==='ANY'||item.origin_type===origin)){ <option [value]="item.id">{{ item.name }} · v{{ item.version }} · {{ item.category }}</option> } }</select></label>
      @if (template()) { <p>{{ template().description }}</p><p>{{ template().nodes.length }} etapas</p> }
    }
    @if (step===3) {
      <p>La aprobación requiere un responsable superior al solicitante y al autor. Solo el dueño del tenant puede aprobarse a sí mismo.</p>
      @for (node of actionableNodes(); track node.id) {
        <label>{{ node.name }} · {{ node.stage_type }}<input [(ngModel)]="assigneeSearch[node.rules.key||node.id]" placeholder="Buscar por nombre, rol o área"><select [(ngModel)]="assignments[node.rules.key || node.id]"><option value="">Seleccionar responsable</option>@for (user of eligible(node,assigneeSearch[node.rules.key||node.id]); track user.id) { <option [value]="user.id">{{ user.name }} · {{ user.role_names||'Sin rol' }} · {{ user.department||'Sin área' }}</option> }</select></label>
        @if(selectedAssignee(node);as user){<div class="wf-assignee-chip"><span aria-hidden="true">{{ userInitials(user.name) }}</span><div><strong>{{ user.name }}</strong><small>{{ user.role_names||'Sin rol' }} · {{ user.department||'Sin área' }}</small></div></div>}
      }
    }
    @if (step===4) {
      <label>Fecha límite<input type="datetime-local" [(ngModel)]="dueAt"></label>
      <label>Prioridad<select [(ngModel)]="priority"><option [ngValue]="4">Baja</option><option [ngValue]="3">Media</option><option [ngValue]="2">Alta</option><option [ngValue]="1">Urgente</option></select></label>
      <label>Área<select [(ngModel)]="departmentId"><option value="">Sin área específica</option>@for (dept of options.departments; track dept.id) { <option [value]="dept.id">{{ dept.name }}</option> }</select></label>
    }
    @if (step===5||step===6) {
      <dl class="wf-info"><dt>Nombre</dt><dd>{{ title }}</dd><dt>Origen</dt><dd>{{ origin }}</dd><dt>Plantilla</dt><dd>{{ template()?.name }} · v{{ template()?.version }}</dd><dt>Vencimiento</dt><dd>{{ dueAt || 'Sin fecha límite' }}</dd></dl>
      @for(node of actionableNodes(); track node.id) { <p>{{ node.name }} → {{ userName(assignments[node.rules.key||node.id]) }}</p> }
      @if(step===6){<p>Al confirmar se crea el workflow, se asigna la primera tarea y se notifica al responsable.</p>}
    }
    <footer><button class="wf-secondary" (click)="step>1?step=step-1:close.emit()" [disabled]="saving()">{{ step>1?'Atrás':'Cancelar' }}</button>
      @if(step<6){<button class="wf-primary" (click)="next()" [disabled]="step===2&&(!template()||templateLoading())">Continuar</button>}@else{<button class="wf-primary" (click)="start()" [disabled]="saving()">{{ saving()?'Iniciando…':'Confirmar e iniciar' }}</button>}
    </footer>
  </section></div>`,
})
export class WorkflowStart implements OnInit, OnDestroy {
  @Input() options: any = { users: [], departments: [] };
  @Input() initialTemplate = '';
  @Input() initialDocument: any = null;
  @Input() initialExpedient: any = null;
  @Output() close = new EventEmitter<void>(); @Output() started = new EventEmitter<any>();
  readonly api = inject(WorkflowApi); private readonly docs = inject(DocumentApiService);
  private readonly expedients = inject(ExpedientApiService); private readonly auth = inject(AuthService);
  readonly error = signal(''); readonly saving = signal(false); readonly origins = signal<any[]>([]);
  readonly templates = signal<any[]>([]); readonly template = signal<any>(null);
  readonly templateLoading = signal(false);
  private readonly originSearchInput=new Subject<void>();private readonly templateSearchInput=new Subject<void>();private readonly destroyed=new Subject<void>();
  readonly titles = ['Seleccionar origen','Plantilla','Responsables','Fechas','Resumen','Confirmación'];
  step=1;origin='DOCUMENT';title='';description='';documentId='';expedientId='';departmentId='';
  templateId='';originSearch='';templateSearch='';dueAt='';priority=3;assignments:Record<string,string>={};assigneeSearch:Record<string,string>={};
  ngOnInit():void {
    this.originSearchInput.pipe(debounceTime(300),takeUntil(this.destroyed)).subscribe(()=>this.loadOriginOptions());
    this.templateSearchInput.pipe(debounceTime(300),takeUntil(this.destroyed)).subscribe(()=>this.loadTemplates());
    this.templateId=this.initialTemplate;
    if(this.initialDocument){this.origin='DOCUMENT';this.documentId=this.initialDocument.id;this.title=this.initialDocument.name||'';this.origins.set([this.initialDocument]);}
    if(this.initialExpedient){this.origin='EXPEDIENT';this.expedientId=this.initialExpedient.id;this.title=this.initialExpedient.name||this.initialExpedient.title||'';this.origins.set([this.initialExpedient]);}
    if(!this.initialDocument&&!this.initialExpedient)this.searchOrigin();
    this.searchTemplates();if(this.templateId)this.loadTemplate();
  }
  ngOnDestroy():void{this.destroyed.next();this.destroyed.complete();}
  searchOrigin():void {
    this.originSearchInput.next();
  }
  private loadOriginOptions():void {
    const source:Observable<{content:any[]}>=this.origin==='DOCUMENT'?this.docs.documents(this.originSearch,undefined,0,20):this.expedients.expedients(this.originSearch,0,20);
    if(this.origin==='INDEPENDENT'){this.origins.set([]);return;}
    source.subscribe({next: result=>this.origins.set(result.content),error:()=>this.error.set('No se pudo consultar el origen.')});
  }
  selectOrigin(id:string):void { if(this.origin==='DOCUMENT')this.documentId=id;else this.expedientId=id; }
  searchTemplates():void {this.templateSearchInput.next();}
  private loadTemplates():void { this.api.page<any>('/templates',{search:this.templateSearch,size:100}).subscribe({next:p=>this.templates.set(p.content),error:e=>this.error.set(e.error?.message||'No se pudieron cargar plantillas.')}); }
  loadTemplate():void { this.template.set(null);if(!this.templateId)return;this.templateLoading.set(true);this.api.get<any>('/templates/'+this.templateId).subscribe({next:t=>{this.templateLoading.set(false);this.template.set(t);this.assignments={};for(const node of t.nodes)if(node.assignment_type==='USER')this.assignments[node.rules.key||node.id]=node.assignment_reference;},error:()=>{this.templateLoading.set(false);this.error.set('Plantilla no disponible.');}}); }
  actionableNodes():any[] { return (this.template()?.nodes||[]).filter((n:any)=>['TASK','REVIEW','APPROVAL'].includes(n.stage_type)); }
  eligible(node:any,search=''):any[] {
    const permission=node.stage_type==='APPROVAL'?'workflow:approve':node.stage_type==='REVIEW'?'workflow:review':'task:update';
    const current=this.options.users.find((u:any)=>u.id===this.auth.user()?.id);
    const authorId=this.origins().find(d=>d.id===this.documentId)?.authorId;
    const author=this.options.users.find((u:any)=>u.id===authorId);
    const term=search.trim().toLocaleLowerCase();
    return this.options.users.filter((u:any)=>(u.permissions||[]).includes(permission)&&(node.stage_type!=='APPROVAL'||u.owner||u.id!==current?.id&&u.id!==authorId&&u.approval_rank>Math.max(current?.approval_rank||0,author?.approval_rank||0)))
      .filter((u:any)=>!term||`${u.name} ${u.role_names||''} ${u.department||''}`.toLocaleLowerCase().includes(term));
  }
  userName(id:string):string { return this.options.users.find((u:any)=>u.id===id)?.name||'Sin responsable'; }
  selectedAssignee(node:any):any|null{return this.options.users.find((u:any)=>u.id===this.assignments[node.rules.key||node.id])||null;}
  userInitials(name:string):string{return(name||'').split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0].toLocaleUpperCase()).join('')||'·';}
  next():void {
    this.error.set('');
    if(this.step===1&&(!this.title.trim()||this.origin==='DOCUMENT'&&!this.documentId||this.origin==='EXPEDIENT'&&!this.expedientId)){this.error.set('Indica nombre y origen.');return;}
    if(this.step===2&&(!this.template()||!['ANY',this.origin].includes(this.template().origin_type))){this.error.set('Selecciona una plantilla compatible.');return;}
    if(this.step===3&&this.actionableNodes().some(n=>!this.assignments[n.rules.key||n.id])){this.error.set('Asigna todas las etapas.');return;}
    if(this.step===4&&this.dueAt&&new Date(this.dueAt)<=new Date()){this.error.set('La fecha límite debe ser futura.');return;}
    this.step++;
  }
  start():void {
    this.saving.set(true);this.error.set('');
    this.api.post('',{templateId:this.templateId,title:this.title.trim(),description:this.description,documentId:this.documentId||null,expedientId:this.expedientId||null,
      departmentId:this.departmentId||null,priority:this.priority,dueAt:this.dueAt?new Date(this.dueAt).toISOString():null,assignments:this.assignments}).subscribe({next:flow=>{this.saving.set(false);this.started.emit(flow);},error:e=>{this.saving.set(false);this.error.set(e.error?.message||'No se pudo iniciar el workflow.');}});
  }
}
