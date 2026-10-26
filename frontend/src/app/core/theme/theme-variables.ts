// Pure mapping from tenant settings to CSS custom properties.

export interface TenantSettings {
  primaryColor?: string | null;
  logoUrl?: string | null;
  currency?: string | null;
  timezone?: string | null;
  dateFormat?: string | null;
  defaultLanguage?: string | null;
}

/**
 * Names this module may write to the document root, so they can be removed on logout.
 * The `--tenant-*` tokens feed `--teal*` in styles.css and shell/app.css, which is what
 * buttons, links and the sidebar actually read.
 */
export const THEME_VARIABLE_NAMES = [
  '--primary-color',
  '--primary-hover',
  '--primary-contrast',
  '--tenant-teal',
  '--tenant-teal-strong',
  '--tenant-teal-text',
  '--tenant-teal-muted',
  '--tenant-mint',
  '--tenant-sidebar-bg',
] as const;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const MIN_TEXT_CONTRAST = 4.5; // WCAG AA, normal text

type Rgb = [number, number, number];

function parse(hex: string): Rgb {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
}

function toHex(rgb: Rgb): string {
  return '#' + rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
}

/** Mixes `rgb` towards `target` by `amount` (0 = same colour, 1 = target). */
function mix(rgb: Rgb, target: Rgb, amount: number): Rgb {
  return rgb.map((v, i) => v + (target[i] - v) * amount) as Rgb;
}

function luminance(rgb: Rgb): number {
  const [lr, lg, lb] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

/** WCAG 2.x contrast ratio between two hex colours. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(parse(a));
  const lb = luminance(parse(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];

/** Darkens the colour until white text on it reaches AA contrast. */
function actionTone(rgb: Rgb): Rgb {
  let tone = rgb;
  for (let step = 0; step < 20 && contrastRatio(toHex(tone), '#ffffff') < MIN_TEXT_CONTRAST; step++) {
    tone = mix(tone, BLACK, 0.08);
  }
  return tone;
}

/**
 * Only well-formed values are returned: a malformed color from the server must never
 * reach the stylesheet. Without a tenant colour nothing is returned, so the defaults
 * declared in the stylesheets stay in force.
 */
export function themeVariables(settings: TenantSettings): Record<string, string> {
  const variables: Record<string, string> = {};
  if (settings.primaryColor && HEX_COLOR.test(settings.primaryColor)) {
    const brand = parse(settings.primaryColor);
    const action = actionTone(brand);
    const strong = mix(action, BLACK, 0.2);
    variables['--primary-color'] = settings.primaryColor;
    variables['--tenant-teal'] = toHex(action);
    variables['--primary-hover'] = toHex(strong);
    variables['--tenant-teal-strong'] = toHex(strong);
    variables['--primary-contrast'] = '#ffffff';
    variables['--tenant-teal-text'] = toHex(mix(brand, WHITE, 0.92));
    variables['--tenant-teal-muted'] = toHex(mix(brand, WHITE, 0.75));
    variables['--tenant-mint'] = toHex(mix(brand, WHITE, 0.88));
    variables['--tenant-sidebar-bg'] = toHex(mix(brand, BLACK, 0.78));
  }
  return variables;
}
