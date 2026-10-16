// Pure helpers for the translation layer.

export type Language = 'es' | 'en';

export const SUPPORTED_LANGUAGES: readonly Language[] = ['es', 'en'];

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/** Replaces `{{name}}` placeholders; a placeholder without a value is left untouched. */
export function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match);
}
