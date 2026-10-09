import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { WorkflowApi, WorkflowNode, WorkflowEdge, WorkflowTemplate } from '../workflow-api.service';
import { App } from '../../../shell/app';

@Component({selector:'app-workflow-designer',standalone:true,imports:[CommonModule,FormsModule],
 template:`
  <header class="wf-designer-header"><div class="wf-designer-heading"><p class="wf-eyebrow">WORKFLOWS <span>›</span> DISEÑADOR</p><h1>Diseñador de workflows</h1><p>Crea, configura y visualiza el flujo de trabajo de tus documentos y expedientes.</p></div>
    <div class="wf-designer-header-actions"><button class="wf-secondary" (click)="wizardStep=1;preview=false" [disabled]="preview">⚙ <span>Información</span></button><button class="wf-secondary" (click)="save()" [disabled]="busy()||preview">▣ <span>Guardar como plantilla</span></button><button class="wf-secondary" (click)="togglePreview()">{{ preview?'✎ Editar':'▷ Vista previa' }}</button><button class="wf-primary" (click)="saveAndStart()" [disabled]="busy()||preview||!canStart">{{ busy()?'Guardando…':'▣ Guardar workflow' }}</button></div></header>
  @if(error()){<p class="wf-error" role="alert">{{ error() }}</p>}@if(message()){<p class="wf-success" role="status">{{ message() }}</p>}
  <nav class="wf-template-wizard" aria-label="Pasos de la plantilla">@for(step of wizardSteps;track $index){<button [class.selected]="wizardStep===$index+1" (click)="goWizard($index+1)"><span>{{ $index+1 }}</span>{{ step }}</button>}</nav>
  @if(wizardStep===1){<button class="wf-secondary wf-designer-back" (click)="toggleInfo()">← Volver al lienzo</button>}
  @if(wizardStep===1){<section class="wf-card wf-template-form"><button class="wf-secondary wf-designer-back" (click)="toggleInfo()">← Volver al lienzo</button><label>Nombre<input [(ngModel)]="model.name" maxlength="150"></label><label>Categoría<input [(ngModel)]="model.category" maxlength="100" list="wf-categories"><datalist id="wf-categories">@for(category of categories;track category){<option [value]="category"></option>}</datalist></label>
    <label>Origen<select [(ngModel)]="model.originType"><option value="ANY">Cualquier origen</option><option value="DOCUMENT">Documento</option><option value="EXPEDIENT">Expediente</option><option value="INDEPENDENT">Proceso independiente</option></select></label>
    <label>Descripción<input [(ngModel)]="model.description" maxlength="4000"></label><label>Publicación<select [(ngModel)]="model.publicationStatus"><option value="DRAFT">Borrador · solo visible en el catálogo</option><option value="ACTIVE">Activa · disponible para iniciar</option><option value="INACTIVE">Inactiva · no disponible para iniciar</option></select></label>
    <h3>Estados documentales automáticos</h3>@for(rule of statusRuleOptions;track rule.key){<label>{{ rule.label }}<select [(ngModel)]="model.documentStatusRules[rule.key]"><option value="UNCHANGED">No cambiar</option>@for(status of documentStatuses;track status){<option [value]="status">{{ statusLabel(status) }}</option>}</select></label>}
  </section>} @else {<div class="wf-designer" [class.preview]="preview">
    @if(!preview){<aside class="wf-card wf-palette"><h3>Componentes</h3><p>Arrastra un componente al lienzo o pulsa para añadirlo.</p>@for(type of types;track type.code){<button draggable="true" (dragstart)="paletteDrag($event,type.code)" (click)="add(type.code)" class="wf-node-button"><span class="wf-palette-icon" [attr.data-type]="type.code">{{ type.icon }}</span><span><strong>{{ type.label }}</strong><small>{{ type.description }}</small></span></button>}
      <p>Para conectar, selecciona origen y destino en Propiedades.</p></aside>}
    <section class="wf-card wf-canvas-shell">
      <div class="wf-canvas-controls"><button (click)="undo()" [disabled]="!past.length||preview" aria-label="Deshacer">↶</button><button (click)="redo()" [disabled]="!future.length||preview" aria-label="Rehacer">↷</button><button (click)="zoom=zoom>0.5?zoom-0.1:zoom" aria-label="Alejar">−</button><span>{{ zoom*100|number:'1.0-0' }}%</span><button (click)="zoom=zoom<1.6?zoom+0.1:zoom" aria-label="Acercar">+</button><button (click)="fit()">Ajustar vista</button></div>
      <div class="wf-canvas-viewport" #canvasViewport (dragover)="$event.preventDefault()" (drop)="drop($event)">
        <div class="wf-canvas" [style.transform]="'scale('+zoom+')'">
          <svg class="wf-edges" viewBox="0 0 1050 790" aria-label="Conexiones de etapas"><defs><marker id="wf-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="var(--teal)"></path></marker></defs>
          @for(edge of model.edges;track $index){<g><path [attr.d]="edgePath(edge)" fill="none" stroke="#627b91" stroke-width="2" marker-end="url(#wf-arrow)"></path>@if(edge.outcome==='YES'||edge.outcome==='NO'){<text [attr.x]="edgeLabelPosition(edge).x" [attr.y]="edgeLabelPosition(edge).y" font-size="12" fill="var(--ink)">{{ edge.label||edge.outcome }}</text>}</g>}
          </svg>
          @for(node of model.nodes;track node.key){<button class="wf-node" [class.selected]="selectedKey===node.key" [attr.data-type]="node.type" [style.left.px]="node.rules['x']||0" [style.top.px]="node.rules['y']||0" [draggable]="!preview" (dragstart)="nodeDrag($event,node.key)" (click)="select(node.key)"><span class="wf-node-icon" aria-hidden="true">{{ icon(node.type) }}</span><span class="wf-node-copy"><small>{{ label(node.type) }}</small><strong>{{ node.name }}</strong><span>{{ nodeDescription(node) }}</span></span></button>}
        </div>
      </div>
    </section>
    @if(!preview){<aside class="wf-card wf-properties"><h3>Propiedades</h3>
      @if(selected();as node){<div class="wf-tabs"><button [class.selected]="propertyTab==='general'" (click)="propertyTab='general'">General</button><button [class.selected]="propertyTab==='assignment'" (click)="propertyTab='assignment'">Asignación</button><button [class.selected]="propertyTab==='advanced'" (click)="propertyTab='advanced'">Avanzado</button></div>
        @if(propertyTab==='general'){<label>Nombre<input [(ngModel)]="node.name" (focus)="checkpoint()" maxlength="150"></label><label>Descripción<textarea [(ngModel)]="node.rules['description']" (focus)="checkpoint()"></textarea></label><label>Plazo (días)<input type="number" min="0" max="3650" [(ngModel)]="node.dueDays" (focus)="checkpoint()"></label>
          <label>Destino<select [(ngModel)]="connectionTarget"><option value="">Seleccionar nodo</option>@for(target of model.nodes;track target.key){@if(target.key!==node.key&&target.type!=='START'){<option [value]="target.key">{{ target.name }}</option>}}</select></label><label>Condición<select [(ngModel)]="connectionOutcome"><option value="DEFAULT">Por defecto</option><option value="YES">Sí</option><option value="NO">No</option><option value="APPROVED">Aprobado</option><option value="REJECTED">Rechazado</option></select></label><button class="wf-secondary" (click)="connect()" [disabled]="!connectionTarget||node.type==='END'">Conectar</button>
          @for(edge of outgoing(node.key);track edge){<p>{{ edge.outcome }} → {{ nodeName(edge.to) }} <button (click)="removeEdge(edge)" aria-label="Eliminar conexión">✕</button></p>}
        }
        @if(propertyTab==='assignment'){<label>Asignación<select [(ngModel)]="node.assignmentType" (ngModelChange)="node.assignmentReference=null"><option [ngValue]="null">Elegir al iniciar</option><option value="USER">Usuario</option><option value="ROLE">Rol</option><option value="DEPARTMENT">Área</option></select></label>
          @if(node.assignmentType){<label>Referencia<select [(ngModel)]="node.assignmentReference"><option [ngValue]="null">Selecciona</option>@for(item of assignmentOptions(node.assignmentType);track item.id){<option [value]="item.id">{{ item.name }}</option>}</select></label>}
          <p>Los aprobadores deben ser superiores al solicitante y al autor. La asignación se valida al iniciar y al ejecutar.</p>
        }
        @if(propertyTab==='advanced'){<label>Checklist (un punto por línea)<textarea [ngModel]="checklistText(node)" (ngModelChange)="setChecklist(node,$event)"></textarea></label><label class="wf-inline"><input type="checkbox" [(ngModel)]="node.rules['commentRequired']"> Comentario obligatorio</label>
          @if(node.type==='TASK'){<label>Prioridad predeterminada<select [(ngModel)]="node.rules['priority']"><option [ngValue]="null">Heredar del workflow</option><option [ngValue]="1">Urgente</option><option [ngValue]="2">Alta</option><option [ngValue]="3">Media</option><option [ngValue]="4">Baja</option></select></label>}
          @if(node.type==='REVIEW'){<label class="wf-inline"><input type="checkbox" [(ngModel)]="node.rules['allowReturn']"> Permitir devolución</label>}
          @if(node.type==='APPROVAL'){<label>Mínimo de aprobaciones<input type="number" min="1" max="1" [ngModel]="1" disabled></label><label class="wf-inline"><input type="checkbox" [(ngModel)]="node.rules['allowReject']"> Permitir rechazo</label><label class="wf-inline"><input type="checkbox" [(ngModel)]="node.rules['allowReturn']"> Permitir ajuste</label>}
          @if(node.type==='NOTIFICATION'){<label>Evento<select [(ngModel)]="node.rules['event']"><option value="ON_ENTER">Al ingresar a la etapa</option><option value="WORKFLOW_ADVANCED">Al avanzar el workflow</option></select></label><label>Plantilla del mensaje<textarea [(ngModel)]="node.rules['message']"></textarea></label><p>El destinatario se configura en Asignación. Sin uno específico, se notifica al solicitante.</p>}
          @if(node.type==='DECISION'){<p>Sí: resultado aprobado o completado. No: resultado rechazado. Define ambas conexiones.</p>}
          @if(node.type==='APPROVAL'){<p>Una aprobación por etapa. Para varias aprobaciones, utiliza etapas consecutivas.</p>}
        }
        <button class="wf-danger" (click)="removeNode(node.key)">Eliminar nodo</button>
      }@else{<p>Selecciona un nodo para editarlo.</p>}
    </aside>}
  </div>}
  <footer class="wf-wizard-footer"><button class="wf-secondary" (click)="goWizard(wizardStep-1)" [disabled]="wizardStep===1">Anterior</button><span>Paso {{ wizardStep }} de {{ wizardSteps.length }}</span><button class="wf-primary" (click)="goWizard(wizardStep+1)" [disabled]="wizardStep===wizardSteps.length">Siguiente</button></footer>`,
})
export class WorkflowDesigner implements OnInit,OnDestroy {
 @ViewChild('canvasViewport') viewport?:ElementRef<HTMLElement>;
 @Input() options:any={users:[],roles:[],departments:[]}; @Input() categories:string[]=[]; @Input() canSave=false; @Input() canStart=false;
 @Output() startWorkflow=new EventEmitter<string>();
 private readonly api=inject(WorkflowApi);private readonly shell=inject(App);private readonly route=inject(ActivatedRoute);private readonly router=inject(Router);
 readonly error=signal('');readonly message=signal('');readonly busy=signal(false);
 model:WorkflowTemplate={name:'Nuevo workflow',description:'Flujo de revisión y aprobación de documentos.',category:'Documental',originType:'ANY',active:false,publicationStatus:'DRAFT',nodes:[],edges:[],documentStatusRules:{ON_START:'UNCHANGED',ON_REVIEW:'IN_REVIEW',ON_APPROVE:'APPROVED',ON_REJECT:'REJECTED',ON_RETURN:'DRAFT',ON_ARCHIVE:'ARCHIVED',ON_COMPLETE:'UNCHANGED'}};
 selectedKey='';propertyTab='general';connectionTarget='';connectionOutcome='DEFAULT';zoom=0.78;preview=false;wizardStep=2;
 past:WorkflowTemplate[]=[];future:WorkflowTemplate[]=[];templateId='';private initial='';
 readonly types=[{code:'START',label:'Inicio',icon:'▶',description:'Punto de inicio del flujo'},{code:'TASK',label:'Tarea',icon:'▣',description:'Actividad a realizar'},{code:'REVIEW',label:'Revisión',icon:'♧',description:'Revisión de documentos'},{code:'APPROVAL',label:'Aprobación',icon:'✓',description:'Aprobación formal'},{code:'DECISION',label:'Decisión',icon:'◇',description:'Rama condicional del flujo'},{code:'NOTIFICATION',label:'Notificación',icon:'♧',description:'Envío de notificaciones'},{code:'ARCHIVE',label:'Archivo',icon:'▤',description:'Archivar documento'},{code:'END',label:'Fin',icon:'■',description:'Punto de finalización'}];
 readonly wizardSteps=['Información general','Pasos','Asignaciones','Reglas','Notificaciones','Vista previa'];
 readonly statusRuleOptions=[{key:'ON_START',label:'Al iniciar el proceso'},{key:'ON_REVIEW',label:'Al entrar a revisión/aprobación'},{key:'ON_APPROVE',label:'Al aprobar'},{key:'ON_REJECT',label:'Al rechazar'},{key:'ON_RETURN',label:'Al devolver para corrección'},{key:'ON_ARCHIVE',label:'Al archivar'},{key:'ON_COMPLETE',label:'Al completar el workflow'}];
 readonly documentStatuses=['DRAFT','PENDING','IN_REVIEW','APPROVED','REJECTED','CURRENT','ARCHIVED','VOIDED','TRASHED'];
 private readonly beforeUnload=(event:BeforeUnloadEvent)=>{if(this.initial!==JSON.stringify(this.model)){event.preventDefault();event.returnValue='';}};
 ngOnInit():void {
   this.templateId=this.route.snapshot.queryParamMap.get('template')||'';
    if(this.templateId)this.api.get<any>('/templates/'+this.templateId).subscribe({next:t=>{
     const keyMap=new Map<string,string>();for(const node of t.nodes)keyMap.set(node.id,node.rules.key||node.id);
     this.model={name:t.name,description:t.description||'',category:t.category,originType:t.origin_type,active:t.is_active,publicationStatus:t.publication_status||(t.is_active?'ACTIVE':'INACTIVE'),documentStatusRules:t.document_status_rules||this.model.documentStatusRules,
       nodes:t.nodes.map((n:any,i:number)=>({key:keyMap.get(n.id)!,name:n.name,type:n.stage_type,assignmentType:n.assignment_type,assignmentReference:n.assignment_reference,dueDays:n.due_days,rules:{...n.rules,x:n.rules.x??180+(i%3)*240,y:n.rules.y??60+Math.floor(i/3)*140}})),
       edges:t.edges.map((e:any)=>({from:keyMap.get(e.from_stage_id)!,to:keyMap.get(e.to_stage_id)!,outcome:e.condition?.outcome||'DEFAULT',label:e.name||''}))};
     if(this.route.snapshot.queryParamMap.get('clone')==='true'){this.model.name+=' (copia)';this.model.publicationStatus='DRAFT';this.model.active=false;this.templateId='';}
     this.initial=JSON.stringify(this.model);
   },error:()=>this.error.set('No se pudo cargar la plantilla.')});
   else {this.createStarterGraph();this.past=[];this.initial=JSON.stringify(this.model);}
   window.addEventListener('beforeunload',this.beforeUnload);
 }
 ngOnDestroy():void {window.removeEventListener('beforeunload',this.beforeUnload);}
 dirty():boolean{return this.initial!==JSON.stringify(this.model);}
 goWizard(step:number):void{this.wizardStep=Math.max(1,Math.min(this.wizardSteps.length,step));this.preview=this.wizardStep===6;if(this.wizardStep===2)this.propertyTab='general';if(this.wizardStep===3)this.propertyTab='assignment';if(this.wizardStep>=4&&this.wizardStep<=5)this.propertyTab='advanced';if(this.wizardStep===5){const notice=this.model.nodes.find(node=>node.type==='NOTIFICATION');if(notice)this.selectedKey=notice.key;}}
 togglePreview():void{this.preview=!this.preview;this.wizardStep=this.preview?6:2;}
 toggleInfo():void{this.preview=false;this.wizardStep=this.wizardStep===1?2:1;}
 saveAndStart():void{this.model.publicationStatus='ACTIVE';this.model.active=true;this.save(true);}
 private createStarterGraph():void {
   const make=(type:string,name:string,x:number,y:number,rules:Record<string,unknown>={})=>({key:crypto.randomUUID(),name,type,assignmentType:null,assignmentReference:null,dueDays:2,rules:{x,y,checklist:[],assignAtStart:['TASK','REVIEW','APPROVAL'].includes(type),allowReturn:['REVIEW','APPROVAL'].includes(type),allowReject:['REVIEW','APPROVAL'].includes(type),event:type==='NOTIFICATION'?'ON_ENTER':undefined,...rules}} as WorkflowNode);
   const start=make('START','Inicio',330,35),review=make('REVIEW','Revisión de documento',330,145),decision=make('DECISION','¿Aprobado?',355,275),correction=make('TASK','Corrección',55,430,{description:'Realizar los ajustes solicitados.'}),secondReview=make('REVIEW','Revisión de corrección',55,555),approval=make('APPROVAL','Aprobación final',665,430),notice=make('NOTIFICATION','Notificar resultado',665,555),end=make('END','Fin',690,675);
   this.model.nodes=[start,review,decision,correction,secondReview,approval,notice,end];
   this.model.edges=[{from:start.key,to:review.key,outcome:'DEFAULT',label:''},{from:review.key,to:decision.key,outcome:'DEFAULT',label:''},{from:decision.key,to:correction.key,outcome:'NO',label:'No'},{from:decision.key,to:approval.key,outcome:'YES',label:'Sí'},{from:correction.key,to:secondReview.key,outcome:'DEFAULT',label:''},{from:secondReview.key,to:approval.key,outcome:'DEFAULT',label:''},{from:approval.key,to:notice.key,outcome:'DEFAULT',label:''},{from:notice.key,to:end.key,outcome:'DEFAULT',label:''}];
   this.selectedKey=review.key;
 }
 checkpoint():void {this.past.push(structuredClone(this.model));if(this.past.length>50)this.past.shift();this.future=[];}
 undo():void {const item=this.past.pop();if(item){this.future.push(structuredClone(this.model));this.model=item;}}
 redo():void {const item=this.future.pop();if(item){this.past.push(structuredClone(this.model));this.model=item;}}
 add(type:string,x?:number,y?:number):void {if(type==='START'&&this.model.nodes.some(n=>n.type==='START')){this.error.set('Solo se permite un Inicio.');return;}this.checkpoint();const key=crypto.randomUUID();this.model.nodes.push({key,name:this.label(type),type,assignmentType:null,assignmentReference:null,dueDays:2,rules:{x:x??180+(this.model.nodes.length%3)*240,y:y??60+Math.floor(this.model.nodes.length/3)*140,checklist:[],assignAtStart:['TASK','REVIEW','APPROVAL'].includes(type),allowReturn:['REVIEW','APPROVAL'].includes(type),allowReject:['REVIEW','APPROVAL'].includes(type),event:type==='NOTIFICATION'?'ON_ENTER':undefined}});this.selectedKey=key;}
 label(type:string):string{return this.types.find(t=>t.code===type)?.label||type;}
 statusLabel(status:string):string{return ({UNCHANGED:'No cambiar',DRAFT:'Borrador',PENDING:'Pendiente',IN_REVIEW:'En revisión',APPROVED:'Aprobado',REJECTED:'Rechazado',CURRENT:'Vigente',ARCHIVED:'Archivado',VOIDED:'Anulado',TRASHED:'Papelera'} as Record<string,string>)[status]||status;}
 select(key:string):void{this.selectedKey=key;this.connectionTarget='';}
 selected():WorkflowNode|undefined{return this.model.nodes.find(n=>n.key===this.selectedKey);}
 nodeName(key:string):string{return this.model.nodes.find(n=>n.key===key)?.name||'';}
 icon(type:string):string{return ({START:'▶',TASK:'▣',REVIEW:'♧',APPROVAL:'✓',DECISION:'◇',NOTIFICATION:'♧',ARCHIVE:'▤',END:'■'} as Record<string,string>)[type]||'•';}
 nodeDescription(node:WorkflowNode):string{return String(node.rules['description']||({START:'Punto de inicio del flujo',TASK:'Actividad a realizar',REVIEW:'Revisar contenido y anexos',APPROVAL:'Aprobación por responsable',DECISION:'Define la siguiente etapa',NOTIFICATION:'Avisar al solicitante',ARCHIVE:'Archivar documento',END:'Punto de finalización'} as Record<string,string>)[node.type]||'Configura esta etapa');}
 edgePath(edge:WorkflowEdge):string{const from=this.position(edge.from),to=this.position(edge.to),source=this.model.nodes.find(n=>n.key===edge.from),target=this.model.nodes.find(n=>n.key===edge.to);const sx=from.x+(source?.type==='DECISION'?80:105),sy=from.y+(source?.type==='DECISION'?70:72),tx=to.x+(target?.type==='DECISION'?80:105),ty=to.y;const mid=(sy+ty)/2;return `M ${sx} ${sy} C ${sx} ${mid}, ${tx} ${mid}, ${tx} ${ty}`;}
 edgeLabelPosition(edge:WorkflowEdge):{x:number;y:number}{const from=this.position(edge.from),to=this.position(edge.to);return{x:(from.x+210+to.x)/2,y:(from.y+to.y)/2+30};}
  position(key:string):{x:number;y:number}{const n=this.model.nodes.find(n=>n.key===key);return{x:Number(n?.rules['x']||0),y:Number(n?.rules['y']||0)};}
 fit():void{const viewport=this.viewport?.nativeElement;if(!viewport)return;const width=Math.max(200,...this.model.nodes.map(n=>Number(n.rules['x']||0)+180));const height=Math.max(120,...this.model.nodes.map(n=>Number(n.rules['y']||0)+90));this.zoom=Math.max(0.25,Math.min(1.5,viewport.clientWidth/width,viewport.clientHeight/height));viewport.scrollTo(0,0);}
 paletteDrag(event:DragEvent,type:string):void{event.dataTransfer?.setData('text/plain','type:'+type);}
 nodeDrag(event:DragEvent,key:string):void{event.dataTransfer?.setData('text/plain','node:'+key);}
 drop(event:DragEvent):void{event.preventDefault();if(this.preview)return;const viewport=event.currentTarget as HTMLElement;const rect=viewport.getBoundingClientRect();const x=Math.max(0,Math.min(1020,(event.clientX-rect.left+viewport.scrollLeft)/this.zoom-80));const y=Math.max(0,Math.min(710,(event.clientY-rect.top+viewport.scrollTop)/this.zoom-25));const data=event.dataTransfer?.getData('text/plain')||'';if(data.startsWith('type:'))this.add(data.slice(5),x,y);else if(data.startsWith('node:')){const node=this.model.nodes.find(n=>n.key===data.slice(5));if(node){this.checkpoint();node.rules['x']=x;node.rules['y']=y;}}}
 outgoing(key:string):WorkflowEdge[]{return this.model.edges.filter(e=>e.from===key);}
 connect():void {if(!this.selectedKey||!this.connectionTarget)return;this.checkpoint();if(this.model.edges.some(e=>e.from===this.selectedKey&&e.outcome===this.connectionOutcome)){this.error.set('Ya existe esa salida. Elimínala antes de reemplazarla.');return;}this.model.edges.push({from:this.selectedKey,to:this.connectionTarget,outcome:this.connectionOutcome,label:this.connectionOutcome==='YES'?'Sí':this.connectionOutcome==='NO'?'No':''});this.connectionTarget='';}
 removeEdge(edge:WorkflowEdge):void{this.checkpoint();this.model.edges=this.model.edges.filter(e=>e!==edge);}
 removeNode(key:string):void{this.checkpoint();this.model.nodes=this.model.nodes.filter(n=>n.key!==key);this.model.edges=this.model.edges.filter(e=>e.from!==key&&e.to!==key);this.selectedKey='';}
 assignmentOptions(type:string):any[]{return type==='USER'?this.options.users:type==='ROLE'?this.options.roles:this.options.departments;}
  setChecklist(node:WorkflowNode,value:string):void{node.rules['checklist']=value.split('\n').map(v=>v.trim()).filter(Boolean);}
  checklistText(node:WorkflowNode):string{return Array.isArray(node.rules['checklist'])?(node.rules['checklist'] as string[]).join('\n'):'';}
 validate():void{this.error.set('');this.message.set('');this.busy.set(true);this.api.post('/templates/validate',this.model).subscribe({next:()=>{this.busy.set(false);this.message.set('Flujo válido: nodos conectados y transiciones coherentes. Los responsables se verifican al iniciar.');},error:e=>{this.busy.set(false);this.error.set(e.error?.message||'Flujo inválido.');}});}
  save(startAfter=false):void{this.error.set('');if(!this.canSave){this.error.set('Tu cuenta no tiene permiso para guardar plantillas.');return;}this.busy.set(true);this.model.active=this.model.publicationStatus==='ACTIVE';const request=this.templateId?this.api.put<any>('/templates/'+this.templateId,this.model):this.api.post<any>('/templates',this.model);request.subscribe({next:t=>{this.busy.set(false);this.templateId=t.id;this.model.publicationStatus=t.publication_status;this.model.active=t.is_active;this.initial=JSON.stringify(this.model);this.message.set('Workflow guardado · versión '+t.version+' · '+this.model.publicationStatus);this.shell.notify('Workflow guardado.');if(startAfter)this.startWorkflow.emit(t.id);},error:e=>{this.busy.set(false);this.error.set(e.error?.message||'No se pudo guardar.');}});}
}
