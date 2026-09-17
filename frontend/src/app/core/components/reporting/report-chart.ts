import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ChartPoint, ReportChartKind } from '../../data/report-data';

@Component({
  selector: 'app-report-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article class="report-chart panel">
      <div class="report-chart-heading"><div><h2>{{ title }}</h2><p>{{ subtitle }}</p></div><span class="chart-menu">•••</span></div>
      @if (points.length === 0) {
        <div class="chart-empty">Sin datos para los filtros seleccionados</div>
      } @else if (kind === 'donut') {
        <div class="donut-layout"><div class="donut" [style.background]="donutBackground"><strong>{{ total }}</strong><small>registros</small></div><div class="chart-legend">@for (point of points; track point.label) {<span><i [style.background]="point.color"></i><b>{{ point.label }}</b><em>{{ point.value }}</em></span>}</div></div>
      } @else if (kind === 'line') {
        <div class="line-chart"><svg viewBox="0 0 420 150" role="img" [attr.aria-label]="title"><polyline [attr.points]="linePoints" fill="none" stroke="#087f7b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />@for (point of points; track point.label; let i = $index) {<circle [attr.cx]="lineX(i)" [attr.cy]="lineY(point.value)" r="4" fill="#fff" stroke="#087f7b" stroke-width="2" />}</svg><div class="chart-labels">@for (point of points; track point.label) {<span>{{ point.label }}</span>}</div></div>
      } @else {
        <div class="bars-chart">@for (point of points; track point.label) {<div class="bar-row"><span>{{ point.label }}</span><div class="bar-track"><i [style.width.%]="barWidth(point.value)" [style.background]="point.color || '#0f9d9a'"></i></div><b>{{ point.value }}</b></div>}</div>
      }
    </article>
  `,
})
export class ReportChart {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() kind: ReportChartKind = 'bars';
  @Input() points: ChartPoint[] = [];

  get total(): number { return this.points.reduce((sum, point) => sum + point.value, 0); }
  get max(): number { return Math.max(...this.points.map((point) => point.value), 1); }
  get linePoints(): string { return this.points.map((point, index) => `${this.lineX(index)},${this.lineY(point.value)}`).join(' '); }
  get donutBackground(): string {
    const total = this.total || 1;
    let cursor = 0;
    const pieces = this.points.map((point) => {
      const start = cursor;
      cursor += (point.value / total) * 360;
      return `${point.color} ${start}deg ${cursor}deg`;
    });
    return `conic-gradient(${pieces.join(', ')})`;
  }
  barWidth(value: number): number { return Math.max(4, Math.round((value / this.max) * 100)); }
  lineX(index: number): number { return this.points.length <= 1 ? 210 : 18 + index * (384 / (this.points.length - 1)); }
  lineY(value: number): number { return 132 - (value / this.max) * 106; }
}
