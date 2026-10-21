import { AfterViewInit, Directive, DoCheck, ElementRef, OnDestroy, effect, inject } from '@angular/core';
import { featureText } from './ui-translations';
import { I18nService } from './i18n.service';

const TRANSLATABLE_ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'alt'];

@Directive({ selector: '[i18nContent]', standalone: true })
export class LocalizedContentDirective implements AfterViewInit, DoCheck, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly i18n = inject(I18nService);
  private readonly textSources = new WeakMap<Text, string>();
  private readonly translatedTexts = new WeakMap<Text, string>();
  private readonly attributeSources = new WeakMap<Element, Map<string, string>>();
  private readonly translatedAttributes = new WeakMap<Element, Map<string, string>>();
  private readonly valueSources = new WeakMap<HTMLInputElement | HTMLTextAreaElement, string>();
  private readonly translatedValues = new WeakMap<HTMLInputElement | HTMLTextAreaElement, string>();
  private readonly editedValues = new WeakSet<HTMLInputElement | HTMLTextAreaElement>();
  private observer?: MutationObserver;
  private readonly markEdited = (event: Event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) this.editedValues.add(target);
  };

  constructor() {
    effect(() => this.translateTree(this.i18n.language()));
  }

  ngAfterViewInit(): void {
    this.translateTree(this.i18n.language());
    this.observer = new MutationObserver(() => this.translateTree(this.i18n.language()));
    this.observer.observe(this.host.nativeElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: TRANSLATABLE_ATTRIBUTES });
    this.host.nativeElement.addEventListener('input', this.markEdited, true);
  }

  /**
   * Angular bindings can restore a model value after a language switch. Reapply
   * the presentation translation so seed values in inputs remain localized,
   * while `markEdited` continues protecting user-entered values.
   */
  ngDoCheck(): void {
    this.translateTree(this.i18n.language());
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.host.nativeElement.removeEventListener('input', this.markEdited, true);
  }

  private translateTree(language: ReturnType<I18nService['language']>): void {
    const root: HTMLElement = this.host.nativeElement;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) this.translateText(node, language);
    (Array.from(root.querySelectorAll('*')) as HTMLElement[]).forEach((element) => this.translateAttributes(element, language));
    root.querySelectorAll('input, textarea').forEach((element) => this.translateValue(element as HTMLInputElement | HTMLTextAreaElement, language));
  }

  private translateText(node: Text, language: ReturnType<I18nService['language']>): void {
    // Si Angular cambió el texto desde nuestra última traducción, el nuevo valor es la fuente.
    const priorSource = this.textSources.get(node);
    const source = priorSource !== undefined && node.data === this.translatedTexts.get(node) ? priorSource : node.data;
    this.textSources.set(node, source);
    const translated = this.translatePreservingWhitespace(source, language);
    this.translatedTexts.set(node, translated);
    if (node.data !== translated) node.data = translated;
  }

  private translateAttributes(element: HTMLElement, language: ReturnType<I18nService['language']>): void {
    for (const attribute of TRANSLATABLE_ATTRIBUTES) {
      const current = element.getAttribute(attribute);
      if (!current) continue;
      const sources = this.attributeSources.get(element) ?? new Map<string, string>();
      if (!this.attributeSources.has(element)) this.attributeSources.set(element, sources);
      const written = this.translatedAttributes.get(element) ?? new Map<string, string>();
      if (!this.translatedAttributes.has(element)) this.translatedAttributes.set(element, written);
      const priorSource = sources.get(attribute);
      const source = priorSource !== undefined && current === written.get(attribute) ? priorSource : current;
      sources.set(attribute, source);
      const translated = this.translatePreservingWhitespace(source, language);
      written.set(attribute, translated);
      if (current !== translated) element.setAttribute(attribute, translated);
    }
  }

  private translateValue(element: HTMLInputElement | HTMLTextAreaElement, language: ReturnType<I18nService['language']>): void {
    if (this.editedValues.has(element) || (element instanceof HTMLInputElement && !['', 'text', 'search'].includes(element.type))) return;
    const current = element.value;
    const priorSource = this.valueSources.get(element);
    const source = priorSource && current === this.translatedValues.get(element) ? priorSource : current;
    this.valueSources.set(element, source);
    const translated = this.translatePreservingWhitespace(source, language);
    this.translatedValues.set(element, translated);
    if (current !== translated) element.value = translated;
  }

  private translatePreservingWhitespace(source: string, language: ReturnType<I18nService['language']>): string {
    const leading = source.match(/^\s*/)?.[0] ?? '';
    const trailing = source.match(/\s*$/)?.[0] ?? '';
    const compact = source.trim().replace(/\s+/g, ' ');
    if (!compact) return source;
    return `${leading}${featureText(language, compact)}${trailing}`;
  }
}
