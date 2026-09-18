import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiExpedient, ExpedientApiService } from '../../core/api/expedient-api.service';

type ExpedientView = 'all' | 'active' | 'closed' | 'archived' | 'new';
type ExpedientForm = { name: string; type: string; area: string; responsible: string; description: string };
type ExpedientItem = {
  id: string;
  title: string;
  meta: string;
  date: string;
  status: string;
  area: string;
};

@Component({
  selector: 'app-expedients-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './expedients-page.html',
  styleUrl: './expedients-page.css',
})
export class ExpedientsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ExpedientApiService);
  readonly view = (this.route.snapshot.data['expedientView'] ?? 'all') as ExpedientView;
  readonly search = signal('');
  readonly area = signal('');
  readonly selected = signal<ExpedientItem | null>(null);
  readonly step = signal(1);
  readonly saved = signal(false);
  readonly loading = signal(false);
  readonly apiError = signal('');
  readonly totalCount = signal(0);
  readonly form = signal<ExpedientForm>({ name: '', type: 'Administrativo', area: 'Compras', responsible: '', description: '' });
  readonly expedients = signal<ExpedientItem[]>([]);
  readonly activeCount = computed(() => this.expedients().filter((item) => item.status === 'Activo').length);
  readonly areas = ['General'];
  readonly types = ['Administrativo', 'Contractual', 'Calidad', 'Auditoría', 'Proyecto'];
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
    if (!this.isForm) this.loadExpedients();
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
  choose(item: ExpedientItem): void { this.selected.set(item); }
  closeDetail(): void { this.selected.set(null); }
  nextStep(): void { if (this.step() < 3) this.step.update((value) => value + 1); }
  previousStep(): void { if (this.step() > 1) this.step.update((value) => value - 1); }
  saveExpedient(): void { this.saved.set(true); }
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

  private toExpedient(expedient: ApiExpedient): ExpedientItem {
    return {
      id: expedient.id,
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
}
