import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { LanguageCode, TRANSLATIONS, TranslationTree } from './translations';

const STORAGE_KEY = 'nexodocs_lang';
const SUPPORTED: LanguageCode[] = ['es', 'en', 'fr', 'zh'];
const LOCALES: Record<LanguageCode, string> = { es: 'es-BO', en: 'en-US', fr: 'fr-FR', zh: 'zh-CN' };
let currentLocale = LOCALES.es;

/** Locale BCP 47 del idioma activo, para Intl/toLocale* fuera de los templates. */
export function activeLocale(): string { return currentLocale; }

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly document = inject(DOCUMENT);
  readonly language = signal<LanguageCode>(this.initialLanguage());
  readonly locale = computed(() => LOCALES[this.language()]);
  readonly languages: ReadonlyArray<{ code: LanguageCode; label: string }> = [
    { code: 'es', label: 'Español' },
    { code: 'en', label: 'English' },
    { code: 'fr', label: 'Français' },
    { code: 'zh', label: '中文' },
  ];

  constructor() {
    effect(() => {
      const language = this.language();
      this.document.documentElement.lang = language;
      currentLocale = LOCALES[language];
      try { localStorage.setItem(STORAGE_KEY, language); } catch { /* storage unavailable */ }
    });
  }

  setLanguage(language: LanguageCode): void { if (SUPPORTED.includes(language)) this.language.set(language); }

  t(key: string, params: Record<string, string | number> = {}): string {
    const value = this.lookup(TRANSLATIONS[this.language()], key) ?? this.lookup(TRANSLATIONS.es, key) ?? key;
    return value.replace(/{{\s*(\w+)\s*}}/g, (_, name: string) => String(params[name] ?? `{{${name}}}`));
  }

  private lookup(tree: TranslationTree, key: string): string | undefined {
    const value = key.split('.').reduce<string | TranslationTree | undefined>((node, part) =>
      typeof node === 'object' && node !== null ? node[part] : undefined, tree);
    return typeof value === 'string' ? value : undefined;
  }

  private initialLanguage(): LanguageCode {
    try { const stored = localStorage.getItem(STORAGE_KEY) as LanguageCode | null; if (stored && SUPPORTED.includes(stored)) return stored; } catch { /* storage unavailable */ }
    const browserLanguage = typeof navigator === 'undefined' ? 'es' : navigator.language.toLowerCase().split('-')[0];
    return SUPPORTED.includes(browserLanguage as LanguageCode) ? browserLanguage as LanguageCode : 'es';
  }
}
