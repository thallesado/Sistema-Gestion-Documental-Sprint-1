import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ReportApiService } from '../../../core/api/report-api.service';
import { parseVoiceQuery } from './voice-report-query';

type VoiceReportKind = 'documents' | 'expedients' | 'workflows';
type RecognitionLike = { lang: string; maxAlternatives: number; onresult: ((event: any) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start(): void; stop(): void };

@Component({
  selector: 'app-voice-report-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page voice-page">
      <header><small>REPORTES · CONSULTA POR VOZ</small><h1>Genera un reporte hablando</h1>
        <p>Dicta filtros simples. Solo los criterios reconocidos se envían al reporte del servidor.</p></header>
      <section class="panel composer">
        <label>Tipo de reporte<select [ngModel]="kind()" (ngModelChange)="kind.set($event)">
          <option value="documents">Documentos</option><option value="expedients">Expedientes</option><option value="workflows">Workflows</option>
        </select></label>
        <div class="voice-entry"><button type="button" class="primary" (click)="toggleVoice()" [disabled]="loading()">{{ listening() ? 'Detener escucha' : '🎙 Iniciar dictado' }}</button>
          <span>{{ listening() ? 'Escuchando…' : 'También puedes escribir una consulta' }}</span></div>
        <label class="query-label">Consulta<textarea rows="3" [ngModel]="query()" (ngModelChange)="query.set($event)" placeholder="Ej.: documentos aprobados en el área Administración entre 01/10/2026 y 31/10/2026"></textarea></label>
        <div class="actions"><button type="button" class="primary" (click)="run()" [disabled]="loading()">{{ loading() ? 'Consultando…' : 'Interpretar y consultar' }}</button><button type="button" (click)="clear()">Limpiar</button></div>
        <p class="privacy">Privacidad: el reconocimiento de voz depende del navegador y puede procesar audio externamente. No dictes nombres, identificadores ni información clínica. El texto reconocido no se conserva ni se envía al servidor; solo viajan filtros compatibles.</p>
        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        @if (criteria().length) { <div class="criteria"><strong>Filtros interpretados</strong><span>{{ criteria().join(' · ') }}</span></div> }
      </section>
      <section class="panel results" aria-live="polite"><div class="results-head"><div><h2>Resultados del reporte</h2><p>{{ total() }} registros</p></div></div>
        @if (loading()) { <p>Consultando los datos del tenant…</p> }
        @else if (!rows().length) { <p class="empty">Dicta o escribe filtros y ejecuta la consulta.</p> }
        @else { <div class="table-wrap"><table><thead><tr>@for (column of columns(); track column) { <th>{{ column }}</th> }</tr></thead>
          <tbody>@for (row of rows(); track $index) { <tr>@for (column of columns(); track column) { <td>{{ display(row[column]) }}</td> }</tr> }</tbody></table></div> }
      </section>
    </section>
  `,
  styles: [`
    .voice-page { display:grid; gap:18px; } header small { color:#07867f; font-weight:700; letter-spacing:.08em; } h1 { margin:6px 0; color:#082b2a; } header p,.results-head p { color:#617775; margin:0; }
    .panel { background:#fff; border:1px solid #dce9e7; border-radius:14px; padding:20px; box-shadow:0 4px 16px #0b33330b; }
    label { display:grid; gap:7px; color:#193c3a; font-size:13px; font-weight:650; max-width:540px; } select,textarea { border:1px solid #cbdedb; border-radius:8px; padding:10px; color:#183432; background:#fff; font:inherit; }
    .voice-entry,.actions { display:flex; flex-wrap:wrap; align-items:center; gap:12px; margin:16px 0; color:#54706d; font-size:13px; }
    button { border:1px solid #b9d4d0; background:white; color:#087f7b; border-radius:8px; padding:9px 14px; font-weight:650; cursor:pointer; } button.primary { background:#087f7b; color:white; border-color:#087f7b; } button:disabled { opacity:.5; cursor:default; }
    .privacy { background:#eef6ff; border:1px solid #cfe2fa; border-radius:8px; color:#28547d; padding:12px; line-height:1.5; font-size:13px; }
    .criteria { display:grid; gap:5px; color:#174a45; font-size:13px; } .error { color:#a32626; } h2 { color:#123936; font-size:17px; margin:0 0 7px; } .empty { padding:28px 4px; text-align:center; color:#6a8280; }
    .table-wrap { overflow:auto; margin-top:14px; } table { width:100%; border-collapse:collapse; font-size:13px; } th,td { padding:10px; border-bottom:1px solid #e4eeec; text-align:left; white-space:nowrap; } th { color:#42615e; background:#f4f9f8; }
  `],
})
export class VoiceReportPage {
  private readonly api = inject(ReportApiService);
  private recognition: RecognitionLike | null = null;
  readonly kind = signal<VoiceReportKind>('documents');
  readonly query = signal('');
  readonly listening = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly criteria = signal<string[]>([]);
  readonly rows = signal<Record<string, unknown>[]>([]);
  readonly columns = signal<string[]>([]);
  readonly total = signal(0);

  toggleVoice(): void { this.listening() ? this.recognition?.stop() : this.startVoice(); }
  clear(): void { this.query.set(''); this.criteria.set([]); this.rows.set([]); this.columns.set([]); this.total.set(0); this.error.set(''); }
  display(value: unknown): string { return value == null ? '—' : String(value); }

  private startVoice(): void {
    const browser = window as any;
    const Constructor = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Constructor) { this.error.set('Este navegador no permite dictado. Escribe la consulta en el campo.'); return; }
    const recognition: RecognitionLike = new Constructor();
    recognition.lang = 'es-BO'; recognition.maxAlternatives = 1;
    recognition.onresult = (event) => { this.query.set(String(event.results?.[0]?.[0]?.transcript ?? '')); };
    recognition.onerror = () => { this.error.set('No se pudo reconocer la voz. Revisa el permiso del micrófono o escribe la consulta.'); this.listening.set(false); };
    recognition.onend = () => this.listening.set(false);
    this.recognition = recognition; this.error.set(''); this.listening.set(true); recognition.start();
  }

  run(): void {
    const parsed = parseVoiceQuery(this.query());
    this.criteria.set(parsed.labels);
    if (!parsed.filters['dateFrom'] || !parsed.filters['dateTo'] || parsed.filters['dateFrom'] > parsed.filters['dateTo']) {
      this.error.set('Incluye un rango válido, por ejemplo “entre 01/10/2026 y 31/10/2026”.'); return;
    }
    this.error.set(''); this.loading.set(true);
    this.api.getReport(this.kind(), parsed.filters, 1, 50).subscribe({
      next: (response) => { this.rows.set(response.content ?? []); this.columns.set(response.content?.length ? Object.keys(response.content[0]) : []); this.total.set(response.totalElements ?? 0); this.loading.set(false); },
      error: () => { this.rows.set([]); this.total.set(0); this.error.set('No se pudo ejecutar el reporte. Revisa tus permisos y el rango de fechas.'); this.loading.set(false); },
    });
  }
}
