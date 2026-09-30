import { AbstractControl, ValidationErrors } from '@angular/forms';

export function strongPassword(control: AbstractControl): ValidationErrors | null {
  const v = String(control.value ?? '');
  const ok = v.length >= 8 && /[A-Z]/.test(v) && /\d/.test(v) && /[^\p{L}\p{N}\s]/u.test(v);
  return ok ? null : { weakPassword: true };
}

export function suggestUsername(first: string, last: string): string {
  const clean = (text: string) => (text.trim().split(/\s+/)[0] ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
  return clean(first) + clean(last);
}
