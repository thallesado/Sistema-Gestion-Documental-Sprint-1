import { Pipe, PipeTransform, inject } from '@angular/core';
import { ThemeService } from '../theme/theme.service';

/**
 * Pipe que formatea importes monetarios respetando la moneda configurada para el tenant (E2).
 * Si no hay moneda configurada, utiliza 'USD' por defecto.
 */
@Pipe({ name: 'appCurrency', standalone: true, pure: false })
export class AppCurrencyPipe implements PipeTransform {
  private readonly themeService = inject(ThemeService);

  transform(value: number | string | null | undefined, customCurrency?: string | null): string {
    if (value == null || value === '') return '-';
    const num = typeof value === 'number' ? value : Number.parseFloat(value);
    if (Number.isNaN(num)) return String(value);

    const currency = customCurrency || this.themeService.settings().currency || 'USD';
    try {
      return new Intl.NumberFormat('es-BO', {
        style: 'currency',
        currency: currency.toUpperCase(),
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(num);
    } catch {
      return `${currency.toUpperCase()} ${num.toFixed(2)}`;
    }
  }
}

export type TenantDateFormat = 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY';

/**
 * Formatea una fecha con la zona horaria y el formato de fecha del tenant (pura, sin Angular).
 * Los formatos admitidos son los que ofrece la pantalla Apariencia; uno desconocido usa YYYY-MM-DD.
 */
export function formatTenantDate(
  date: Date,
  timezone: string | null | undefined,
  dateFormat: string | null | undefined,
  withTime = false,
): string {
  const zone = timezone || 'America/La_Paz';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const [year, month, day] = [get('year'), get('month'), get('day')];
  let formatted: string;
  switch (dateFormat) {
    case 'DD/MM/YYYY':
      formatted = `${day}/${month}/${year}`;
      break;
    case 'MM/DD/YYYY':
      formatted = `${month}/${day}/${year}`;
      break;
    default:
      formatted = `${year}-${month}-${day}`;
  }
  return withTime ? `${formatted} ${get('hour')}:${get('minute')}` : formatted;
}

/**
 * Pipe que formatea fechas respetando la zona horaria y formato configurados en el tenant (E2).
 */
@Pipe({ name: 'appDate', standalone: true, pure: false })
export class AppDatePipe implements PipeTransform {
  private readonly themeService = inject(ThemeService);

  transform(value: Date | string | number | null | undefined, formatOption?: 'short' | 'medium' | 'long'): string {
    if (value == null || value === '') return '-';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    const { timezone, dateFormat } = this.themeService.settings();
    try {
      return formatTenantDate(date, timezone, dateFormat, formatOption === 'medium' || formatOption === 'long');
    } catch {
      return date.toLocaleDateString();
    }
  }
}
