import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule],
  template: `
    <nav class="pagination" [attr.aria-label]="label">
      <div class="pagination-summary">
        <span>{{ startResult }}–{{ endResult }} de <strong>{{ total }}</strong> resultados</span>
        <label>
          <span>Por página</span>
          <select [value]="pageSize" (change)="changePageSize($event)" [attr.aria-label]="'Resultados por página'">
            @for (size of pageSizes; track size) {
              <option [value]="size">{{ size }}</option>
            }
          </select>
        </label>
      </div>
      <div class="pagination-controls">
        <span class="page-status">Página {{ page }} de {{ totalPages }}</span>
        <button type="button" (click)="previousPage()" [disabled]="page <= 1" aria-label="Página anterior">‹</button>
        <button type="button" (click)="nextPage()" [disabled]="page >= totalPages" aria-label="Página siguiente">›</button>
      </div>
    </nav>
  `,
})
export class Pagination {
  @Input() total = 0;
  @Input() page = 1;
  @Input() pageSize = 10;
  @Input() label = 'Paginación de resultados';
  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();

  readonly pageSizes = [5, 10, 25, 50, 100];

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  get startResult(): number {
    return this.total === 0 ? 0 : (this.page - 1) * this.pageSize + 1;
  }

  get endResult(): number {
    return Math.min(this.total, this.page * this.pageSize);
  }

  previousPage(): void {
    if (this.page > 1) this.pageChange.emit(this.page - 1);
  }

  nextPage(): void {
    if (this.page < this.totalPages) this.pageChange.emit(this.page + 1);
  }

  changePageSize(event: Event): void {
    const size = Number((event.target as HTMLSelectElement).value);
    this.pageSizeChange.emit(size);
  }
}
