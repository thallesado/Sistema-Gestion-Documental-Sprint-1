// Lista los textos visibles de una pantalla que el diccionario de i18nContent no traduce.
// Uso: node scripts/i18n-audit.mjs <archivo.ts|archivo.html> [...] [--lang=en] [--json]
// Extrae: texto entre etiquetas, atributos placeholder/title/aria-label/alt y literales de
// texto del código (etiquetas, mensajes). Los textos con interpolación se informan como
// "dinámicos": solo se traducen si hay un TEXT_PATTERN o si se separa la parte fija.
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(frontend, 'package.json'));
const cache = new Map();

/** Carga un módulo TS puro transpilándolo, resolviendo sus imports relativos de forma recursiva. */
async function load(file) {
  const absolute = path.resolve(file.endsWith('.ts') ? file : `${file}.ts`);
  if (cache.has(absolute)) return cache.get(absolute);
  const exports = {};
  cache.set(absolute, exports);
  const source = await readFile(absolute, 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const deps = {};
  for (const match of output.matchAll(/require\("(\.[^"]+)"\)/g)) deps[match[1]] = await load(path.join(path.dirname(absolute), match[1]));
  new Function('require', 'exports', output)((name) => deps[name] ?? require(name), exports);
  return exports;
}

const args = process.argv.slice(2);
const language = (args.find((a) => a.startsWith('--lang=')) ?? '--lang=en').slice(7);
const json = args.includes('--json');
const files = args.filter((a) => !a.startsWith('--'));
const { featureText, FEATURE_TEXT } = await load(path.join(frontend, 'src/app/core/i18n/ui-translations.ts'));

const SPANISH = /[a-záéíóúñü]{2}/i;
const IGNORE = /^(?:[A-Z]{2}-\d{4}-\d+|[\d\s.,:/%$+\-×·•|()]+|[A-Z0-9_]{2,}|[a-z]+:[a-z_]+|https?:\/\/\S+|\/[\w/-]*|#\w+|[\w.-]+@[\w.-]+|NexoDocs|Stripe|USDT|OCR|PDF|CSV|JSON|ZIP|QR|DICOM|SHA-256)$/;

function templateOf(source, file) {
  if (file.endsWith('.html')) return source;
  return [...source.matchAll(/template:\s*`([\s\S]*?)`\s*,\s*(?:styles|styleUrl|host|changeDetection|providers|\})/g)].map((m) => m[1]).join('\n');
}

function codeOf(source, file) {
  if (file.endsWith('.html')) return '';
  return source.replace(/template:\s*`[\s\S]*?`\s*,\s*(?=styles|styleUrl|host|changeDetection|providers|\})/g, '')
    .replace(/styles:\s*\[\s*`[\s\S]*?`\s*\]/g, '').replace(/styles:\s*`[\s\S]*?`/g, '');
}

function templateTexts(template) {
  const found = [];
  const clean = template.replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(style|script)[\s\S]*?<\/\1>/g, '')
    .replace(/@(?:if|else if|for|switch|case|default|empty|defer|placeholder|loading)\b\s*(?:\((?:[^()]|\([^()]*\))*\))?\s*\{/g, '<x>')
    .replace(/\}\s*@else\s*\{/g, '<x>').replace(/@let [^;]+;/g, '');
  for (const match of clean.matchAll(/>([^<>]+)</g)) {
    // Primero las interpolaciones; después las llaves sueltas del control de flujo.
    const marked = match[1].replace(/\{\{[\s\S]*?\}\}/g, '\u0001');
    const fixed = marked.replace(/[{}]/g, '').replace(/\u0001/g, '{…}').trim().replace(/\s+/g, ' ');
    if (!fixed) continue;
    const staticPart = fixed.replace(/\{…\}/g, '').trim();
    if (!staticPart || !SPANISH.test(staticPart)) continue;
    // Una interpolación sola (sin texto fijo) se evalúa por los literales del código.
    found.push({ text: fixed, dynamic: fixed.includes('{…}'), where: 'template' });
  }
  for (const match of clean.matchAll(/\s(?:placeholder|title|aria-label|alt)="([^"{}]+)"/g)) {
    if (SPANISH.test(match[1])) found.push({ text: match[1].trim(), dynamic: false, where: 'attribute' });
  }
  return found;
}

