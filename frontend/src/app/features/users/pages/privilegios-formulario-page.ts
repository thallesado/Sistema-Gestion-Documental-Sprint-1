import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdministrationApiService, ApiRole } from '../../../core/api/administration-api.service';
import { ComponentPermissionService } from '../../../core/auth/component-permission.service';
import { COMPONENT_STATES, ComponentState, DEFAULT_COMPONENT_STATE, FORM_REGISTRY } from '../../../core/auth/form-registry';
import { LocalizedContentDirective } from '../../../core/i18n/localized-content.directive';

/**
 * Privilegios por componente (B2): el administrador elige grupo y formulario y marca, sobre la lista
 * de componentes de ese mismo formulario, si cada uno es editable, de solo lectura o no visible.
 */
@Component({
  selector: 'app-form-privileges-page',
  imports: [FormsModule, LocalizedContentDirective],
  template: `
    <section class="admin-page privileges-page" i18nContent>
      <header class="admin-header">
        <div>
          <p class="eyebrow">Gestión · Usuarios y equipos</p>
          <h1>Privilegios por formulario</h1>
          <p>Define, para cada grupo de usuarios, qué componentes de un formulario puede editar, solo ver o no ver.</p>
        </div>
      </header>

      <div class="admin-toolbar privileges-toolbar">
        <label class="privileges-field">
          <span>Grupo de usuarios</span>
          <select [ngModel]="roleId()" (ngModelChange)="selectRole($event)" [disabled]="rolesLoading()">
            <option [ngValue]="null">Selecciona un grupo</option>
            @for (role of roles(); track role.id) { <option [ngValue]="role.id">{{ role.name }}</option> }
          </select>
        </label>
        <label class="privileges-field">
          <span>Formulario</span>
          <select [ngModel]="formKey()" (ngModelChange)="selectForm($event)">
            @for (form of forms; track form.key) { <option [ngValue]="form.key">{{ form.label }}</option> }
          </select>
        </label>
      </div>
      <p class="api-note">Sin configuración, todo es visible y editable. Si un usuario pertenece a varios grupos, gana el estado más permisivo. El servidor aplica las mismas reglas aunque se llame a la API directamente.</p>

      @if (error()) { <div class="admin-state error" role="alert">{{ error() }}</div> }
      @if (message()) { <div class="admin-state" role="status">{{ message() }}</div> }

      @if (rolesLoading()) {
        <section class="admin-table-wrap"><p class="admin-empty">Cargando grupos…</p></section>
      } @else if (roleId() === null) {
        <section class="admin-table-wrap"><p class="admin-empty">Selecciona un grupo para configurar sus privilegios.</p></section>
      } @else if (loading()) {
        <section class="admin-table-wrap"><p class="admin-empty">Cargando privilegios…</p></section>
      } @else {
        <div class="privileges-summary" aria-live="polite">
          <span class="admin-status">{{ summary().editable }} editables</span>
          <span class="admin-status readonly">{{ summary().readonly }} solo lectura</span>
          <span class="admin-status hidden">{{ summary().hidden }} no visibles</span>
          @if (dirty()) { <span class="privileges-dirty">Cambios sin guardar</span> }
        </div>
        <section class="admin-table-wrap">
          <table>
            <thead><tr><th>Componente</th><th>Estado para el grupo</th></tr></thead>
            <tbody>
              @for (component of currentForm().components; track component.key) {
                <tr [class.row-changed]="states()[component.key] !== savedState(component.key)">
                  <td><b>{{ component.label }}</b><small>{{ currentForm().key }}.{{ component.key }}</small></td>
                  <td>
                    <div class="state-switch" role="radiogroup" [attr.aria-label]="component.label">
                      @for (option of stateOptions; track option.value) {
                        <button type="button" role="radio" class="state-option" [attr.data-state]="option.value"
                          [class.selected]="states()[component.key] === option.value"
                          [attr.aria-checked]="states()[component.key] === option.value"
                          (click)="setState(component.key, option.value)">{{ option.label }}</button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </section>
        <div class="form-actions">
          <button class="admin-secondary" type="button" (click)="resetAll()" [disabled]="saving()">Todo visible y editable</button>
          <button class="admin-primary" type="button" (click)="save()" [disabled]="saving() || !dirty()">{{ saving() ? 'Guardando…' : 'Guardar privilegios' }}</button>
        </div>
      }
    </section>
  `,
  styles: [`
    .privileges-toolbar { align-items: flex-end; gap: 14px; }
    .privileges-field { color: var(--muted); display: grid; flex: 1 1 240px; font-size: 11px; font-weight: 800; gap: 6px; min-width: 0; }
    .privileges-field select { background: #f8fbfa; border: 1px solid var(--line); border-radius: 8px; color: var(--ink); font: inherit; font-size: 13px; font-weight: 600; height: 38px; outline: 0; padding: 0 10px; width: 100%; }
    .privileges-field select:focus { background: #fff; border-color: var(--teal); box-shadow: 0 0 0 3px rgba(15, 157, 154, .1); }
    .privileges-field select:disabled { color: var(--muted); }
    .privileges-summary { align-items: center; display: flex; flex-wrap: wrap; gap: 8px; margin: 4px 0 12px; }
    .admin-status.readonly { background: #fff1e4; color: #aa6d1c; }
    .admin-status.hidden { background: #fff4f3; color: #a65050; }
    .privileges-dirty { color: var(--teal); font-size: 11px; font-weight: 800; margin-left: auto; }
    .admin-table-wrap table { min-width: 620px; }
    tr.row-changed td:first-child { box-shadow: inset 3px 0 0 var(--teal); }
    .state-switch { background: #f8fbfa; border: 1px solid var(--line); border-radius: 10px; display: inline-flex; gap: 3px; padding: 3px; }
    .state-option { background: transparent; border: 0; border-radius: 7px; color: var(--muted); cursor: pointer; font: inherit; font-size: 11px; font-weight: 800; padding: 7px 12px; white-space: nowrap; }
    .state-option:hover { color: var(--ink); }
    .state-option:focus-visible { outline: 2px solid var(--teal); outline-offset: 1px; }
    .state-option.selected[data-state='VISIBLE_EDITABLE'] { background: #e3f8eb; color: #218450; }
    .state-option.selected[data-state='VISIBLE_READONLY'] { background: #fff1e4; color: #aa6d1c; }
    .state-option.selected[data-state='HIDDEN'] { background: #fff4f3; color: #a65050; }
    @media (max-width: 680px) {
      .privileges-toolbar { align-items: stretch; }
      .state-switch { display: flex; }
      .state-option { flex: 1; padding: 7px 6px; white-space: normal; }
    }
  `],
})
export class FormPrivilegesPage {
  private readonly adminApi = inject(AdministrationApiService);
  private readonly permissions = inject(ComponentPermissionService);

