import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const embed = await readFile(new URL('../src/app/features/reportes/components/reportiq-embed.ts', import.meta.url), 'utf8');

test('abrir ReportIQ fuera no deja window.opener ni envía Referer', () => {
  assert.match(embed, /window\.open\(this\.rawUrl, '_blank', 'noopener,noreferrer'\)/);
});

test('solo se aceptan mensajes del iframe de ReportIQ', () => {
  assert.match(embed, /event\.origin !== this\.embedOrigin\(\)/);
  assert.match(embed, /event\.source !== this\.iframeRef\?\.nativeElement\?\.contentWindow/);
});
