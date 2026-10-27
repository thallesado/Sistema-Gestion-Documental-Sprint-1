import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PlatformDashboard, PlatformTenantRow, ReportApiService } from '../../../core/api/report-api.service';
import { ChartPoint, CHART_COLORS } from '../../../core/data/report-data';
import { KpiCard, ReportChart } from '../../reportes/components';

const STATUS_LABELS: Record<string, string> = {
  TRIAL: 'En prueba', ACTIVE: 'Activo', PAST_DUE: 'Pago pendiente', EXPIRED: 'Vencido',
  SUSPENDED: 'Suspendido', CANCELED: 'Cancelado', COMPLETED: 'Completado', PENDING: 'Pendiente', FAILED: 'Fallido',
};
const METHOD_LABELS: Record<string, string> = { STRIPE_CARD: 'Tarjeta (Stripe)', BANK_QR: 'QR bancario', CRYPTO_USDT: 'USDT' };

/** Dashboard del administrador de la plataforma SaaS: tenants, ingresos, costos y pagos. */
@Component({
  selector: 'app-platform-dashboard-page',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, KpiCard, ReportChart],
  template: `
    <section class="page platform-dashboard">
      <header class="pd-header">
        <div>
          <span class="pd-kicker">ADMINISTRACIÓN GLOBAL</span>
          <h1>Panel de plataforma</h1>
          <p>Tenants, suscripciones, ingresos y costos de toda la plataforma NexoDocs.</p>
        </div>
        <div class="pd-actions">
          <a routerLink="/platform/reports/tenants" class="pd-btn">Reporte de tenants</a>
          <a routerLink="/platform/reports/payments" class="pd-btn">Reporte de pagos</a>
          <a routerLink="/tenants/new" class="pd-btn primary">+ Crear tenant</a>
          <button type="button" class="pd-btn icon" (click)="load()" [disabled]="loading()" aria-label="Actualizar">↻</button>
        </div>
      </header>

      @if (error()) {
        <div class="pd-error" role="alert">⚠ {{ error() }} <button type="button" (click)="load()">Reintentar</button></div>
      }

      @if (loading() && !data()) {
        <div class="pd-loading"><span class="spinner"></span> Cargando indicadores de la plataforma…</div>
      }

      @if (data(); as d) {
        <!-- Finanzas -->
        <h2 class="pd-section-title">Finanzas</h2>
        <section class="report-kpis pd-kpis">
          <app-kpi-card icon="$" label="MRR" [value]="usd(d.kpis.mrrUsd)" [detail]="'ARR ' + usd(d.kpis.arrUsd)" tone="teal" />
          <app-kpi-card icon="↗" label="Ingresos 30 días" [value]="usd(d.kpis.revenue30dUsd)" [detail]="trendText()" [tone]="trend() >= 0 ? 'green' : 'rose'" />
          <app-kpi-card icon="−" label="Costos estimados 30 días" [value]="usd(d.kpis.fees30dUsd)" detail="Comisiones de procesamiento" tone="rose" />
          <app-kpi-card icon="=" label="Neto 30 días" [value]="usd(d.kpis.net30dUsd)" [detail]="'Histórico ' + usd(d.kpis.netTotalUsd)" tone="blue" />
        </section>

        <!-- Tenants -->
        <h2 class="pd-section-title">Tenants</h2>
        <section class="pd-tenant-strip">
          <article><small>Total</small><strong>{{ d.kpis.totalTenants }}</strong><span>+{{ d.kpis.newTenants30d }} en 30 días</span></article>
          <article class="ok"><small>Activos</small><strong>{{ d.kpis.activeTenants }}</strong><span>{{ d.kpis.stripeSubscriptions }} con Stripe</span></article>
          <article class="trial"><small>En prueba</small><strong>{{ d.kpis.trialTenants }}</strong><span>Demo de 12 días</span></article>
          <article class="warn"><small>Pago pendiente</small><strong>{{ d.kpis.pastDueTenants }}</strong><span>Stripe reintentando</span></article>
          <article class="bad"><small>Vencidos o cancelados</small><strong>{{ d.kpis.churnedTenants }}</strong><span>{{ d.kpis.suspendedTenants }} suspendidos</span></article>
          <article><small>Ingreso medio por cliente</small><strong>{{ usd(d.kpis.arpaUsd) }}</strong><span>{{ d.kpis.payingTenants }} han pagado</span></article>
        </section>

        @if (d.kpis.failedPayments30d || d.kpis.pendingSignups || d.kpis.failedSignups || d.kpis.pastDueTenants) {
          <section class="pd-alerts" aria-label="Alertas">
            @if (d.kpis.pastDueTenants) { <a routerLink="/platform/reports/tenants">⚠ {{ d.kpis.pastDueTenants }} tenant(s) con pago pendiente</a> }
            @if (d.kpis.failedPayments30d) { <a routerLink="/platform/reports/payments">✕ {{ d.kpis.failedPayments30d }} pago(s) fallido(s) en 30 días</a> }
            @if (d.kpis.pendingSignups) { <span>◷ {{ d.kpis.pendingSignups }} alta(s) esperando pago</span> }
            @if (d.kpis.failedSignups) { <span>✕ {{ d.kpis.failedSignups }} alta(s) pagada(s) sin aprovisionar</span> }
          </section>
        }

        <!-- Ingresos vs costos -->
        <section class="pd-panel">
          <header>
            <div><h3>Ingresos y costos por mes</h3><p>Últimos 12 meses · USD</p></div>
            <ul class="pd-legend"><li class="rev">Ingresos</li><li class="fee">Costos estimados</li></ul>
          </header>
          <div class="pd-bars" role="img" [attr.aria-label]="'Ingresos y costos de los últimos 12 meses'">
            @for (m of d.monthly; track m.month) {
              <div class="pd-bar-col" [title]="m.month + ': ingresos ' + usd(m.revenue) + ', costos ' + usd(m.fees)">
                <div class="pd-bar-pair">
                  <span class="rev" [style.height.%]="barHeight(m.revenue)"></span>
                  <span class="fee" [style.height.%]="barHeight(m.fees)"></span>
                </div>
                <small>{{ monthLabel(m.month) }}</small>
              </div>
            }
          </div>
        </section>

        <section class="report-charts">
          <app-report-chart title="Tenants por estado" subtitle="Estado de la suscripción" kind="donut" [points]="statusPoints()" />
          <app-report-chart title="Ingresos por plan" subtitle="Cobros completados · USD" kind="donut" [points]="series(d.revenueByPlan)" />
          <app-report-chart title="Nuevos tenants por mes" subtitle="Últimos 12 meses" kind="line" [points]="newTenantPoints()" />
          <app-report-chart title="Ingresos por método" subtitle="Canales de cobro · USD" kind="bars" [points]="methodPoints()" />
          <app-report-chart title="Tenants por plan" subtitle="Distribución actual" kind="bars" [points]="series(d.tenantsByPlan)" />
          <article class="pd-panel pd-fees">
            <h3>Tasas de costo usadas</h3>
            <p>Estimación de comisiones (configurable en el servidor).</p>
            <ul>
              <li><span>Tarjeta (Stripe)</span><b>{{ d.feeRates.stripeCardPercent }}% + {{ usd(d.feeRates.stripeCardFixed) }}</b></li>
              <li><span>QR bancario</span><b>{{ d.feeRates.bankQrPercent }}%</b></li>
              <li><span>USDT</span><b>{{ d.feeRates.cryptoUsdtPercent }}%</b></li>
            </ul>
            <p class="pd-total">Costos históricos: <b>{{ usd(d.kpis.feesTotalUsd) }}</b> de {{ usd(d.kpis.revenueTotalUsd) }} cobrados.</p>
          </article>
        </section>

        <!-- Tabla de tenants -->
        <section class="pd-panel">
          <header>
            <div><h3>Tenants</h3><p>{{ filteredTenants().length }} de {{ d.tenants.length }} organizaciones</p></div>
            <div class="pd-filters">
              <input type="search" placeholder="Buscar organización o código…" [(ngModel)]="search" aria-label="Buscar tenant">
              <select [(ngModel)]="statusFilter" aria-label="Filtrar por estado">
                <option value="">Todos los estados</option>
                @for (status of statusOptions; track status) { <option [value]="status">{{ statusLabel(status) }}</option> }
              </select>
            </div>
          </header>
          <div class="pd-table-wrap">
            <table>
              <thead><tr>
                <th>Organización</th><th>Plan</th><th>Estado</th><th class="num">Usuarios</th><th class="num">Documentos</th>
                <th class="num">MRR</th><th class="num">Pagado</th><th>Renovación</th><th>Alta</th>
              </tr></thead>
              <tbody>
                @for (t of filteredTenants(); track t.id) {
                  <tr>
                    <td><b>{{ t.tenant }}</b><small>{{ t.code }}{{ t.stripeManaged ? ' · Stripe' : '' }}</small></td>
                    <td>{{ t.plan }}<small>{{ t.cycle === 'ANNUAL' ? 'Anual' : 'Mensual' }}</small></td>
                    <td><span class="pd-badge" [class]="'pd-badge s-' + t.status">{{ statusLabel(t.status) }}</span></td>
                    <td class="num">{{ t.users }}</td>
                    <td class="num">{{ t.documents }}</td>
                    <td class="num">{{ usd(t.mrr) }}</td>
                    <td class="num">{{ usd(t.totalPaid) }}</td>
                    <td>{{ (t.status === 'TRIAL' ? t.trialEndsAt : t.periodEnd) ? ((t.status === 'TRIAL' ? t.trialEndsAt : t.periodEnd) | date: 'dd/MM/yyyy') : '—' }}</td>
                    <td>{{ t.createdAt | date: 'dd/MM/yyyy' }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="9" class="pd-empty">No hay tenants que coincidan con el filtro.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </section>

        <!-- Pagos recientes -->
        <section class="pd-panel">
          <header>
            <div><h3>Pagos recientes</h3><p>Últimos cobros registrados en la plataforma</p></div>
            <a routerLink="/platform/reports/payments" class="pd-link">Ver reporte completo →</a>
          </header>
          <div class="pd-table-wrap">
            <table>
              <thead><tr>
                <th>Fecha</th><th>Organización</th><th>Plan</th><th>Método</th><th>Estado</th>
                <th class="num">Monto</th><th class="num">Costo est.</th><th class="num">Neto</th>
              </tr></thead>
              <tbody>
                @for (p of d.recentPayments; track p.id) {
                  <tr>
                    <td>{{ p.createdAt | date: 'dd/MM/yyyy HH:mm' }}</td>
                    <td><b>{{ p.tenant }}</b></td>
                    <td>{{ p.plan }}</td>
                    <td>{{ methodLabel(p.method) }}</td>
                    <td><span class="pd-badge" [class]="'pd-badge s-' + p.status">{{ statusLabel(p.status) }}</span></td>
                    <td class="num">{{ usd(p.amount) }}</td>
                    <td class="num fee">{{ usd(p.fee) }}</td>
                    <td class="num"><b>{{ usd(p.net) }}</b></td>
                  </tr>
                } @empty {
                  <tr><td colspan="8" class="pd-empty">Todavía no hay pagos registrados.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }
    </section>
  `,
  styles: [`
    .platform-dashboard { display: grid; gap: 4px; }
    .pd-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; padding: 22px 24px; margin-bottom: 14px; border-radius: 16px; color: #e6fbf3; background: linear-gradient(120deg, #0b2420, #0f4a43 60%, #0f766e); }
    .pd-kicker { color: #62e3c4; font-size: 11px; font-weight: 800; letter-spacing: .14em; }
    .pd-header h1 { margin: 6px 0 4px; font-size: 26px; color: #fff; }
    .pd-header p { margin: 0; color: #b6d7ce; font-size: 14px; }
    .pd-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .pd-btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px; border-radius: 10px; font-size: 13px; font-weight: 700; text-decoration: none; color: #e6fbf3; background: rgba(255, 255, 255, .1); border: 1px solid rgba(255, 255, 255, .2); cursor: pointer; }
    .pd-btn:hover { background: rgba(255, 255, 255, .18); }
    .pd-btn.primary { background: #62e3c4; color: #0b2420; border-color: #62e3c4; }
    .pd-btn.icon { font-size: 16px; padding: 7px 12px; }
    .pd-btn:disabled { opacity: .5; }
    .pd-section-title { margin: 8px 0 10px; font-size: 13px; letter-spacing: .1em; text-transform: uppercase; color: #6b8583; }
    .pd-error { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 10px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
    .pd-error button { margin-left: auto; border: 0; background: #991b1b; color: #fff; border-radius: 8px; padding: 6px 12px; cursor: pointer; }
    .pd-loading { display: flex; align-items: center; gap: 10px; padding: 40px; justify-content: center; color: #087f7b; }
    .spinner { width: 20px; height: 20px; border: 3px solid #dcebe8; border-top-color: #087f7b; border-radius: 50%; animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .pd-tenant-strip { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; }
    .pd-tenant-strip article { background: #fff; border: 1px solid #dcebe8; border-left: 4px solid #8aa19f; border-radius: 12px; padding: 12px 14px; display: grid; gap: 2px; }
    .pd-tenant-strip article.ok { border-left-color: #10b981; }
    .pd-tenant-strip article.trial { border-left-color: #e3a633; }
    .pd-tenant-strip article.warn { border-left-color: #f97316; }
    .pd-tenant-strip article.bad { border-left-color: #d76a6a; }
    .pd-tenant-strip small { color: #6b8583; font-size: 12px; }
    .pd-tenant-strip strong { font-size: 22px; color: #153a39; }
    .pd-tenant-strip span { font-size: 12px; color: #6b8583; }

    .pd-alerts { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
    .pd-alerts a, .pd-alerts span { padding: 8px 12px; border-radius: 999px; background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412; font-size: 13px; font-weight: 600; text-decoration: none; }

    .pd-panel { background: #fff; border: 1px solid #dcebe8; border-radius: 14px; padding: 18px 20px; margin-bottom: 14px; }
    .pd-panel > header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
    .pd-panel h3 { margin: 0; font-size: 16px; color: #153a39; }
    .pd-panel header p { margin: 2px 0 0; font-size: 12px; color: #6b8583; }
    .pd-legend { list-style: none; display: flex; gap: 14px; margin: 0; padding: 0; font-size: 12px; color: #6b8583; }
    .pd-legend li::before { content: ''; display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 6px; vertical-align: -1px; }
    .pd-legend .rev::before { background: #087f7b; } .pd-legend .fee::before { background: #d76a6a; }
    .pd-bars { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 8px; align-items: end; height: 200px; padding-top: 8px; border-bottom: 1px solid #dcebe8; }
    .pd-bar-col { display: grid; grid-template-rows: 1fr auto; height: 100%; gap: 6px; }
    .pd-bar-pair { display: flex; align-items: flex-end; justify-content: center; gap: 3px; height: 100%; }
    .pd-bar-pair span { width: 40%; max-width: 18px; min-height: 2px; border-radius: 4px 4px 0 0; transition: height .6s cubic-bezier(.2,.7,.2,1); }
    .pd-bar-pair .rev { background: linear-gradient(#10b981, #087f7b); }
    .pd-bar-pair .fee { background: #d76a6a; }
    .pd-bar-col small { text-align: center; font-size: 11px; color: #6b8583; padding-bottom: 4px; }

    .report-charts { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .pd-fees { margin: 0; }
    .pd-fees ul { list-style: none; padding: 0; margin: 12px 0; display: grid; gap: 8px; }
    .pd-fees li { display: flex; justify-content: space-between; font-size: 13px; color: #415e5a; padding-bottom: 8px; border-bottom: 1px dashed #dcebe8; }
    .pd-fees p { font-size: 12px; color: #6b8583; margin: 2px 0 0; }
    .pd-fees .pd-total { font-size: 13px; color: #153a39; }

    .pd-filters { display: flex; gap: 8px; flex-wrap: wrap; }
    .pd-filters input, .pd-filters select { border: 1px solid #cfdfe4; border-radius: 8px; padding: 8px 10px; font-size: 13px; background: #fff; color: #153a39; min-width: 0; }
    .pd-filters input { width: 240px; max-width: 100%; }
    .pd-table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #51717d; background: #f2f7f8; padding: 10px 12px; white-space: nowrap; }
    td { padding: 10px 12px; border-bottom: 1px solid #eef3f2; color: #153a39; vertical-align: top; }
    td small { display: block; color: #6b8583; font-size: 11px; margin-top: 2px; }
    .num { text-align: right; white-space: nowrap; }
    td.fee { color: #b45454; }
    tbody tr:hover { background: #f7fbfa; }
    .pd-empty { text-align: center; color: #6b8583; padding: 28px; }
    .pd-badge { display: inline-block; padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 700; background: #edf2f5; color: #5a6d79; white-space: nowrap; }
    .pd-badge.s-ACTIVE, .pd-badge.s-COMPLETED { background: #def8ef; color: #047857; }
    .pd-badge.s-TRIAL, .pd-badge.s-PENDING { background: #fff7df; color: #986200; }
    .pd-badge.s-PAST_DUE { background: #ffedd5; color: #c2410c; }
    .pd-badge.s-EXPIRED, .pd-badge.s-CANCELED, .pd-badge.s-FAILED { background: #fde8e8; color: #b42318; }
    .pd-badge.s-SUSPENDED { background: #ece9f9; color: #5b45a6; }
    .pd-link { color: #087f7b; font-weight: 700; font-size: 13px; text-decoration: none; }

    @media (max-width: 1200px) { .pd-tenant-strip { grid-template-columns: repeat(3, minmax(0, 1fr)); } .report-charts { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 720px) {
      .pd-tenant-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .report-charts { grid-template-columns: 1fr; }
      .pd-bars { gap: 3px; } .pd-bar-col small { font-size: 9px; }
      .pd-filters input { width: 100%; }
    }
  `],
})
export class PlatformDashboardPage implements OnInit {
  private readonly api = inject(ReportApiService);

