import assert from 'node:assert/strict';
import test from 'node:test';

import { suggestionFor } from '../src/app/core/assistant/assistant-suggestions.ts';

const at = '2026-10-20T00:00:00.000Z';

test('a failed OCR process suggests retrying or checking the image', () => {
  const suggestion = suggestionFor({ status: 500, method: 'POST', url: '/api/v1/ocr/process', at });
  assert.ok(suggestion);
  assert.match(suggestion.message, /reintentar/i);
  assert.match(suggestion.message, /imagen/i);
  assert.match(suggestion.question, /OCR/);
});

test('OCR failures explain the concrete cause when the status tells it', () => {
  assert.match(suggestionFor({ status: 413, method: 'POST', url: '/api/v1/ocr/process', at }).message, /demasiado grande/);
  assert.match(suggestionFor({ status: 403, method: 'POST', url: '/api/v1/ocr/jobs/x/index', at }).message, /permiso/);
});

test('other failures get a generic offer of help, permission or connection hints', () => {
  assert.match(suggestionFor({ status: 403, method: 'POST', url: '/api/v1/documents', at }).message, /permiso/);
  assert.match(suggestionFor({ status: 0, method: 'GET', url: '/api/v1/documents', at }).message, /conexión/);
  assert.ok(suggestionFor({ status: 500, method: 'GET', url: '/api/v1/expedients', at }));
});

test('no suggestion without error, for expired sessions or for the assistant itself', () => {
  assert.equal(suggestionFor(null), null);
  assert.equal(suggestionFor({ status: 401, method: 'GET', url: '/api/v1/documents', at }), null);
  assert.equal(suggestionFor({ status: 502, method: 'POST', url: '/api/v1/assistant/chat', at }), null);
});
