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

    const timezone = this.themeService.settings().timezone || 'America/La_Paz';
    const dateFormat = this.themeService.settings().dateFormat || 'YYYY-MM-DD';

    try {
      const options: Intl.DateTimeFormatOptions = {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      };

      if (formatOption === 'medium' || formatOption === 'long') {
        options.hour = '2-digit';
        options.minute = '2-digit';
      }

      const formatted = new Intl.DateTimeFormat('es-ES', options).format(date);
      // Ajustar separadores si el tenant configuró YYYY-MM-DD
      if (dateFormat === 'YYYY-MM-DD' && !formatOption) {
        const parts = formatted.split('/');
        if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      return formatted;
    } catch {
      return date.toLocaleDateString();
    }
  }
}
