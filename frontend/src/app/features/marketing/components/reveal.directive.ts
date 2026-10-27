import { Directive, ElementRef, OnDestroy, OnInit, inject, input } from '@angular/core';

/**
 * Adds `is-visible` the first time the element scrolls into view; styles.css animates `.reveal`.
 * `appReveal="120"` delays the entrance in milliseconds to stagger sibling cards.
 */
@Directive({ selector: '[appReveal]', standalone: true, host: { class: 'reveal' } })
export class RevealDirective implements OnInit, OnDestroy {
  readonly appReveal = input<string | number>('');
  private readonly element = inject(ElementRef<HTMLElement>);
  private observer?: IntersectionObserver;

  ngOnInit(): void {
    const node = this.element.nativeElement as HTMLElement;
    const delay = Number(this.appReveal()) || 0;
    if (delay) node.style.transitionDelay = `${delay}ms`;
    if (typeof IntersectionObserver === 'undefined') {
      node.classList.add('is-visible');
      return;
    }
    this.observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        node.classList.add('is-visible');
        this.observer?.disconnect();
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    this.observer.observe(node);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
