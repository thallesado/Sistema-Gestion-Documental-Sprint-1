import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inside = (root, target) => {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
};
const noCode = (markdown) => markdown.replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1[ \t]*(?:\r?$)/gm, '');
const slug = (heading) => heading.toLowerCase().replace(/<[^>]*>/g, '').replace(/[\x60*_~]/g, '')
  .replace(/[^\p{L}\p{N}\p{M}_\s-]/gu, '').trim().replace(/\s/g, '-');
function anchors(markdown) {
  const seen = new Map();
  return new Set([...noCode(markdown).matchAll(/^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/gm)].map((match) => {
    const base = slug(match[1]);
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    return count ? base + '-' + count : base;
  }));
}
async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory()
    ? markdownFiles(path.join(directory, entry.name))
    : entry.isFile() && entry.name.endsWith('.md') ? [path.join(directory, entry.name)] : []));
  return nested.flat();
}
export async function validateWiki({ root = defaultRoot, includeRemote = false } = {}) {
  root = path.resolve(root);
  const errors = [];
  const notes = [];
  const wiki = path.join(root, 'docs', 'wiki');
  let manifest;
  try {
    manifest = JSON.parse(await readFile(path.join(wiki, 'verification.json'), 'utf8'));
  } catch {
    return { errors: ['No se pudo leer verification.json como JSON.'], notes, pages: 0, contracts: 0 };
  }
  if (!manifest || manifest.schemaVersion !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(manifest.reviewedAt || '')
      || !Array.isArray(manifest.pages) || !Array.isArray(manifest.contracts)) {
    return { errors: ['Estructura o fecha de verification.json inválida.'], notes, pages: 0, contracts: 0 };
  }
  let files;
  try { files = await markdownFiles(wiki); }
  catch { return { errors: ['No se pudo recorrer docs/wiki.'], notes, pages: 0, contracts: 0 }; }
  const declared = new Set(manifest.pages);
  if (declared.size !== manifest.pages.length) errors.push('Páginas duplicadas en el manifiesto.');
  const actual = new Set(files.map((file) => path.relative(wiki, file).split(path.sep).join('/')));
  for (const file of declared) if (!actual.has(file)) errors.push('Página declarada inexistente: ' + file);
  for (const file of actual) if (!declared.has(file)) errors.push('Página sin declarar: ' + file);
  let links = 0;
  for (const file of files) {
    const relative = path.relative(wiki, file);
    const pageKey = relative.split(path.sep).join('/');
    const review = manifest.reviews?.[pageKey];
    const reviewedAt = review?.reviewedAt || manifest.reviewedAt;
    const revisions = review ? [review.revision] : [manifest.localRevision, manifest.remoteRevision];
    const content = await readFile(file, 'utf8');
    if (!/^#\s+/m.test(content)) errors.push(relative + ': falta título.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reviewedAt)
        || !content.includes('Revisión documental: ' + reviewedAt))
      errors.push(relative + ': falta fecha de revisión alineada con manifiesto.');
    if (!revisions.some((revision) => typeof revision === 'string' && content.includes(revision)))
      errors.push(relative + ': falta revisión fuente.');
    for (const match of noCode(content).matchAll(/!?\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+["'][^)]*)?\)/g)) {
      const href = match[1] || match[2];
      if (/^(?:https?:|mailto:|tel:)/i.test(href)) continue;
      if (/^[a-z][a-z0-9+.-]*:/i.test(href)) { errors.push(relative + ': esquema de enlace no permitido.'); continue; }
      let decoded;
      try { decoded = decodeURIComponent(href); }
      catch { errors.push(relative + ': enlace con codificación inválida.'); continue; }
      const split = decoded.indexOf('#');
      const targetPath = (split < 0 ? decoded : decoded.slice(0, split)).split('?')[0];
      const fragment = split < 0 ? '' : decoded.slice(split + 1);
      const target = targetPath ? path.resolve(path.dirname(file), targetPath) : file;
      if (!inside(root, target)) { errors.push(relative + ': enlace fuera del repositorio.'); continue; }
      if (/^\.env(?:\.|$)/i.test(path.basename(target))) { errors.push(relative + ': no enlazar archivos de secretos.'); continue; }
      links++;
      try {
        const info = await stat(target);
        if (fragment && info.isFile() && target.endsWith('.md')
            && !anchors(await readFile(target, 'utf8')).has(fragment)) {
          errors.push(relative + ': anchor inexistente: ' + href);
        }
      } catch { errors.push(relative + ': enlace inexistente: ' + href); }
    }
  }
  let checked = 0;
  let skipped = 0;
  for (const contract of manifest.contracts) {
    if (!contract || !declared.has(contract.page) || typeof contract.path !== 'string'
        || !Array.isArray(contract.includes) || !contract.includes.length
        || contract.includes.some((value) => typeof value !== 'string' || !value)) {
      errors.push('Contrato inválido o sin página declarada.'); continue;
    }
    const target = path.resolve(root, contract.path);
    if (!inside(root, target) || /^\.env(?:\.|$)/i.test(path.basename(target))) {
      errors.push('Fuente de contrato fuera del alcance permitido.'); continue;
    }
    if (contract.revision && !includeRemote) { skipped++; continue; }
    if (contract.revision && !/^[0-9a-f]{7,40}$/i.test(contract.revision)) {
      errors.push('Revisión git inválida.'); continue;
    }
    let content;
    try {
      content = contract.revision
        ? execFileSync('git', ['show', contract.revision + ':' + contract.path], {
          cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 4 * 1024 * 1024,
        })
        : await readFile(target, 'utf8');
    } catch {
      errors.push(contract.page + ': fuente no disponible: ' + contract.path
        + (contract.revision ? ' @ ' + contract.revision : '')); continue;
    }
    checked++;
    if (contract.includes.some((snippet) => !content.includes(snippet))) {
      errors.push(contract.page + ': contrato cambió; revisar documentación y manifiesto: ' + contract.path);
    }
  }
  if (skipped) notes.push(skipped + ' contratos de snapshots remotos omitidos; usar --include-remote para verificarlos.');
  return { errors, notes, pages: files.length, contracts: checked, links };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const unknown = process.argv.slice(2).filter((arg) => arg !== '--include-remote');
  if (unknown.length) {
    process.stderr.write('Argumento no reconocido. Uso: node scripts/validate-wiki.mjs [--include-remote]\n');
    process.exitCode = 1;
  } else {
    const result = await validateWiki({ includeRemote: process.argv.includes('--include-remote') });
    for (const error of result.errors) process.stderr.write('ERROR: ' + error + '\n');
    for (const note of result.notes) process.stdout.write('NOTA: ' + note + '\n');
    process.stdout.write(result.pages + ' páginas, ' + result.contracts + ' contratos, ' + result.links + ' enlaces locales comprobados.\n');
    process.exitCode = result.errors.length ? 1 : 0;
  }
}
