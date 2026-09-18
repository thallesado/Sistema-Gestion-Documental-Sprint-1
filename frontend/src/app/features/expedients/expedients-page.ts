import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { expedients, DemoItem } from '../../core/data/nexodocs-data';

type ExpedientView = 'all' | 'active' | 'closed' | 'archived' | 'new';
type ExpedientForm = { name: string; type: string; area: string; responsible: string; description: string };

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
  readonly view = (this.route.snapshot.data['expedientView'] ?? 'all') as ExpedientView;
  readonly search = signal('');
  readonly area = signal('');
  readonly selected = signal<DemoItem | null>(null);
  readonly step = signal(1);
  readonly saved = signal(false);
  readonly form = signal<ExpedientForm>({ name: '', type: 'Administrativo', area: 'Compras', responsible: '', description: '' });
  readonly expedients = expedients;
  readonly activeCount = expedients.filter((item) => item.status === 'Activo').length;
  readonly areas = ['Compras', 'Legal', 'Calidad', 'Operaciones'];
  readonly types = ['Administrativo', 'Contractual', 'Calidad', 'Auditoría', 'Proyecto'];

  readonly items = computed(() => {
    const query = this.search().trim().toLowerCase();
    const selectedArea = this.area();
    const status = this.view === 'active' ? 'Activo' : this.view === 'closed' ? 'Cerrado' : this.view === 'archived' ? 'Archivado' : '';
    return expedients.filter((item) => {
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
  get countLabel(): string { return `${this.items().length} expedientes`; }

  updateField(field: keyof ExpedientForm, event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
    this.form.update((current) => ({ ...current, [field]: value }));
  }
  setSearch(event: Event): void { this.search.set((event.target as HTMLInputElement).value); }
  setArea(event: Event): void { this.area.set((event.target as HTMLSelectElement).value); }
  choose(item: DemoItem): void { this.selected.set(item); }
  closeDetail(): void { this.selected.set(null); }
  nextStep(): void { if (this.step() < 3) this.step.update((value) => value + 1); }
  previousStep(): void { if (this.step() > 1) this.step.update((value) => value - 1); }
  saveExpedient(): void { this.saved.set(true); }
  clearFilters(): void { this.search.set(''); this.area.set(''); }
  statusClass(status: string): string {
    return status === 'Activo' ? 'status active' : status === 'Cerrado' ? 'status closed' : 'status archived';
  }
  icon(item: DemoItem): string { return item.area === 'Legal' ? '§' : item.area === 'Calidad' ? '✓' : item.area === 'Operaciones' ? '⌂' : '▤'; }
  goTo(path: string): void { void this.router.navigateByUrl(path); }
}
