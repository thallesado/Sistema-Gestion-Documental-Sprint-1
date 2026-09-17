import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Pagination } from '../../../core/components/pagination/pagination';

@Component({
  selector: 'app-audit-pagination',
  standalone: true,
  imports: [Pagination],
  template: `<app-pagination [total]="total" [page]="page" [pageSize]="pageSize" label="Paginación de auditoría" (pageChange)="pageChange.emit($event)" (pageSizeChange)="pageSizeChange.emit($event)" />`,
})
export class AuditPagination {
  @Input() total = 0;
  @Input() page = 1;
  @Input() pageSize = 10;
  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();
}
