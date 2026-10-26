import assert from 'node:assert/strict';
import test from 'node:test';

import { describeExternalAnchor } from '../src/app/features/auditoria/audit-anchor-status.ts';

test('a matching external anchor is reported as verified', () => {
  assert.equal(describeExternalAnchor('ANCHORED_MATCH').tone, 'ok');
});

test('mismatch and invalid signature are dangerous', () => {
  assert.equal(describeExternalAnchor('ANCHOR_MISMATCH').tone, 'danger');
  assert.equal(describeExternalAnchor('ANCHOR_SIGNATURE_INVALID').tone, 'danger');
});

test('unconfigured or unknown status never claims verification', () => {
  for (const s of ['NOT_CONFIGURED', undefined, null, 'SOMETHING_NEW']) {
    const v = describeExternalAnchor(s);
    assert.equal(v.tone, 'muted');
    assert.ok(!v.label.includes('verificada'));
  }
});

test('unreachable and pending destinations are warnings', () => {
  for (const s of ['UNREACHABLE', 'NO_EXTERNAL_ANCHOR', 'UNVERIFIABLE']) {
    assert.equal(describeExternalAnchor(s).tone, 'warn');
  }
});
