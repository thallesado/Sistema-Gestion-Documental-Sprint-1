import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const frontend = fileURLToPath(new URL('../', import.meta.url));
export const read = (rel) => readFile(path.join(frontend, rel), 'utf8');

/** Transpiles a pure TS module (optionally stubbing imports) and returns its exports. */
export async function load(rel, stubs = {}) {
  const outputText = ts.transpileModule(await read(rel), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
  }).outputText;
  const exports = {};
  const req = createRequire(import.meta.url);
  new Function('require', 'exports', outputText)((name) => (name in stubs ? stubs[name] : req(name)), exports);
  return exports;
}
