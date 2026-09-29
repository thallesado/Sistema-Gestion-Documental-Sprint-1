import { Component, computed, EventEmitter, inject, Input, OnInit, Output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdministrationApiService, ApiPermission, ApiRole } from '../../../core/api/administration-api.service';

@Component({
  selector: 'app-role-form-modal',
  imports: [ReactiveFormsModule],
  template: `
    <div class="modal-backdrop" role="presentation">
      <form class="admin-modal permissions-modal" [formGroup]="form" (ngSubmit)="save()" role="dialog" aria-modal="true" aria-labelledby="role-form-title" novalidate>
        <h2 id="role-form-title">{{ role ? 'Editar rol' : 'Nuevo rol' }}</h2>
        <p class="form-note">{{ role ? 'Actualiza el nombre, la descripción y los permisos del rol.' : 'Define el nombre del rol y los permisos que concede a sus usuarios.' }}</p>
        @if (error()) { <div class="admin-state error" role="alert">{{ error() }}</div> }
        <div class="form-grid">
          <label>Nombre<input formControlName="name" maxlength="80" />
            @if (form.controls.name.touched && form.controls.name.invalid) { <small class="field-error">Ingresa el nombre del rol.</small> }
          </label>
          <label>Descripción<input formControlName="description" maxlength="255" /></label>
        </div>
        <p class="form-note">Permisos <b>({{ selected().size }} seleccionados)</b></p>
        @if (loading()) { <p class="admin-empty">Cargando permisos…</p> }
        <div class="permission-modules">
          @for (group of groups(); track group.module) {
            <section class="permission-group">
              <h3>{{ group.module }}</h3>
              <ul>
                @for (p of group.items; track p.id) {
                  <li class="permission-row">
                    <label class="switch-label">
                      <input type="checkbox" [checked]="selected().has(p.id)" (change)="toggle(p.id)" />
                      <span>{{ p.code }}</span>
                    </label>
                    <span class="criticality-pill" [class]="p.criticality.toLowerCase()">{{ p.criticality }}</span>
                  </li>
                }
              </ul>
            </section>
          }
        </div>
        <div class="form-actions">
          <button class="admin-secondary" type="button" (click)="closed.emit()">Cancelar</button>
          <button class="admin-primary" type="submit" [disabled]="saving() || loading()">{{ saving() ? 'Guardando…' : role ? 'Guardar cambios' : 'Crear rol' }}</button>
        </div>
      </form>
    </div>
  `,
})
export class RoleFormModal implements OnInit {
  private readonly api = inject(AdministrationApiService);
  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly saved = new EventEmitter<void>();
  /** Si viene informado, el formulario edita ese rol; si no, crea uno nuevo. */
  @Input() role: ApiRole | null = null;
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/\S/)] }),
    description: new FormControl('', { nonNullable: true }),
  });
  readonly permissions = signal<ApiPermission[]>([]);
  readonly selected = signal<Set<number>>(new Set());
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly groups = computed(() => {
    const byModule = new Map<string, ApiPermission[]>();
    this.permissions().forEach((p) => byModule.set(p.module, [...(byModule.get(p.module) ?? []), p]));
    return [...byModule].map(([module, items]) => ({ module, items }));
  });

  constructor() {
    this.api.permissions().subscribe({
      next: (list) => { this.permissions.set(list); this.loading.set(false); },
      error: () => { this.loading.set(false); this.error.set('No se pudo cargar el catálogo de permisos.'); },
    });
  }

  ngOnInit(): void {
    if (!this.role) return;
    this.form.patchValue({ name: this.role.name, description: this.role.description ?? '' });
    this.api.rolePermissions(this.role.id).subscribe({
      next: (r) => this.selected.set(new Set(r.modules.flatMap((g) => g.permissions).filter((p) => p.granted).map((p) => p.id))),
      error: () => this.error.set('No se pudieron cargar los permisos del rol.'),
    });
  }

  toggle(id: number): void {
    const next = new Set(this.selected());
    if (next.has(id)) next.delete(id); else next.add(id);
    this.selected.set(next);
  }

  /** Motivo real del fallo: 403 con texto fijo; 400/409 con el mensaje del servidor (`message`, o `details`). */
  private errorMessage(err: HttpErrorResponse): string {
    if (err.status === 403) return 'No tienes los permisos necesarios para realizar esta acción.';
    if (err.status === 0) return 'No se pudo conectar con el servidor. Inténtalo de nuevo.';
    const body = err.error;
    const serverMessage = typeof body === 'string' ? body : body?.message ?? body?.details;
    return serverMessage || 'No se pudo guardar el rol.';
  }

  save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    if (!this.selected().size) { this.error.set('Selecciona al menos un permiso.'); return; }
    const { name, description } = this.form.getRawValue();
    this.saving.set(true);
    this.error.set('');
    const payload = { name: name.trim(), description: description.trim(), permissionIds: [...this.selected()] };
    (this.role ? this.api.updateRole(this.role.id, payload) : this.api.createRole(payload)).subscribe({
      next: () => { this.saving.set(false); this.saved.emit(); this.closed.emit(); },
      error: (err: HttpErrorResponse) => { this.saving.set(false); this.error.set(this.errorMessage(err)); },
    });
  }
}
