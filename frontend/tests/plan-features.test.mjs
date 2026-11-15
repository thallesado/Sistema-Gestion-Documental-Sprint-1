import assert from 'node:assert/strict';
import test from 'node:test';
import { FEATURE_LABELS, planFeatureLabel } from '../src/app/core/data/plan-features.ts';

test('every feature of the plan catalog has a customer-facing label', () => {
  for (const key of ['workflows', 'ocr_scanning', 'advanced_analytics', 'clinical_module', 'dicom_imaging', 'custom_branding']) {
    assert.ok(FEATURE_LABELS[key], key);
    assert.ok(!FEATURE_LABELS[key].includes('_'), FEATURE_LABELS[key]);
  }
});

test('the server description wins, then the shared label, and a raw key is never the first choice', () => {
  assert.equal(planFeatureLabel({ featureKey: 'custom_branding', description: 'Identidad visual por tenant' }), 'Identidad visual por tenant');
  assert.equal(planFeatureLabel({ featureKey: 'custom_branding' }), FEATURE_LABELS['custom_branding']);
  assert.equal(planFeatureLabel({ featureKey: 'future_feature', description: '  ' }), 'future_feature');
});