  readonly forms = FORM_REGISTRY;
  readonly stateOptions = COMPONENT_STATES;
  readonly roles = signal<ApiRole[]>([]);
  readonly rolesLoading = signal(true);
  readonly roleId = signal<number | null>(null);
  readonly formKey = signal(FORM_REGISTRY[0].key);
  readonly states = signal<Record<string, ComponentState>>({});
  private readonly savedStates = signal<Record<string, ComponentState>>({});
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly message = signal('');

  readonly currentForm = computed(() => FORM_REGISTRY.find((form) => form.key === this.formKey()) ?? FORM_REGISTRY[0]);
  readonly dirty = computed(() => JSON.stringify(this.states()) !== JSON.stringify(this.savedStates()));
  readonly summary = computed(() => {
    const values = this.currentForm().components.map((c) => this.states()[c.key] ?? DEFAULT_COMPONENT_STATE);
    return {
      editable: values.filter((state) => state === 'VISIBLE_EDITABLE').length,
      readonly: values.filter((state) => state === 'VISIBLE_READONLY').length,
      hidden: values.filter((state) => state === 'HIDDEN').length,
    };
  });

  savedState(componentKey: string): ComponentState {
    return this.savedStates()[componentKey] ?? DEFAULT_COMPONENT_STATE;
  }

  constructor() {
    this.adminApi.roles().subscribe({
      next: (roles) => { this.roles.set(roles); this.rolesLoading.set(false); },
      error: (err: HttpErrorResponse) => { this.rolesLoading.set(false); this.error.set(this.apiError(err, 'No se pudieron cargar los grupos.')); },
    });
  }

  selectRole(roleId: number | null): void {
    this.roleId.set(roleId);
    this.loadMatrix();
  }

  selectForm(formKey: string): void {
    this.formKey.set(formKey);
    this.loadMatrix();
  }

  setState(componentKey: string, state: ComponentState): void {
    this.states.update((states) => ({ ...states, [componentKey]: state }));
    this.message.set('');
  }

  resetAll(): void {
    this.states.set(Object.fromEntries(this.currentForm().components.map((c) => [c.key, DEFAULT_COMPONENT_STATE])));
    this.message.set('');
  }

  save(): void {
    const roleId = this.roleId();
    if (roleId === null) return;
    const form = this.formKey();
    this.saving.set(true);
    this.error.set('');
    this.permissions.saveMatrix(roleId, form, this.states()).subscribe({
      next: (matrix) => {
        this.saving.set(false);
        this.applyMatrix(matrix.states);
        this.permissions.invalidate(form);
        this.message.set('Privilegios guardados.');
      },
      error: (err: HttpErrorResponse) => { this.saving.set(false); this.error.set(this.apiError(err, 'No se pudieron guardar los privilegios.')); },
    });
  }

  private loadMatrix(): void {
    const roleId = this.roleId();
    this.message.set('');
    this.error.set('');
    if (roleId === null) return;
    this.loading.set(true);
    this.permissions.matrix(roleId, this.formKey()).subscribe({
      next: (matrix) => { this.loading.set(false); this.applyMatrix(matrix.states); },
      error: (err: HttpErrorResponse) => { this.loading.set(false); this.error.set(this.apiError(err, 'No se pudieron cargar los privilegios.')); },
    });
  }

  private applyMatrix(states: Record<string, ComponentState>): void {
    const complete = Object.fromEntries(this.currentForm().components
      .map((c) => [c.key, states?.[c.key] ?? DEFAULT_COMPONENT_STATE])) as Record<string, ComponentState>;
    this.states.set(complete);
    this.savedStates.set(complete);
  }

  private apiError(err: HttpErrorResponse, fallback: string): string {
    if (err.status === 403) return 'No tienes el permiso component_permission:manage.';
    if (err.status === 0) return 'No se pudo conectar con el servidor. Inténtalo de nuevo.';
    return err.error?.message || fallback;
  }
}
