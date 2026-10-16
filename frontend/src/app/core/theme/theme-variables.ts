// Pure mapping from tenant settings to CSS custom properties.

export interface TenantSettings {
  primaryColor?: string | null;
  logoUrl?: string | null;
  currency?: string | null;
  timezone?: string | null;
  dateFormat?: string | null;
  defaultLanguage?: string | null;
}

/** Names this module may write to the document root, so they can be removed on logout. */
export const THEME_VARIABLE_NAMES = ['--primary-color'] as const;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/**
 * Only well-formed values are returned: a malformed color from the server must never
 * reach the stylesheet. Task E2 decides how `--primary-color` maps onto the existing
 * `--teal*` variables declared in index.html.
 */
export function themeVariables(settings: TenantSettings): Record<string, string> {
  const variables: Record<string, string> = {};
  if (settings.primaryColor && HEX_COLOR.test(settings.primaryColor)) {
    variables['--primary-color'] = settings.primaryColor;
  }
  return variables;
}
