import { Component, OnInit, OnDestroy, inject, signal, ViewChild, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { WorkflowApi } from './workflow-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { Pagination } from '../../shared/components/pagination/pagination.component';
import { WorkflowPreview } from './components/workflow-preview';
import { WorkflowStart } from './components/workflow-start';
import { WorkflowDesigner } from './components/workflow-designer';
import { DocumentApiService } from '../../core/api/document-api.service';
import { ExpedientApiService } from '../../core/api/expedient-api.service';
import { exportToPrintView, ExportColumn } from '../../core/utils/export-utils';
import { Subject, debounceTime, takeUntil } from 'rxjs';
import { App } from '../../shell/app';

@Component({selector:'app-workflows-page',standalone:true,
 imports:[CommonModule,FormsModule,RouterLink,Pagination,WorkflowPreview,WorkflowStart,WorkflowDesigner],
 templateUrl:'./workflows-page.html',styleUrls:['./workflows-page.css','./workflows-overview.css','./workflows-tasks.css','./workflows-review.css','./workflows-active.css','./workflows-finished.css','./workflows-templates.css','./workflows-designer.css'],encapsulation:ViewEncapsulation.None})
export class WorkflowsPage implements OnInit, OnDestroy {
 readonly api=inject(WorkflowApi);readonly auth=inject(AuthService);private readonly shell=inject(App);private readonly route=inject(ActivatedRoute);private readonly router=inject(Router);
 private readonly documents=inject(DocumentApiService);private readonly expedients=inject(ExpedientApiService);
 readonly filterDocuments=signal<any[]>([]);readonly filterExpedients=signal<any[]>([]);readonly filterTemplates=signal<any[]>([]);
 documentFilterSearch='';expedientFilterSearch='';templateFilterSearch='';
 @ViewChild(WorkflowDesigner) designer?:WorkflowDesigner;
 readonly items=signal<any[]>([]);readonly selected=signal<any>(null);readonly flow=signal<any>(null);
 readonly loading=signal(false);readonly busy=signal(false);readonly error=signal('');readonly message=signal('');
 readonly options=signal<any>({users:[],roles:[],departments:[]});readonly summary=signal<any>({});readonly notices=signal<any[]>([]);
 mode='all';page=1;size=10;total=0;tab='Detalle';flowTab='Detalle';bucket='';search='';sort='created_at';direction='desc';activeView:'kanban'|'list'='kanban';completedPeriod='3';
 filters:Record<string,any>={};advanced=false;showStart=false;initialTemplate='';showNotices=false;showHierarchy=false;
 menu='';actionDialog:any=null;actionComment='';approvalObservation='';targetUserId='';returnStageId='';checklist:Record<string,boolean>={};commentText='';
 selectedTemplate:any=null;templateHistory:any[]=[];templateHistoryFamily='';editFlow:any=null;
 readonly leaveDialog=signal(false);private leaveResolve:((value:boolean)=>void)|null=null;
 readonly clockNow=signal(Date.now());private elapsedTimer?:number;
 private readonly searchInput=new Subject<string>();private readonly destroyed=new Subject<void>();
 private lastSyncedQueryState='';
 readonly bucketOptions=[{label:'Todos',value:''},{label:'Activos',value:'active'},{label:'En revisión',value:'review'},{label:'Pendientes',value:'pending'},{label:'Completados',value:'completed'},{label:'Borradores',value:'draft'}];
 readonly taskTabs=[{label:'Pendientes',value:'PENDING'},{label:'En progreso',value:'IN_PROGRESS'},{label:'Completadas',value:'COMPLETED'},{label:'Vencidas',value:'overdue'}];
 readonly labels:Record<string,string>={DRAFT:'Borrador',STARTED:'Activo',IN_PROGRESS:'En progreso',PAUSED:'Pausado',COMPLETED:'Completado',CANCELED:'Cancelado',PENDING:'Pendiente',OVERDUE:'Vencida',APPROVED:'Aprobado',REJECTED:'Rechazado',CHANGES_REQUESTED:'Devuelto',ACKNOWLEDGED:'Revisado',IN_REVIEW:'En revisión',CURRENT:'Vigente',VOIDED:'Anulado',ARCHIVED:'Archivado',START:'Inicio',TASK:'Tarea',REVIEW:'Revisión',APPROVAL:'Aprobación',DECISION:'Decisión',NOTIFICATION:'Notificación',END:'Fin'};
 ngOnInit():void {
   this.mode=this.route.snapshot.data['workflowMode']||'all';
   if(this.mode==='tasks')this.bucket='PENDING';
   if(this.mode==='completed')this.sort='completed_at';
   this.restoreFiltersFromUrl();
   if(this.mode==='completed'){this.completedPeriod=this.filters['completedFrom']?'custom':'3';if(!this.filters['completedFrom'])this.setCompletedPeriod('3',false);}
   this.lastSyncedQueryState=this.queryStateKey(this.route.snapshot.queryParamMap);
   this.route.queryParamMap.pipe(takeUntil(this.destroyed)).subscribe(query=>{
     const state=this.queryStateKey(query);if(state===this.lastSyncedQueryState)return;
     this.restoreFiltersFromUrl(query);if(this.mode==='completed'){this.completedPeriod=this.filters['completedFrom']?'custom':'3';if(!this.filters['completedFrom'])this.setCompletedPeriod('3',false);}this.lastSyncedQueryState=state;this.load();
   });
   this.searchInput.pipe(debounceTime(300),takeUntil(this.destroyed)).subscribe(()=>this.resetPage());
   this.api.get<any>('/options').subscribe({next:o=>this.options.set(o),error:e=>this.fail(e)});
   this.elapsedTimer=window.setInterval(()=>this.clockNow.set(Date.now()),1000);
   this.load();
   const workflowId=this.route.snapshot.queryParamMap.get('workflow');if(workflowId)this.openFlow({id:workflowId});
 }
 ngOnDestroy():void{if(this.elapsedTimer!==undefined)window.clearInterval(this.elapsedTimer);this.destroyed.next();this.destroyed.complete();}
 title():string {return ({all:'Todos los workflows',tasks:'Mis tareas',review:'Pendientes de revisión',approval:'Pendientes de aprobación',active:'Workflows activos',completed:'Workflows finalizados',templates:'Plantillas de workflows',designer:'Diseñador'} as Record<string,string>)[this.mode]||'Workflows';}
 description():string{return this.mode==='templates'?'Plantillas reutilizables para estandarizar procesos de tu organización.':this.mode==='completed'?'Consulta procesos completados, resultados y documentación asociada.':this.mode==='active'?'Visualiza y gestiona los workflows que se encuentran en curso.':this.mode==='tasks'?'Tareas de los workflows que tienes asignadas como responsable.':this.mode==='review'?'Documentos y expedientes que requieren revisión según los workflows asignados.':this.mode==='approval'?'Revisa y gestiona los documentos que requieren tu aprobación.':this.taskMode()?'Gestiona las tareas y decisiones que tienes asignadas.':'Gestiona y supervisa los flujos de trabajo de documentos y expedientes.';}
 taskMode():boolean{return ['tasks','review','approval'].includes(this.mode);}
 categories():string[]{return this.summary().categories||[];}
 can(permission:string):boolean {
   try{const token=this.auth.accessToken();if(!token)return false;const data=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));return(data.authorities||[]).includes(permission);}catch{return false;}
 }
 currentOwner():boolean{return !!this.options().users.find((u:any)=>u.id===this.auth.user()?.id)?.owner;}
 params():Record<string,unknown> {
   const p:Record<string,unknown>={...this.filters,page:this.page-1,size:this.size,search:this.search,sort:this.sort,direction:this.direction};
   if(this.taskMode()) {
     if(this.mode==='review')p['stageType']='REVIEW';else if(this.mode==='approval')p['stageType']='APPROVAL';
     else if(this.bucket==='overdue')p['overdue']=true;else if(this.bucket)p['status']=this.bucket;
   } else if(this.mode==='active')p['bucket']='operational';else if(this.mode==='completed')p['bucket']='completed';else if(this.bucket)p['bucket']=this.bucket;
   return p;
 }
 load():void {
   if(this.mode==='designer')return;
   this.loading.set(true);this.error.set('');
   const resource=this.mode==='templates'?'/templates':this.taskMode()?'/tasks':'';
   this.api.page(resource,this.params()).subscribe({next:p=>{this.items.set(p.content);this.total=p.totalElements;this.loading.set(false);if(this.mode==='completed'&&(!this.flow()||!p.content.some((item:any)=>item.id===this.flow().id))){const requested=this.route.snapshot.queryParamMap.get('workflow');const first=p.content.find((item:any)=>item.id===requested)||p.content[0];if(first)this.openFlow(first);else this.flow.set(null);}if(['tasks','review','approval'].includes(this.mode)&&(!this.selected()||!p.content.some((task:any)=>task.id===this.selected().id))){const requested=this.route.snapshot.queryParamMap.get('task');const first=p.content.find((task:any)=>task.id===requested)||p.content[0];if(first)this.selectTask(first);else this.selected.set(null);}},error:e=>{this.loading.set(false);this.fail(e);}});
   this.api.get<any>('/summary',this.params()).subscribe({next:s=>this.summary.set(s),error:e=>this.fail(e)});
 }
 onSearchChange():void{this.searchInput.next(this.search);}
 setOverviewSort(value:string):void{const [sort,direction]=value.split(':');this.sort=sort||'created_at';this.direction=direction||'desc';this.resetPage();}
  resetPage():void{this.page=1;this.syncFiltersToUrl();this.load();}
  setCompletedPeriod(period:string,reload=true):void{this.completedPeriod=period;if(period==='all'){delete this.filters['completedFrom'];delete this.filters['completedTo'];}else if(period!=='custom'){const date=new Date();date.setMonth(date.getMonth()-Number(period));this.filters['completedFrom']=new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,10);delete this.filters['completedTo'];}if(reload)this.resetPage();}
  private restoreFiltersFromUrl(query=this.route.snapshot.queryParamMap):void{
    this.search=query.get('search')||'';this.bucket=query.get('bucket')??(this.mode==='tasks'?'PENDING':'');
    this.page=Math.max(1,Number(query.get('page')||1));this.size=Math.min(100,Math.max(5,Number(query.get('size')||10)));
    this.sort=query.get('sort')||(this.mode==='completed'?'completed_at':'created_at');this.direction=query.get('direction')||'desc';
   const filterKeys=['category','priority','status','responsibleId','departmentId','createdFrom','createdTo','startedFrom','startedTo','completedFrom','completedTo','dueFrom','dueTo','documentId','expedientId','templateId','today'];
    this.filters=Object.fromEntries(filterKeys.map(key=>[key,query.get(key)||'']).filter(([,value])=>!!value));
  }
  private queryStateKey(query:any):string{
    const keys=['search','bucket','page','size','sort','direction','category','priority','status','responsibleId','departmentId','createdFrom','createdTo','startedFrom','startedTo','completedFrom','completedTo','dueFrom','dueTo','documentId','expedientId','templateId','today'];
    const defaults:Record<string,string>={bucket:this.mode==='tasks'?'PENDING':'',page:'1',size:'10',sort:this.mode==='completed'?'completed_at':'created_at',direction:'desc'};
    return JSON.stringify(keys.map(key=>[key,query.get(key)||defaults[key]||'']));
  }
 private syncFiltersToUrl():void{
   const query:Record<string,string|null>={search:this.search||null,bucket:this.bucket||null,page:String(this.page),size:String(this.size),sort:this.sort,direction:this.direction};
    for(const key of ['category','priority','status','responsibleId','departmentId','createdFrom','createdTo','startedFrom','startedTo','completedFrom','completedTo','dueFrom','dueTo','documentId','expedientId','templateId','today'])query[key]=this.filters[key]?String(this.filters[key]):null;
    this.lastSyncedQueryState=this.queryStateKey({get:(key:string)=>query[key]});
    void this.router.navigate([],{relativeTo:this.route,queryParams:query,queryParamsHandling:'merge',replaceUrl:true});
 }
 exportCurrentPage():void{
   const columns:ExportColumn[]=[{key:'code',label:'Código'},{key:'title',label:'Workflow'},{key:'category',label:'Tipo'},{key:'status',label:'Estado'},{key:'responsible_name',label:'Responsable'},{key:'due_at',label:'Vencimiento'},{key:'created_at',label:'Creación'}];
   exportToPrintView(this.title(),'Página actual de resultados (usa la impresión del navegador para guardar como PDF).',this.items(),columns);
 }
 exportFlowHistory(flow:any):void{
   const rows=this.historyEvents(flow).map((event:any)=>({...event,event_label:this.eventLabel(event.event_type),workflow_status:this.historyWorkflowStatus(event,flow),result_label:this.status(event.result)}));
   const columns:ExportColumn[]=[{key:'event_label',label:'Evento'},{key:'actor_name',label:'Usuario'},{key:'performed_at',label:'Fecha'},{key:'workflow_status',label:'Estado del workflow'},{key:'result_label',label:'Resultado de la acción'},{key:'comment',label:'Comentario'}];
   exportToPrintView('Historial '+flow.code,'Estado actual: '+this.status(flow.status)+' · Trazabilidad del workflow · '+flow.title,rows,columns);
 }
 toggleAdvanced():void{this.advanced=!this.advanced;if(this.advanced&&!this.taskMode()&&this.mode!=='templates')this.loadOriginFilters();}
 loadOriginFilters():void{this.documents.documents(this.documentFilterSearch,undefined,0,20).subscribe({next:p=>this.filterDocuments.set(p.content),error:e=>this.fail(e)});this.expedients.expedients(this.expedientFilterSearch,0,20).subscribe({next:p=>this.filterExpedients.set(p.content),error:e=>this.fail(e)});this.api.page('/templates',{search:this.templateFilterSearch,size:20}).subscribe({next:p=>this.filterTemplates.set(p.content),error:e=>this.fail(e)});}
 clearFilters():void{this.filters={};this.search='';this.bucket=this.mode==='tasks'?'PENDING':'';this.resetPage();}
 status(value:string):string{return this.labels[value]||value;}
 priority(value:number):string{return ['','Urgente','Alta','Media','Baja','Baja'][value]||'Media';}
 dueLabel(value:string|null):string {if(!value)return 'Sin fecha límite';const due=new Date(value),remaining=due.getTime()-Date.now();if(remaining<0){const days=Math.max(1,Math.ceil(Math.abs(remaining)/86400000));return `Vencido hace ${days} día${days===1?'':'s'}`;}const today=new Date();today.setHours(0,0,0,0);due.setHours(0,0,0,0);const days=Math.round((due.getTime()-today.getTime())/86400000);if(days===0)return 'Vence hoy';if(days===1)return 'Vence mañana';if(days<=3)return `Vence en ${days} días`;return `Vence el ${new Intl.DateTimeFormat('es',{dateStyle:'medium'}).format(new Date(value))}`;}
 dueUrgency(value:string|null):'overdue'|'today'|'soon'|'normal'{if(!value)return'normal';const date=new Date(value);if(date.getTime()<Date.now())return'overdue';const today=new Date();today.setHours(0,0,0,0);date.setHours(0,0,0,0);const days=Math.round((date.getTime()-today.getTime())/86400000);return days<=0?'today':days<=3?'soon':'normal';}
 overdue(value:string|null):boolean{return !!value&&new Date(value).getTime()<Date.now();}
 progress(item:any):number{return item.status==='COMPLETED'?100:Number(item.progress||0);}
 approvalHighPriorityCount():number{return this.items().filter(item=>Number(item.priority)<=2).length;}
 approvalDueSoonCount():number{return this.items().filter(item=>['today','soon'].includes(this.dueUrgency(item.due_at))).length;}
 readonly kanbanLanes=[{key:'preparation',label:'Borrador'},{key:'review',label:'En revisión'},{key:'approval',label:'Aprobación'},{key:'active',label:'En curso'}];
 lane(item:any):string{if(item.status==='DRAFT')return'preparation';if(item.stage_type==='REVIEW')return'review';if(item.stage_type==='APPROVAL')return'approval';return'active';}
 laneItems(key:string):any[]{return this.items().filter(item=>this.lane(item)===key);}
 duration(hours:any):string{const value=Number(hours);if(!Number.isFinite(value))return'Sin datos';if(value<24)return`${Math.round(value)} h`;const days=value/24;return`${days.toFixed(days<10?1:0)} días`;}
 elapsedDuration(flow:any):string{if(!flow?.started_at)return'Sin registro de inicio';const start=new Date(flow.started_at).getTime();const end=flow.completed_at?new Date(flow.completed_at).getTime():this.clockNow();if(!Number.isFinite(start)||!Number.isFinite(end)||end<start)return'Sin datos';const seconds=Math.floor((end-start)/1000),days=Math.floor(seconds/86400),hours=Math.floor(seconds%86400/3600),minutes=Math.floor(seconds%3600/60),remainder=seconds%60;const clock=[hours,minutes,remainder].map(value=>String(value).padStart(2,'0')).join(':');return days?`${days} d ${clock}`:clock;}
 setDateFilter(key:string,value:string):void{this.filters[key]=value;if(!value)delete this.filters[key];if(this.mode==='completed'&&(key==='completedFrom'||key==='completedTo'))this.completedPeriod='custom';this.resetPage();}
 completedResult(item:any):string{return item.last_outcome==='APPROVED'?'Aprobado':item.last_outcome==='REJECTED'?'Rechazado':this.status(item.last_outcome||item.status);}
 templateIcon(category:string):string{const value=(category||'').toLowerCase();if(value.includes('clín')||value.includes('clin'))return'✚';if(value.includes('compra'))return'🛒';if(value.includes('rrhh')||value.includes('humano'))return'♟';if(value.includes('legal'))return'⚖';return'▤';}
 templateStatus(item:any):string{return ({DRAFT:'Borrador',ACTIVE:'Activa',INACTIVE:'Inactiva'} as Record<string,string>)[item.publication_status]||(item.is_active?'Activa':'Inactiva');}
 fail(e:any):void{this.error.set(e.error?.message||e.error?.detail||'No fue posible completar la operación.');}
 selectTask(item:any):void {
   if(!this.taskMode()){void this.router.navigate(['/workflows/tasks'],{queryParams:{task:item.id}});return;}
   this.loading.set(true);this.tab=this.mode==='review'?'Vista previa':this.mode==='approval'?'Información':'Detalle';this.commentText='';this.checklist={};
   this.api.get<any>('/tasks/'+item.id).subscribe({next:t=>{this.selected.set(t);this.loading.set(false);this.checklist={...t.checklist_results};},error:e=>{this.loading.set(false);this.fail(e);}});
 }
 openFlow(item:any):void{this.flowTab='Detalle';this.api.get<any>('/'+item.id).subscribe({next:f=>this.flow.set(f),error:e=>this.fail(e)});}
 eventIcon(type:string):string{return ({STARTED:'▶',STEP_STARTED:'↪',STEP_COMPLETED:'✓',STAGE_COMPLETED:'✓',TASK_ASSIGNED:'♙',APPROVED:'✓',REJECTED:'×',RETURNED:'↩',COMMENT:'💬',COMMENTED:'💬',PAUSED:'Ⅱ',RESUMED:'▶',CANCELED:'■',COMPLETED:'✓'} as Record<string,string>)[type]||'•';}
 eventLabel(type:string):string{return ({STARTED:'Workflow iniciado',STEP_STARTED:'Etapa iniciada',STEP_COMPLETED:'Etapa completada',STAGE_COMPLETED:'Etapa completada',TASK_ASSIGNED:'Tarea asignada',APPROVED:'Aprobación registrada',REJECTED:'Rechazo registrado',RETURNED:'Devuelto para corrección',COMMENTED:'Comentario añadido',PAUSE:'Workflow pausado',PAUSED:'Workflow pausado',RESUME:'Workflow reanudado',RESUMED:'Workflow reanudado',CANCEL:'Workflow cancelado',CANCELED:'Workflow cancelado',COMPLETED:'Workflow finalizado',EDITED:'Workflow editado',TASK_DUE_SOON:'Aviso de vencimiento',TASK_EXPIRED:'Tarea vencida'} as Record<string,string>)[type]||type.replaceAll('_',' ').toLocaleLowerCase('es').replace(/^./,letter=>letter.toLocaleUpperCase('es'));}
 historyEvents(flow:any):any[]{return [...(flow.events||[])].sort((a:any,b:any)=>{const byTime=new Date(a.performed_at).getTime()-new Date(b.performed_at).getTime();if(byTime)return byTime;const order:Record<string,number>={STARTED:0,STEP_STARTED:1,TASK_ASSIGNED:2,STEP_COMPLETED:3,STAGE_COMPLETED:4,COMPLETED:5};return (order[a.event_type]??3)-(order[b.event_type]??3);});}
 historyWorkflowStatus(event:any,flow:any):string{return this.status(event.details?.workflowStatus||event.details?.toStatus||flow.status);}
 historyEventResult(event:any):string {if(event.event_type==='TASK_ASSIGNED')return `Tarea: ${this.status(event.result||'PENDING')}`;if(event.event_type==='STAGE_COMPLETED')return event.result?this.status(event.result):'Completada';if(['STEP_COMPLETED','APPROVED','REJECTED','RETURNED','COMPLETED','CANCELED','PAUSED','RESUMED'].includes(event.event_type))return this.status(event.result||event.event_type);return '';}
 participantRole(roles:string|null):string{return roles||'Participante';}
 start(template=''):void{this.initialTemplate=template;this.showStart=true;}
 started(flow:any):void{this.showStart=false;this.message.set('Workflow iniciado: '+flow.code);this.shell.notify('Workflow iniciado correctamente.');this.load();this.openFlow(flow);}
 changePage(page:number):void{this.page=page;this.syncFiltersToUrl();this.load();}
 changeSize(size:number):void{this.size=size;this.resetPage();}
 taskTabsList():string[]{return this.mode==='review'?['Vista previa','Datos del documento','Checklist','Comentarios','Historial']:this.mode==='approval'?['Información','Documento','Historial','Trazabilidad']:['Detalle','Historial','Documento','Expediente','Comentarios'];}
 taskTabLabel(name:string,task:any):string{if(name==='Historial'||name==='Trazabilidad')return `${name} (${task.events?.length||0})`;if(name==='Comentarios')return `${name} (${task.comments?.length||0})`;if(name==='Documento')return `${name} (${task.document_id?1:0})`;if(name==='Checklist'&&this.mode==='review')return `${name} (${this.checklistItems().length})`;return name;}
 checklistProgress():string{const items=this.checklistItems();const complete=items.filter((item:string)=>this.checklist[item]).length;return `${complete}/${items.length}`;}
 actionable():boolean {const t=this.selected();return t&&['PENDING','IN_PROGRESS','OVERDUE'].includes(t.status)&&['STARTED','IN_PROGRESS'].includes(t.workflow_status);}
 checklistItems():string[]{return this.selected()?.checklist_items?.map((item:any)=>item.label)||this.selected()?.rules?.checklist||[];}
 saveChecklist():void{this.api.put('/tasks/'+this.selected().id+'/checklist',this.checklist).subscribe({error:e=>this.fail(e)});}
 openAction(action:string,flowItem?:any):void {
   this.actionDialog={action,flow:flowItem};this.actionComment=this.mode==='approval'?this.approvalObservation.trim():'';this.targetUserId='';this.returnStageId='';
   if(action==='RETURN')this.targetUserId=this.selected()?.creator_id||'';
 }
 actionTitle(action:string):string {return ({APPROVE:'Aprobar',REJECT:'Rechazar',RETURN:'Solicitar corrección',ESCALATE:'Escalar tarea',REVIEW:'Marcar revisado',COMPLETE:'Completar tarea',BEGIN:'Comenzar tarea',PAUSE:'Pausar workflow',RESUME:'Reanudar workflow',CANCEL:'Cancelar workflow'} as Record<string,string>)[action]||action;}
 eligibleEscalation():any[]{const permission=this.selected()?.stage_type==='APPROVAL'?'workflow:approve':this.selected()?.stage_type==='REVIEW'?'workflow:review':'task:update';return this.options().users.filter((u:any)=>(u.permissions||[]).includes(permission));}
 eligibleReturn():any[]{return this.options().users.filter((u:any)=>(u.permissions||[]).includes('task:update')&&(!this.selected()?.document_id||(u.permissions||[]).includes('document:update')));}
 actionableStages():any[]{const task=this.selected();const current=(task?.stages||[]).find((s:any)=>s.id===task.stage_id);return(task?.stages||[]).filter((s:any)=>['TASK','REVIEW','APPROVAL'].includes(s.stage_type)&&s.sort_order<=(current?.sort_order??0));}
 stageState(stage:any):'done'|'current'|'future'{const task=this.selected();const current=(task?.stages||[]).find((item:any)=>item.id===task?.stage_id);if(stage.id===task?.stage_id)return'current';return Number(stage.sort_order)<Number(current?.sort_order??0)?'done':'future';}
 stageSymbol(stage:any):string{return this.stageState(stage)==='done'?'✓':this.stageState(stage)==='current'?'●':'○';}
 confirmAction():void {
   if(!this.actionDialog||this.busy())return;const action=this.actionDialog.action;
   if(['REJECT','RETURN','ESCALATE','CANCEL'].includes(action)&&!this.actionComment.trim()){this.error.set('El motivo es obligatorio.');return;}
   if(action==='ESCALATE'&&!this.targetUserId){this.error.set('Selecciona un responsable.');return;}
   this.busy.set(true);this.error.set('');
   const flow=this.actionDialog.flow;
   const resource=flow?'/'+flow.id+'/actions':'/tasks/'+this.selected().id+'/actions';
   const payload={action,comment:this.actionComment||null,targetUserId:this.targetUserId||null,returnStageId:this.returnStageId||null,checklist:this.checklist};
   this.api.post(resource,payload).subscribe({next:t=>{this.busy.set(false);this.actionDialog=null;this.approvalObservation='';this.message.set(this.actionTitle(action)+': operación realizada.');this.shell.notify(this.actionTitle(action)+': operación realizada.');if(t&&!flow)this.selected.set(t);if(flow)this.openFlow(flow);this.load();},error:e=>{this.busy.set(false);this.fail(e);}});
 }
 addComment():void {if(!this.commentText.trim()||this.busy())return;this.busy.set(true);const task=this.selected();this.api.post('/tasks/'+task.id+'/comments',{comment:this.commentText.trim()}).subscribe({next:()=>{this.busy.set(false);this.selectTask(task);},error:e=>{this.busy.set(false);this.fail(e);}});}
 deactivate(template:any):void{this.selectedTemplate=template;}
 confirmDeactivate():void {const template=this.selectedTemplate;this.api.deactivate(template.id).subscribe({next:()=>{this.selectedTemplate=null;this.load();},error:e=>this.fail(e)});}
 history(template:any):void {this.templateHistoryFamily=template.family_id;this.api.page('/templates',{familyId:template.family_id,size:100}).subscribe({next:p=>this.templateHistory=p.content,error:e=>this.fail(e)});}
 seedStarterTemplates():void{if(this.busy())return;this.busy.set(true);this.api.post<any>('/templates/seed',{}).subscribe({next:r=>{this.busy.set(false);this.load();this.shell.notify(r.count?'Se agregaron '+r.count+' plantillas iniciales.':'Las plantillas iniciales ya estaban cargadas.');},error:e=>{this.busy.set(false);this.fail(e);}});}
 notifications():void{this.showNotices=!this.showNotices;if(this.showNotices)this.api.page('/notifications',{size:100}).subscribe({next:p=>this.notices.set(p.content),error:e=>this.fail(e)});}
 readNotice(notice:any):void {this.api.readNotice(notice.id).subscribe({next:()=>{notice.is_read=true;if(notice.related_entity_type==='workflow')this.openFlow({id:notice.related_entity_id});else if(notice.related_entity_type==='workflow_task')void this.router.navigate(['/workflows/tasks'],{queryParams:{task:notice.related_entity_id}});},error:e=>this.fail(e)});}
 hierarchy(role:any):void{this.api.hierarchy(role.id,Number(role.approval_rank)).subscribe({next:()=>this.message.set('Jerarquía actualizada.'),error:e=>this.fail(e)});}
 saveEdit():void {this.api.put('/'+this.editFlow.id,{title:this.editFlow.title,description:this.editFlow.description,priority:Number(this.editFlow.priority),dueAt:this.editFlow.due_at?new Date(this.editFlow.due_at).toISOString():null}).subscribe({next:()=>{this.editFlow=null;this.load();},error:e=>this.fail(e)});}
 openEdit(item:any):void{this.editFlow={...item,due_at:item.due_at?new Date(new Date(item.due_at).getTime()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16):''};this.menu='';}
 canLeave():boolean|Promise<boolean>{if(!this.designer?.dirty())return true;this.leaveDialog.set(true);return new Promise(resolve=>this.leaveResolve=resolve);}
 resolveLeave(value:boolean):void{this.leaveDialog.set(false);this.leaveResolve?.(value);this.leaveResolve=null;}
}