function codeTexts(code) {
  const found = [];
  for (const match of code.matchAll(/(['`])((?:(?!\1)[^\\\n]|\\.)*)\1/g)) {
    let text = match[2];
    if (match[1] === '`') { if (!/\$\{/.test(text)) { /* plain */ } }
    const dynamic = /\$\{/.test(text);
    text = text.replace(/\$\{[^}]*\}/g, '{…}').trim();
    // Texto de interfaz: empieza con mayúscula (o ¿¡) y tiene al menos una palabra en minúsculas.
    if (!/^[¿¡A-ZÁÉÍÓÚÑ]/.test(text) || !/\s|[áéíóúñ]/.test(text) || !SPANISH.test(text)) continue;
    if (/^(?:[A-Z]\w+\.){1,}|\.(?:ts|html|css|pdf)$|^[A-Z][a-zA-Z]+(?:Service|Page|Modal|Component)$/.test(text)) continue;
    found.push({ text, dynamic, where: 'code' });
  }
  return found;
}

// --translate: traduce los textos indicados (en lugar de archivos) e imprime un arreglo JSON.
if (args.includes('--translate')) {
  console.log(JSON.stringify(files.map((text) => featureText(language, text))));
  process.exit(0);
}

// --keys: claves usadas con el pipe translate que faltan en cada idioma (caen al castellano).
if (args.includes('--keys')) {
  const { TRANSLATIONS } = await load(path.join(frontend, 'src/app/core/i18n/translations.ts'));
  const flat = (tree, prefix = '') => Object.entries(tree ?? {}).flatMap(([k, v]) => typeof v === 'string' ? [prefix + k] : flat(v, `${prefix}${k}.`));
  let total = 0;
  for (const file of files) {
    const used = [...new Set([...(await readFile(path.resolve(file), 'utf8')).matchAll(/'([a-z][\w]*\.[\w.]+)'\s*\|\s*translate/g)].map((m) => m[1]))];
    for (const lang of ['en', 'fr', 'zh']) {
      const known = new Set(flat(TRANSLATIONS[lang]));
      const missing = used.filter((key) => !known.has(key));
      total += missing.length;
      if (missing.length) console.log(`${path.basename(file)} [${lang}] faltan ${missing.length}: ${missing.join(' ')}`);
    }
  }
  console.log(`claves sin traducir: ${total}`);
  process.exit(0);
}

const report = [];
for (const file of files) {
  const source = await readFile(path.resolve(file), 'utf8');
  const entries = [...templateTexts(templateOf(source, file)), ...codeTexts(codeOf(source, file))];
  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.text) || IGNORE.test(entry.text)) continue;
    seen.add(entry.text);
    if (entry.dynamic) { report.push({ file, ...entry, status: 'dynamic' }); continue; }
    // Igual al original no es un fallo si el diccionario lo registra (nombres propios, códigos).
    const translated = featureText(language, entry.text);
    if (translated === entry.text && FEATURE_TEXT[language][entry.text] === undefined) report.push({ file, ...entry, status: 'missing' });
  }
}

if (json) console.log(JSON.stringify(report, null, 1));
else {
  for (const file of files) {
    const rows = report.filter((r) => r.file === file);
    console.log(`\n## ${path.basename(file)}  (faltan ${rows.filter((r) => r.status === 'missing').length}, dinámicos ${rows.filter((r) => r.status === 'dynamic').length})`);
    for (const row of rows) console.log(`${row.status === 'missing' ? '  ✗' : '  ~'} [${row.where}] ${row.text}`);
  }
}