  readonly data = signal<PlatformDashboard | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly statusOptions = ['ACTIVE', 'TRIAL', 'PAST_DUE', 'EXPIRED', 'SUSPENDED', 'CANCELED'];
  private readonly searchTerm = signal('');
  private readonly status = signal('');

  get search(): string { return this.searchTerm(); }
  set search(value: string) { this.searchTerm.set(value); }
  get statusFilter(): string { return this.status(); }
  set statusFilter(value: string) { this.status.set(value); }

  readonly filteredTenants = computed<PlatformTenantRow[]>(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const status = this.status();
    return (this.data()?.tenants ?? []).filter((t) =>
      (!status || t.status === status)
      && (!term || t.tenant.toLowerCase().includes(term) || t.code.toLowerCase().includes(term)));
  });

  private readonly maxMonthly = computed(() =>
    Math.max(1, ...(this.data()?.monthly ?? []).map((m) => Number(m.revenue) || 0)));

  /** Variación de ingresos 30 días frente a los 30 días anteriores, en %. */
  readonly trend = computed(() => {
    const k = this.data()?.kpis;
    if (!k || !Number(k.revenuePrev30dUsd)) return 0;
    return ((Number(k.revenue30dUsd) - Number(k.revenuePrev30dUsd)) / Number(k.revenuePrev30dUsd)) * 100;
  });

  readonly statusPoints = computed<ChartPoint[]>(() => (this.data()?.tenantsByStatus ?? []).map((p, i) => ({
    label: this.statusLabel(p.label), value: Number(p.value), color: CHART_COLORS[i % CHART_COLORS.length],
  })));

  readonly methodPoints = computed<ChartPoint[]>(() => (this.data()?.revenueByMethod ?? []).map((p, i) => ({
    label: this.methodLabel(p.label), value: Number(p.value), color: CHART_COLORS[i % CHART_COLORS.length],
  })));

  readonly newTenantPoints = computed<ChartPoint[]>(() => (this.data()?.monthly ?? []).map((m) => ({
    label: this.monthLabel(m.month), value: Number(m.newTenants), color: '#087f7b',
  })));

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.getPlatformDashboard().subscribe({
      next: (dashboard) => { this.data.set(dashboard); this.loading.set(false); },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message ?? 'No se pudieron cargar los indicadores de la plataforma.');
      },
    });
  }

  series(points: { label: string; value: number }[]): ChartPoint[] {
    return points.map((p, i) => ({ label: p.label, value: Number(p.value), color: CHART_COLORS[i % CHART_COLORS.length] }));
  }

  trendText(): string {
    const value = this.trend();
    if (!Number(this.data()?.kpis.revenuePrev30dUsd)) return 'Sin datos del período anterior';
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}% vs 30 días previos`;
  }

  barHeight(value: number): number {
    return Math.max(0, Math.min(100, (Number(value) / this.maxMonthly()) * 100));
  }

  usd(value: number | string | null | undefined): string {
    const amount = Number(value) || 0;
    return 'USD ' + amount.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  monthLabel(month: string): string {
    const [year, m] = month.split('-').map(Number);
    return new Date(year, m - 1, 1).toLocaleDateString('es-BO', { month: 'short' }).replace('.', '');
  }

  statusLabel(status: string): string { return STATUS_LABELS[status] ?? status; }

  methodLabel(method: string): string { return METHOD_LABELS[method] ?? method; }
}
