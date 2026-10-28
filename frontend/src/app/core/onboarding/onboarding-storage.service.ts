import { Injectable } from '@angular/core';

/**
 * Persiste en localStorage la bandera `hasCompletedTour`, una por usuario para que un equipo
 * compartido muestre el recorrido a cada persona nueva.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingStorageService {
  static readonly FLAG = 'hasCompletedTour';

  hasCompletedTour(userId: string): boolean {
    try {
      return localStorage.getItem(this.key(userId)) === 'true';
    } catch {
      // Sin almacenamiento disponible es preferible no repetir el recorrido en cada pantalla.
      return true;
    }
  }

  markCompleted(userId: string): void {
    try { localStorage.setItem(this.key(userId), 'true'); } catch { /* storage unavailable */ }
  }

  /** Vuelve a habilitar el recorrido para el usuario. */
  reset(userId: string): void {
    try { localStorage.removeItem(this.key(userId)); } catch { /* storage unavailable */ }
  }

  private key(userId: string): string {
    return `nexodocs.${OnboardingStorageService.FLAG}.${userId}`;
  }
}
