import { Injectable, computed, signal } from '@angular/core';
import { Language, interpolate } from './translate';

/**
 * Minimal translation core created in the sprint scaffold. Task E1 may swap the internals for
 * a library (ngx-translate, Transloco) as long as `lang`, `use`, `load` and `t` keep their meaning.
 * A missing key returns the key itself, so untranslated screens keep working.
 */
@Injectable({ providedIn: 'root' })
export class TranslationService {
  readonly lang = signal<Language>('es');
  private readonly dictionaries = signal<Partial<Record<Language, Record<string, string>>>>({});

  readonly dictionary = computed(() => this.dictionaries()[this.lang()] ?? {});

  use(language: Language): void {
    this.lang.set(language);
  }

  load(language: Language, entries: Record<string, string>): void {
    this.dictionaries.update((current) => ({ ...current, [language]: { ...(current[language] ?? {}), ...entries } }));
  }

  t(key: string, params?: Record<string, string | number>): string {
    return interpolate(this.dictionary()[key] ?? key, params);
  }
}
