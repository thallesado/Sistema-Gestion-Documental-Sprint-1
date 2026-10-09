import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { ApiDepartment, ApiExpedient, ApiExpedientType, ApiResponsible, ExpedientApiService } from '../../../core/api/expedient-api.service';
import { ApiPatient, ClinicalApiService } from '../../../core/api/clinical-api.service';
import { WorkflowApi } from '../../workflows/workflow-api.service';
import { WorkflowStart } from '../../workflows/components/workflow-start';
import { AuthService } from '../../../core/auth/auth.service';

type ExpedientView = 'all' | 'active' | 'closed' | 'archived' | 'new';
type ExpedientForm = {
  code: string;
  name: string;
  expedientTypeId: string;
  departmentId: string;
  responsibleId: string;
  description: string;
};
type ExpedientItem = {
  id: string;
  title: string;
  meta: string;
  date: string;
  status: string;
  area: string;
  record: ApiExpedient;
};
type ExpedientParticipant = { key: string; source: 'USER' | 'PATIENT' | 'CUSTOM'; sourceId?: string; name: string; role: string };

@Component({
  selector: 'app-expedients-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, WorkflowStart],
  templateUrl: './expedientes-page.html',
  styleUrl: './expedientes-page.css',
})
export class ExpedientsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ExpedientApiService);
  private readonly clinicalApi = inject(ClinicalApiService);
  private readonly workflowApi = inject(WorkflowApi);
  private readonly auth = inject(AuthService);
  readonly workflowStartExpedient = signal<any>(null);
  readonly workflowOptions = signal<any>({users:[],roles:[],departments:[]});
  readonly loadingWorkflowOptions = signal(false);
  readonly expedientWorkflows = signal<any[]>([]);
  readonly view = (this.route.snapshot.data['expedientView'] ?? 'all') as ExpedientView;
  readonly search = signal('');
  readonly area = signal('');
  readonly selected = signal<ExpedientItem | null>(null);
  readonly step = signal(1);
  readonly saved = signal(false);
  readonly saving = signal(false);
  readonly loading = signal(false);
  readonly apiError = signal('');
  readonly totalCount = signal(0);
  readonly form = signal<ExpedientForm>({ code: '', name: '', expedientTypeId: '', departmentId: '', responsibleId: '', description: '' });
  readonly expedients = signal<ExpedientItem[]>([]);
  readonly expedientTypes = signal<ApiExpedientType[]>([]);
  readonly departments = signal<ApiDepartment[]>([]);
  readonly responsibleUsers = signal<ApiResponsible[]>([]);
  readonly patients = signal<ApiPatient[]>([]);
  readonly participants = signal<ExpedientParticipant[]>([]);
  participantSource: 'USER' | 'PATIENT' | 'CUSTOM' = 'USER';
  participantUserId = '';
  participantPatientId = '';
  participantName = '';
  participantRole = 'EXTERNO';
  newExpedientTypeName = '';
  showExpedientTypeForm = false;
  readonly creatingExpedientType = signal(false);
  readonly loadingFormOptions = signal(false);
  readonly activeCount = computed(() => this.expedients().filter((item) => item.status === 'Activo').length);
  readonly areas = ['General'];
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  readonly items = computed(() => {
    const query = this.search().trim().toLowerCase();
    const selectedArea = this.area();
    const status = this.view === 'active' ? 'Activo' : this.view === 'closed' ? 'Cerrado' : this.view === 'archived' ? 'Archivado' : '';
    return this.expedients().filter((item) => {
      const textMatches = !query || `${item.title} ${item.meta} ${item.area}`.toLowerCase().includes(query);
      return textMatches && (!status || item.status === status) && (!selectedArea || item.area === selectedArea);
    });
  });

  get isForm(): boolean { return this.view === 'new'; }
  get title(): string {
    return ({ all: 'Todos los expedientes', active: 'Expedientes activos', closed: 'Expedientes cerrados', archived: 'Expedientes archivados', new: 'Crear expediente' })[this.view];
  }
  get description(): string {
    return this.isForm ? 'Registra una nueva unidad documental en tres pasos.' : 'Organiza, consulta y da seguimiento a las unidades documentales de tu organización.';
  }
  get countLabel(): string { return `${this.items().length} de ${this.totalCount()} expedientes`; }

  constructor() {
    if (this.isForm) this.loadFormOptions();
    else this.loadExpedients();
  }

  updateField(field: keyof ExpedientForm, event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
    this.form.update((current) => ({ ...current, [field]: value }));
  }
  setSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
    if (this.isForm) return;
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.loadExpedients(), 300);
  }
  setArea(event: Event): void { this.area.set((event.target as HTMLSelectElement).value); }
  choose(item: ExpedientItem): void { this.selected.set(item);this.workflowApi.page('',{expedientId:item.id,size:20}).subscribe({next:p=>this.expedientWorkflows.set(p.content),error:()=>this.expedientWorkflows.set([])}); }
  closeDetail(): void { this.selected.set(null);this.expedientWorkflows.set([]); }
  openWorkflow(flow:any):void{void this.router.navigate(['/workflows'],{queryParams:{workflow:flow.id}});}
  nextStep(): void { if (this.step() < 3) this.step.update((value) => value + 1); }
  previousStep(): void { if (this.step() > 1) this.step.update((value) => value - 1); }
  saveExpedient(): void {
    const form = this.form();
    if (!form.code.trim() || !form.name.trim() || !form.expedientTypeId) {
      this.apiError.set('El código, el nombre y el tipo de expediente son obligatorios.');
      return;
    }
    this.saving.set(true);
    this.apiError.set('');
    this.api.create({
      expedientTypeId: form.expedientTypeId,
      responsibleId: form.responsibleId || undefined,
      departmentId: form.departmentId || undefined,
      code: form.code.trim(),
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      metadata: { participants: this.participants().map(({ key: _key, ...participant }) => participant) },
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.set(true);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.apiError.set(this.createErrorMessage(error));
      },
    });
  }
  clearFilters(): void {
    this.search.set('');
    this.area.set('');
    if (!this.isForm) this.loadExpedients();
  }
  statusClass(status: string): string {
    return status === 'Activo' ? 'status active' : status === 'Cerrado' ? 'status closed' : 'status archived';
  }
  icon(item: ExpedientItem): string { return '⚕'; }
  goTo(path: string): void { void this.router.navigateByUrl(path); }
  canStartWorkflow():boolean { try {const token=this.auth.accessToken();return !!token&&JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).authorities?.includes('workflow:start');}catch{return false;} }
  canManageExpedientTypes():boolean {try{const token=this.auth.accessToken();return !!token&&JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).authorities?.includes('expedient_type:create');}catch{return false;}}
  createExpedientType():void {const name=this.newExpedientTypeName.trim();if(!name||!this.canManageExpedientTypes())return;this.creatingExpedientType.set(true);this.api.createExpedientType(name).subscribe({next:type=>{this.expedientTypes.update(types=>[...types,type].sort((a,b)=>a.name.localeCompare(b.name,'es')));this.form.update(current=>({...current,expedientTypeId:type.id}));this.newExpedientTypeName='';this.showExpedientTypeForm=false;this.creatingExpedientType.set(false);},error:error=>{this.creatingExpedientType.set(false);this.apiError.set(error?.error?.message||'No se pudo crear el tipo de expediente.');}});}
  addParticipant():void {
    let participant:ExpedientParticipant|undefined;
    if(this.participantSource==='USER') {const user=this.responsibleUsers().find(item=>item.id===this.participantUserId);if(user)participant={key:'USER:'+user.id,source:'USER',sourceId:user.id,name:`${user.firstName} ${user.lastName}`.trim(),role:this.userParticipantRole(user)};}
    else if(this.participantSource==='PATIENT') {const patient=this.patients().find(item=>item.id===this.participantPatientId);if(patient)participant={key:'PATIENT:'+patient.id,source:'PATIENT',sourceId:patient.id,name:`${patient.firstName} ${patient.lastName}`.trim(),role:'Paciente'};}
    else {const name=this.participantName.trim();if(name)participant={key:'CUSTOM:'+name.toLocaleLowerCase(),source:'CUSTOM',name,role:this.participantRoleLabel(this.participantRole)};}
    if(!participant)return;
    if(this.participants().some(item=>item.key===participant!.key)){this.apiError.set('Esa persona ya fue agregada.');return;}
    this.apiError.set('');this.participants.update(items=>[...items,participant!]);this.participantUserId='';this.participantPatientId='';this.participantName='';
  }
  removeParticipant(key:string):void {this.participants.update(items=>items.filter(item=>item.key!==key));}
  userParticipantRole(user:ApiResponsible):string {if(user.staffType)return this.participantRoleLabel(user.staffType);return user.roleNames?.[0]||'Usuario del tenant';}
  participantRoleLabel(role:string):string {return ({DOCTOR:'Médico',MEDICO:'Médico',PHYSICIAN:'Médico',NURSE:'Enfermería',ENFERMERO:'Enfermería',ADMINISTRATIVE:'Administrativo',ADMINISTRATIVO:'Administrativo',DIAGNOSTIC_TECH:'Técnico de diagnóstico',PATIENT:'Paciente',PACIENTE:'Paciente',EXTERNAL:'Externo',EXTERNO:'Externo'} as Record<string,string>)[role.toUpperCase()]||role;}
  participantInitials(name:string):string {return name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0].toUpperCase()).join('')||'·';}
  openWorkflowStart(item:ExpedientItem):void {if(this.loadingWorkflowOptions())return;this.apiError.set('');this.loadingWorkflowOptions.set(true);this.workflowApi.get('/options').subscribe({next:options=>{this.workflowOptions.set(options);this.loadingWorkflowOptions.set(false);this.workflowStartExpedient.set(item.record);},error:error=>{this.loadingWorkflowOptions.set(false);this.apiError.set(error?.error?.message||'No se pudieron cargar los datos para iniciar el workflow.');}});}
  workflowStarted(flow:any):void {this.workflowStartExpedient.set(null);this.selected.set(null);void this.router.navigate(['/workflows'],{queryParams:{workflow:flow.id}});}

  loadExpedients(): void {
    this.loading.set(true);
    this.apiError.set('');
    this.api.expedients(this.search()).subscribe({
      next: (response) => {
        this.expedients.set(response.content.map((expedient) => this.toExpedient(expedient)));
        this.totalCount.set(response.totalElements);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.expedients.set([]);
        this.totalCount.set(0);
        this.loading.set(false);
        this.apiError.set(this.apiErrorMessage(error));
      },
    });
  }

  retry(): void { this.loadExpedients(); }

  selectedTypeName(): string {
    return this.expedientTypes().find((type) => type.id === this.form().expedientTypeId)?.name || 'Sin tipo indicado';
  }

  selectedDepartmentName(): string {
    return this.departments().find((department) => department.id === this.form().departmentId)?.name || 'Sin área indicada';
  }

  selectedResponsibleName(): string {
    const user = this.responsibleUsers().find((responsible) => responsible.id === this.form().responsibleId);
    return user ? `${user.firstName} ${user.lastName}`.trim() : 'Sin responsable indicado';
  }

  private loadFormOptions(): void {
    this.loadingFormOptions.set(true);
    this.apiError.set('');
    forkJoin({
      types: this.api.expedientTypes(),
      departments: this.api.departments(),
      responsibleUsers: this.api.responsibleUsers(),
    }).subscribe({
      next: ({ types, departments, responsibleUsers }) => {
        this.expedientTypes.set(types);
        this.departments.set(departments);
        this.responsibleUsers.set(responsibleUsers);
        this.clinicalApi.patients('',0,100).subscribe({next:page=>this.patients.set(page.content),error:()=>this.patients.set([])});
        this.loadingFormOptions.set(false);
      },
      error: (error: unknown) => {
        this.loadingFormOptions.set(false);
        this.apiError.set(this.formOptionsErrorMessage(error));
      },
    });
  }

  private toExpedient(expedient: ApiExpedient): ExpedientItem {
    return {
      id: expedient.id,
      record: expedient,
      title: `${expedient.code} - ${expedient.name}`,
      meta: expedient.description || 'Sin descripción',
      date: this.displayDate(expedient.updatedAt || expedient.createdAt),
      status: this.statusLabel(expedient.status),
      area: 'General',
    };
  }

  private displayDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : date.toLocaleDateString('es-BO');
  }

  private statusLabel(status: string): string {
    const normalized = status.trim().toLowerCase();
    if (normalized === 'active' || normalized === 'activo') return 'Activo';
    if (normalized === 'closed' || normalized === 'cerrado') return 'Cerrado';
    if (normalized === 'archived' || normalized === 'archivado') return 'Archivado';
    return status.trim() || 'Estado no informado';
  }

  private apiErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 403) return 'No tienes permiso para consultar los expedientes del tenant activo.';
      if (error.status === 401) return 'La sesión no está autorizada para consultar los expedientes.';
      if (error.status > 0) return `La API no pudo cargar los expedientes (HTTP ${error.status}).`;
    }
    return error instanceof Error ? error.message : 'La API no pudo cargar los expedientes.';
  }

  private createErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 400) return 'No se pudo crear el expediente. Revisa los datos ingresados y que el código no esté repetido.';
      if (error.status === 403) return 'No tienes permiso para crear expedientes en el tenant activo.';
      if (error.status === 401) return 'Tu sesión expiró. Inicia sesión nuevamente.';
      if (error.status > 0) return `No se pudo crear el expediente (HTTP ${error.status}).`;
    }
    return 'No se pudo crear el expediente.';
  }

  private formOptionsErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 403) return 'No tienes permiso para cargar los catálogos necesarios para crear un expediente.';
      if (error.status === 401) return 'Tu sesión expiró. Inicia sesión nuevamente.';
      if (error.status > 0) return `No se pudo preparar el formulario (HTTP ${error.status}).`;
    }
    return 'No se pudo preparar el formulario para crear el expediente.';
  }
}

export { ExpedientsPage as ExpedientesPage };
