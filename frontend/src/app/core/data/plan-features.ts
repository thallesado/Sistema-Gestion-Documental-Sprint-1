/** Customer-facing names of the plan catalog features; the fallback when the server sends no description. */
export const FEATURE_LABELS: Record<string, string> = {
  workflows: 'Workflows de aprobación',
  ocr_scanning: 'Digitalización y OCR',
  advanced_analytics: 'Reportes avanzados',
  clinical_module: 'Módulo clínico',
  dicom_imaging: 'Imágenes DICOM',
  custom_branding: 'Identidad visual por tenant',
};

/** The catalog description (single source of truth) first, then the shared label; a raw key is the last resort. */
export function planFeatureLabel(feature: { featureKey: string; description?: string | null }): string {
  const description = feature.description?.trim();
  return description || FEATURE_LABELS[feature.featureKey] || feature.featureKey;
}
