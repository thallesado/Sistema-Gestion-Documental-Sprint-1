# Marca y regionalización del tenant

> Revisión documental: 2026-10-25. Base de código: `3876454` más los cambios del sprint especial; descripción del código inspeccionado, no certificación de producción.

El color primario y el logo guardados en Apariencia gobiernan los tokens de color de toda la aplicación y el logo de la cabecera. Zona horaria, formato de fecha (`YYYY-MM-DD`, `DD/MM/YYYY`, `MM/DD/YYYY`) y moneda salen de `ThemeService.settings()` y se aplican con `AppDatePipe`/`AppCurrencyPipe` (`formatTenantDate`). El idioma no forma parte de esta página.

Fuentes: [theme-variables.ts](../../../frontend/src/app/core/theme/theme-variables.ts), [format.pipe.ts](../../../frontend/src/app/core/i18n/format.pipe.ts), [appearance-page.ts](../../../frontend/src/app/features/settings/pages/appearance-page.ts). [Arquitectura Angular](../03-frontend/arquitectura-angular.md).
