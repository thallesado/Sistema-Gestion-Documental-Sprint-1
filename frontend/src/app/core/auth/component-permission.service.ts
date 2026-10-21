import { HttpClient } from '@angular/common/http';
import { Injectable, effect, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { ComponentState, componentState, splitFieldKey } from './form-registry';

const API_URL = '/api/v1/component-permissions';

export interface ApiFormDefinition { key: string; label: string; components: { key: string; label: string }[] }
export interface ApiFormMatrix { roleId: number; form: string; states: Record<string, ComponentState> }

/**
 * Estados de cada componente de formulario para el usuario actual (privilegios B2).
 * Solo decide cómo se pinta el formulario: el backend vuelve a aplicar las mismas reglas.
 */
@Injectable({ providedIn: 'root' })
export class ComponentPermissionService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly states = signal<Record<string, Record<string, ComponentState>>>({});
  private readonly requested = new Set<string>();
  private loadedForUser: string | null | undefined;

  constructor() {
    // Los estados dependen de los grupos del usuario: se descartan al cambiar de sesión.
    effect(() => {
      const userId = this.auth.user()?.id ?? null;
      if (this.loadedForUser !== undefined && this.loadedForUser !== userId) {
        this.requested.clear();
        this.states.set({});
      }
      this.loadedForUser = userId;
    });
  }

  /** Carga (una vez por sesión) los estados efectivos de un formulario. */
  load(form: string): void {
    if (this.requested.has(form) || !this.auth.isAuthenticated()) return;
    this.requested.add(form);
    this.http.get<Record<string, ComponentState>>(`${API_URL}/me`, { params: { form } }).subscribe({
      next: (states) => this.states.update((all) => ({ ...all, [form]: states ?? {} })),
      // Sin respuesta el formulario queda editable; el servidor sigue aplicando las restricciones.
      error: () => this.requested.delete(form),
    });
  }

  /** Estado de `documento.nuevo.codigo`; lee una signal, así que se puede usar en computed/effect. */
  state(fieldKey: string): ComponentState {
    const { form, component } = splitFieldKey(fieldKey);
    this.load(form);
    return componentState(this.states()[form], component);
  }

  visible(fieldKey: string): boolean {
    return this.state(fieldKey) !== 'HIDDEN';
  }

  editable(fieldKey: string): boolean {
    return this.state(fieldKey) === 'VISIBLE_EDITABLE';
  }

  // Administración de la matriz (permiso component_permission:manage)
  forms(): Observable<ApiFormDefinition[]> {
    return this.http.get<ApiFormDefinition[]>(`${API_URL}/forms`);
  }

  matrix(roleId: number, form: string): Observable<ApiFormMatrix> {
    return this.http.get<ApiFormMatrix>(`${API_URL}/roles/${roleId}`, { params: { form } });
  }

  saveMatrix(roleId: number, form: string, states: Record<string, ComponentState>): Observable<ApiFormMatrix> {
    return this.http.put<ApiFormMatrix>(`${API_URL}/roles/${roleId}`, { states }, { params: { form } });
  }

  /** Tras guardar una matriz, los estados del propio usuario pueden haber cambiado. */
  invalidate(form: string): void {
    this.requested.delete(form);
    this.states.update((all) => {
      const { [form]: _removed, ...rest } = all;
      return rest;
    });
  }
}
