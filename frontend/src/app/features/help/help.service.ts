import { Injectable, signal } from '@angular/core';

/** Open/closed state of the help panel. The panel itself is built in task H1. */
@Injectable({ providedIn: 'root' })
export class HelpService {
  readonly isOpen = signal(false);

  open(): void {
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  toggle(): void {
    this.isOpen.update((open) => !open);
  }
}
