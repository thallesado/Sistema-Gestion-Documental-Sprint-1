import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesFileSignature } from '../src/app/core/data/file-signature.ts';

const bytes = (...values) => Uint8Array.from(values);
const ascii = (text) => Uint8Array.from(Array.from(text).map((char) => char.charCodeAt(0)));
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

test('accepts content that matches the declared type', () => {
  assert.equal(matchesFileSignature('application/pdf', ascii('%PDF-1.4\n')), true);
  assert.equal(matchesFileSignature('image/png', bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), true);
  assert.equal(matchesFileSignature('image/jpeg', bytes(0xff, 0xd8, 0xff, 0xe0)), true);
  assert.equal(matchesFileSignature(DOCX, bytes(0x50, 0x4b, 0x03, 0x04, 0)), true);
});

test('rejects content that does not match the declared type', () => {
  assert.equal(matchesFileSignature('application/pdf', ascii('MZ-not-a-pdf')), false);
  assert.equal(matchesFileSignature('image/png', ascii('%PDF-1.4')), false);
  assert.equal(matchesFileSignature(DOCX, ascii('%PDF-1.4')), false);
  assert.equal(matchesFileSignature('application/pdf', bytes()), false);
  assert.equal(matchesFileSignature('text/plain', ascii('hola')), false);
});
