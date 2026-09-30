import { Injectable, signal } from '@angular/core';
import { Role } from '../../core/data/nexodocs-data';

/**
 * Estado visual de la demo. No representa una sesión autenticada ni persiste
 * cambios: permite que el shell y las pantallas compartan el rol seleccionado.
 */
@Injectable({ providedIn: 'root' })
export class DemoSessionState {
  readonly role = signal<Role>('Administrador de tenant');
  readonly tenant = signal('Organización autenticada');
  setTenant(t: string): void { this.tenant.set(t); }
  setRole(r: Role): void { this.role.set(r); }
}
