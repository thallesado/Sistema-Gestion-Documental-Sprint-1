import { Injectable, inject } from '@angular/core';
import { driver, type Driver, type DriveStep } from 'driver.js';
import { APP_TOUR_STEPS, OnboardingStep } from './onboarding-steps';
import { OnboardingStorageService } from './onboarding-storage.service';
import { I18nService } from '../i18n/i18n.service';

/**
 * Recorrido guiado con driver.js. Se ejecuta solo si `hasCompletedTour` es falso para el usuario
 * y lo marca como completado al terminar, cerrar u omitir.
 */
@Injectable({ providedIn: 'root' })
export class AppTourService {
  private readonly storage = inject(OnboardingStorageService);
  private readonly i18n = inject(I18nService);
  private active: Driver | null = null;

  /** Inicia el recorrido si el usuario aún no lo vio. Devuelve `true` si se inició. */
  startIfNeeded(userId: string, steps: readonly OnboardingStep[] = APP_TOUR_STEPS): boolean {
    if (this.active || this.storage.hasCompletedTour(userId)) return false;
    // Un objetivo oculto (p. ej. el menú lateral en móvil) se omite en lugar de mostrarse en el aire.
    const visible = steps.filter((step) => this.isVisible(step.target));
    if (!visible.length) return false;

    const tour = driver({
      showProgress: true,
      // driver.js fills {{current}}/{{total}}; the i18n service leaves unknown placeholders intact.
      progressText: this.i18n.t('tour.progress'),
      nextBtnText: this.i18n.t('tour.next'),
      prevBtnText: this.i18n.t('tour.prev'),
      doneBtnText: this.i18n.t('tour.done'),
      showButtons: ['next', 'previous', 'close'],
      allowClose: true,
      overlayOpacity: 0.55,
      stagePadding: 6,
      stageRadius: 12,
      smoothScroll: true,
      popoverClass: 'nexodocs-tour',
      steps: visible.map((step) => this.toDriveStep(step)),
      onPopoverRender: (popover) => {
        // Opción explícita para omitir en cualquier paso, además de la «×» de cierre.
        const skip = document.createElement('button');
        skip.type = 'button';
        skip.className = 'nexodocs-tour-skip';
        skip.textContent = this.i18n.t('tour.skip');
        skip.addEventListener('click', () => tour.destroy());
        popover.footer.prepend(skip);
      },
      onDestroyed: () => {
        this.storage.markCompleted(userId);
        this.active = null;
      },
    });
    this.active = tour;
    tour.drive();
    return true;
  }

  /** Muestra el recorrido de nuevo aunque ya se haya completado. */
  restart(userId: string): boolean {
    this.storage.reset(userId);
    return this.startIfNeeded(userId);
  }

  private toDriveStep(step: OnboardingStep): DriveStep {
    return {
      element: step.target,
      popover: {
        title: this.i18n.t(`tour.steps.${step.textKey}.title`),
        description: this.i18n.t(`tour.steps.${step.textKey}.description`),
        side: step.side,
        align: 'start',
      },
    };
  }

  private isVisible(selector: string): boolean {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden';
  }
}
