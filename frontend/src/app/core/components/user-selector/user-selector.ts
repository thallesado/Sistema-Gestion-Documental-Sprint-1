import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdministrationApiService, ApiUser } from '../../api/administration-api.service';

/** Selector tenant-aware. Never accepts a responsible person's name as a substitute for an id. */
@Component({
  selector: 'app-user-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `<label class="user-selector">{{ label }}<input [(ngModel)]="query" (ngModelChange)="search()" [placeholder]="placeholder" autocomplete="off" /><select [ngModel]="value" (ngModelChange)="select($event)" [disabled]="loading || !!error"><option value="">Sin responsable asignado</option>@for (user of users; track user.id) {<option [value]="user.id">{{ user.firstName }} {{ user.lastName }} · {{ user.username }}</option>}</select>@if (loading) {<small>Consultando usuarios del tenant…</small>} @if (error) {<small class="error">{{ error }}</small>}</label>`,
  styles: [`.user-selector{display:grid;gap:7px;font-size:12px;font-weight:700}.user-selector input,.user-selector select{border:1px solid #dcebe8;border-radius:8px;padding:9px}.user-selector small{font-size:11px;color:#6b8583}.user-selector .error{color:#a65050}`],
})
export class UserSelectorComponent implements OnInit {
  private readonly api = inject(AdministrationApiService);
  @Input() label = 'Responsable';
  @Input() placeholder = 'Buscar usuario del tenant…';
  @Input() value = '';
  @Output() valueChange = new EventEmitter<string>();
  users: ApiUser[] = [];
  query = '';
  loading = false;
  error = '';
  ngOnInit(): void { this.search(); }
  search(): void {
    this.loading = true; this.error = '';
    this.api.responsibleUsers(this.query, 0, 100).subscribe({
      next: response => { this.users = response.content; this.loading = false; },
      error: () => { this.users = []; this.loading = false; this.error = 'El backend no permite consultar usuarios del tenant.'; },
    });
  }
  select(value: string): void { this.value = value; this.valueChange.emit(value); }
}
