import { HttpClient, HttpParams } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface TechnicalLogEvent {
  id: number; occurredAt: string; level: 'WARN' | 'ERROR'; tenantId: string | null; actorId: string | null;
  category: string; summary: string; requestMethod: string | null; requestPath: string | null;
  httpStatus: number | null; exceptionType: string | null;
}
interface TechnicalLogPage { content: TechnicalLogEvent[]; totalElements: number; totalPages: number; number: number; }

@Component({
  selector: 'app-platform-technical-logs-page', standalone: true, imports: [CommonModule, FormsModule],
  template: `
    <section class="page logs-page">
      <header><small>ADMINISTRACIÓN GLOBAL</small><h1>Logs técnicos</h1>
        <p>Errores y advertencias HTTP para diagnóstico. No se guardan cuerpos de solicitudes, parámetros de URL ni mensajes de excepción.</p></header>
      <form class="filters" (ngSubmit)="search()">
        <label>Nivel<select name="level" [(ngModel)]="level"><option value="">Todos</option><option value="ERROR">Error</option><option value="WARN">Advertencia</option></select></label>
        <label>ID de organización<input name="tenantId" [(ngModel)]="tenantId" placeholder="UUID (opcional)" /></label>
        <button class="primary" type="submit" [disabled]="loading()">Buscar</button>
      </form>
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
      <section class="panel" aria-live="polite">
        @if (loading()) { <p>Cargando logs…</p> }
        @else if (page(); as result) {
          <p>{{ result.totalElements }} evento(s)</p>
          <div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Nivel</th><th>Organización</th><th>Actor</th><th>Categoría / detalle</th><th>Solicitud</th></tr></thead><tbody>
            @for (event of result.content; track event.id) { <tr><td>{{ event.occurredAt | date:'medium' }}</td><td><b [class.badge-error]="event.level === 'ERROR'">{{ event.level }}</b></td>
              <td>{{ event.tenantId || 'Plataforma' }}</td><td>{{ event.actorId || 'Sistema o anónimo' }}</td>
              <td>{{ event.category }}<small>{{ event.summary }}{{ event.exceptionType ? ' · ' + event.exceptionType : '' }}</small></td>
              <td>{{ event.requestMethod }} {{ event.requestPath }}{{ event.httpStatus ? ' · ' + event.httpStatus : '' }}</td></tr>
            } @empty { <tr><td colspan="6" class="empty">No hay eventos con estos filtros.</td></tr> }
          </tbody></table></div>
          <nav><button type="button" (click)="load(result.number - 1)" [disabled]="result.number <= 0">Anterior</button><span>Página {{ result.number + 1 }} de {{ result.totalPages || 1 }}</span><button type="button" (click)="load(result.number + 1)" [disabled]="result.number + 1 >= result.totalPages">Siguiente</button></nav>
        }
      </section>
    </section>`,
  styles: [`
    .logs-page{display:grid;gap:14px}header{padding:20px 24px;border-radius:15px;color:#e6fbf3;background:linear-gradient(120deg,#0b2420,#0f766e)}header small{color:#62e3c4;font-weight:800;letter-spacing:.12em}h1{margin:6px 0;color:white}header p{margin:0;color:#c3e3dc;font-size:14px}.filters,.panel{display:flex;flex-wrap:wrap;align-items:end;gap:12px;background:white;border:1px solid #dcebe8;border-radius:14px;padding:16px}.panel{display:block}.filters label{display:grid;gap:5px;font-size:12px;font-weight:700;color:#42615e}.filters input,.filters select{min-width:230px;border:1px solid #cfdfe4;border-radius:8px;padding:9px;background:white;font:inherit}.filters button,nav button{border:1px solid #cce1e2;border-radius:8px;padding:9px 14px;background:#fff;cursor:pointer}.filters .primary{color:white;background:#087f7b;border-color:#087f7b}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:10px;border-bottom:1px solid #e4eeec;vertical-align:top}th{background:#f4f9f8;color:#42615e}td small{display:block;color:#617775;margin-top:4px;max-width:460px;overflow-wrap:anywhere}.badge-error{color:#a32626}.error{color:#a32626}nav{display:flex;justify-content:flex-end;align-items:center;gap:12px;margin-top:14px}.empty{text-align:center;color:#617775;padding:22px}
  `],
})
export class PlatformTechnicalLogsPage {
  private readonly http = inject(HttpClient);
  readonly page = signal<TechnicalLogPage | null>(null); readonly loading = signal(false); readonly error = signal('');
  level = ''; tenantId = '';
  constructor() { this.load(0); }
  search(): void { this.load(0); }
  load(index: number): void {
    if (this.tenantId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(this.tenantId.trim())) { this.error.set('El ID de organización no tiene formato UUID.'); return; }
    let params = new HttpParams().set('page', Math.max(0, index)).set('size', 25);
    if (this.level) params = params.set('level', this.level);
    if (this.tenantId.trim()) params = params.set('tenantId', this.tenantId.trim());
    this.loading.set(true); this.error.set('');
    this.http.get<TechnicalLogPage>('/api/v1/platform/technical-logs', { params }).subscribe({
      next: (result) => { this.page.set(result); this.loading.set(false); },
      error: () => { this.error.set('No se pudieron cargar los logs técnicos. Verifica tu permiso de plataforma e inténtalo de nuevo.'); this.loading.set(false); },
    });
  }
}
