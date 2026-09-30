import { Component, ElementRef, HostListener, afterNextRender, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { merge } from 'rxjs';
import { AdministrationApiService, ApiRole, CreateUserPayload } from '../../../core/api/administration-api.service';

/** Exige mínimo 8 caracteres, mayúscula, número y carácter especial. */
function strongPassword(control: AbstractControl): ValidationErrors | null {
  const v = String(control.value ?? '');
  const ok = v.length >= 8 && /[A-Z]/.test(v) && /\d/.test(v) && /[^\p{L}\p{N}\s]/u.test(v);
  return ok ? null : { weakPassword: true };
}

/** "José María" + "Pérez" -> "joseperez" */
function suggestUsername(first: string, last: string): string {
  const clean = (text: string) => (text.trim().split(/\s+/)[0] ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
  return clean(first) + clean(last);
}

/**
 * Ventana emergente para crear un usuario del tenant autenticado.
 * Cabecera y pie fijos; el formulario del cuerpo hace scroll si no cabe.
 * Emite `saved` cuando el usuario se creó y `closed` cuando se cancela.
 */
@Component({
  selector: 'app-create-user-modal',
  imports: [ReactiveFormsModule],
  template: `
    <div class="modal-backdrop" role="presentation">
      <form class="admin-modal create-user-modal create-user-form" [formGroup]="userForm" (ngSubmit)="onSubmit()"
            role="dialog" aria-modal="true" aria-labelledby="create-user-title" novalidate>
        <header class="user-form-header create-user-modal-header">
          <span class="user-form-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>
          </span>
          <div class="create-user-modal-title">
            <h2 id="create-user-title">Nuevo usuario</h2>
            <p class="form-note">La cuenta se crea en la organización del usuario autenticado.</p>
          </div>
          <button type="button" class="modal-close" aria-label="Cerrar" [disabled]="saving()" (click)="close()">×</button>
        </header>

        <div class="create-user-modal-body">
          @if (error()) { <div class="admin-state error" role="alert">{{ error() }}</div> }
          <div class="form-grid">
            <label class="field-first">Nombre<input formControlName="firstName" autocomplete="given-name" />@if (invalid('firstName')) { <small class="field-error">Ingresa el nombre.</small> }</label>
            <label class="field-last">Apellido<input formControlName="lastName" autocomplete="family-name" />@if (invalid('lastName')) { <small class="field-error">Ingresa el apellido.</small> }</label>
            <label class="field-username">Usuario<input formControlName="username" autocomplete="off" />@if (invalid('username')) { <small class="field-error">{{ userForm.controls.username.hasError('pattern') ? 'El usuario no puede contener espacios.' : 'Ingresa un nombre de usuario.' }}</small> }</label>
            <label class="field-email">Correo<input type="email" formControlName="email" autocomplete="off" />@if (invalid('email')) { <small class="field-error">Ingresa un correo válido.</small> }</label>
            <label class="field-password">Contraseña<input type="password" formControlName="password" autocomplete="new-password" />
              <div class="password-popover" role="status" aria-label="Requisitos de la contraseña">
                <p class="password-popover-title">Tu contraseña debe tener:</p>
                <ul class="password-rules">
                  @for (rule of passwordRules; track rule.label) {
                    <li [class.met]="rule.test()"><span class="rule-icon" aria-hidden="true">{{ rule.test() ? '✓' : '✕' }}</span>{{ rule.label }}</li>
                  }
                </ul>
              </div>
            </label>
            <label class="field-confirm-password">Confirmar contraseña<input type="password" formControlName="confirmPassword" autocomplete="new-password" />@if (userForm.hasError('passwordMismatch') && userForm.controls.confirmPassword.touched) { <small class="field-error">Las contraseñas no coinciden.</small> }</label>
            <div class="chip-field field-roles">
              <span class="chip-field-header"><span id="create-user-roles-label">Roles permitidos</span><span class="role-chip-counter">{{ selectedRoleIds().length }} seleccionado{{ selectedRoleIds().length === 1 ? '' : 's' }}</span></span>
              <div class="role-chip-list" role="group" aria-labelledby="create-user-roles-label">
                @for (role of roles(); track role.id) {
                  <button type="button" class="role-chip" [class.selected]="selectedRoleIds().includes(role.id)" [attr.aria-pressed]="selectedRoleIds().includes(role.id)" (click)="toggleRole(role.id)">{{ role.name }}</button>
                }
              </div>
              @if (invalid('roleIds')) { <small class="field-error">Selecciona al menos un rol.</small> } @else { <small class="field-help">Selecciona uno o más roles activos de la organización.</small> }
            </div>
          </div>
        </div>

        <footer class="create-user-modal-footer">
          <button class="admin-secondary" type="button" [disabled]="saving()" (click)="close()">Cancelar</button>
          <button class="admin-primary" type="submit" [disabled]="saving() || userForm.invalid">{{ saving() ? 'Creando…' : 'Crear usuario' }}</button>
        </footer>
      </form>
    </div>
  `,
})
export class CreateUserModal {
  private readonly api = inject(AdministrationApiService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Roles activos del tenant que se pueden asignar. */
  readonly roles = input.required<ApiRole[]>();
  readonly closed = output<void>();
  readonly saved = output<void>();

  readonly saving = signal(false);
  readonly error = signal('');
  readonly selectedRoleIds = signal<number[]>([]);

  readonly userForm = new FormGroup({
    firstName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    lastName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    username: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^\S+$/)] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, strongPassword] }),
    confirmPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    roleIds: new FormControl<number[]>([], { nonNullable: true, validators: [Validators.required, Validators.minLength(1)] }),
  }, { validators: (group: AbstractControl): ValidationErrors | null =>
    group.get('password')?.value === group.get('confirmPassword')?.value ? null : { passwordMismatch: true } });

  private get passwordValue(): string { return this.userForm.controls.password.value; }
  readonly passwordRules = [
    { label: 'Mínimo 8 caracteres', test: () => this.passwordValue.length >= 8 },
    { label: 'Al menos 1 letra mayúscula', test: () => /[A-Z]/.test(this.passwordValue) },
    { label: 'Al menos 1 número', test: () => /\d/.test(this.passwordValue) },
    { label: 'Al menos 1 carácter especial', test: () => /[^\p{L}\p{N}\s]/u.test(this.passwordValue) },
  ];

  constructor() {
    const { firstName, lastName, username } = this.userForm.controls;
    merge(firstName.valueChanges, lastName.valueChanges).pipe(takeUntilDestroyed()).subscribe(() => {
      // Solo autogenera mientras el usuario no haya editado el campo a mano (patchValue no lo marca dirty).
      if (!username.dirty) username.patchValue(suggestUsername(firstName.value, lastName.value));
    });
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLInputElement>('input')?.focus());
  }

  @HostListener('document:keydown.escape')
  onEscape(): void { this.close(); }

  close(): void {
    if (!this.saving()) this.closed.emit();
  }

  invalid(name: string): boolean {
    const control = this.userForm.get(name);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  toggleRole(id: number): void {
    const next = this.selectedRoleIds().includes(id)
      ? this.selectedRoleIds().filter((roleId) => roleId !== id)
      : [...this.selectedRoleIds(), id];
    this.selectedRoleIds.set(next);
    this.userForm.controls.roleIds.setValue(next);
    this.userForm.controls.roleIds.markAsTouched();
  }

  onSubmit(): void {
    if (this.saving()) return;
    if (this.userForm.invalid) { this.userForm.markAllAsTouched(); return; }
    const { firstName, lastName, username, email, password, roleIds } = this.userForm.getRawValue();
    const payload: CreateUserPayload = {
      username: username.trim(),
      email: email.trim(),
      password,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      roleIds: [...roleIds],
    };
    this.saving.set(true);
    this.error.set('');
    this.api.createUser(payload).subscribe({
      next: () => { this.saving.set(false); this.saved.emit(); },
      error: (err: { status?: number; error?: { message?: string } }) => {
        this.saving.set(false);
        this.error.set(this.apiError(err));
      },
    });
  }

  private apiError(error: { status?: number; error?: { message?: string } }): string {
    if (error.status === 0) return 'No se pudo conectar con la API. Comprueba que el backend esté ejecutándose.';
    if (error.error?.message) return error.error.message;
    if (error.status === 401 || error.status === 403) return 'No tienes permisos para realizar esta operación.';
    return 'No se pudo crear el usuario.';
  }
}
