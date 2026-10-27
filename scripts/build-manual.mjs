// Genera el manual de uso en PDF a partir de su fuente Markdown, con jsPDF (dependencia del frontend).
// Uso, desde la raíz: node scripts/build-manual.mjs
// Admite el subconjunto de Markdown que usa el manual: #, ##, ###, párrafos, listas "-" y "1.", y **negrita**.
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'frontend', 'package.json'));
const { jsPDF } = require('jspdf');

const SOURCE = path.join(root, 'frontend/public/assets/manual/manual-de-uso.md');
const OUTPUT = path.join(root, 'frontend/public/assets/manual/manual-de-uso-nexodocs.pdf');

const PAGE = { width: 210, height: 297, margin: 20 };
const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2;
const COLORS = { teal: [8, 127, 123], ink: [21, 58, 57], muted: [100, 125, 122], line: [220, 235, 232] };

const doc = new jsPDF({ unit: 'mm', format: 'a4' });
doc.setProperties({ title: 'Manual de uso de NexoDocs', subject: 'Guía para usuarios y administradores', creator: 'NexoDocs' });
let y = PAGE.margin;
const toc = [];

function ensureSpace(height) {
  if (y + height > PAGE.height - PAGE.margin - 8) { doc.addPage(); y = PAGE.margin; }
}

/** Divide un texto con **negrita** en palabras que conservan su estilo. */
function tokens(text) {
  const words = [];
  let previousEndedWithSpace = true;
  text.split(/(\*\*[^*]+\*\*)/).filter(Boolean).forEach((part) => {
    const bold = part.startsWith('**') && part.endsWith('**');
    const clean = bold ? part.slice(2, -2) : part;
    // Un trozo pegado al anterior sin espacio entre ambos (p. ej. la coma tras una negrita) va junto.
    const glued = words.length > 0 && !previousEndedWithSpace && !/^\s/.test(clean);
    clean.split(/(\s+)/).filter((w) => w && !/^\s+$/.test(w)).forEach((w, i) => words.push({ w, bold, glue: glued && i === 0 }));
    previousEndedWithSpace = /\s$/.test(clean);
  });
  return words;
}

/** Escribe un párrafo justificado a la izquierda con negritas en línea; devuelve la altura usada. */
function paragraph(text, { x = PAGE.margin, width = CONTENT_WIDTH, size = 10.5, color = COLORS.ink, lineHeight = 5.2 } = {}) {
  doc.setFontSize(size);
  doc.setTextColor(...color);
  const lines = [];
  let line = [];
  let lineWidth = 0;
  for (const token of tokens(text)) {
    doc.setFont('helvetica', token.bold ? 'bold' : 'normal');
    const w = doc.getTextWidth(token.w);
    const space = line.length && !token.glue ? doc.getTextWidth(' ') : 0;
    if (line.length && lineWidth + space + w > width) { lines.push(line); line = []; lineWidth = 0; }
    line.push({ ...token, width: w });
    lineWidth += (line.length > 1 ? space : 0) + w;
  }
  if (line.length) lines.push(line);
  for (const words of lines) {
    ensureSpace(lineHeight);
    let cursor = x;
    words.forEach((token, i) => {
      doc.setFont('helvetica', token.bold ? 'bold' : 'normal');
      if (i > 0 && !token.glue) cursor += doc.getTextWidth(' ');
      doc.text(token.w, cursor, y);
      cursor += token.width;
    });
    y += lineHeight;
  }
}

function heading(text, level) {
  const sizes = { 2: 16, 3: 12.5 };
  ensureSpace(level === 2 ? 22 : 14);
  if (level === 2) {
    y += 4;
    toc.push({ text, page: doc.getNumberOfPages() });
  } else {
    y += 2;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(sizes[level]);
  doc.setTextColor(...(level === 2 ? COLORS.teal : COLORS.ink));
  doc.text(text, PAGE.margin, y);
  y += level === 2 ? 3 : 1.5;
  if (level === 2) {
    doc.setDrawColor(...COLORS.line);
    doc.setLineWidth(0.4);
    doc.line(PAGE.margin, y, PAGE.width - PAGE.margin, y);
    y += 6;
  } else {
    y += 4.5;
  }
}

function listItem(marker, text) {
  ensureSpace(6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...COLORS.teal);
  doc.text(marker, PAGE.margin + 2, y);
  paragraph(text, { x: PAGE.margin + 8, width: CONTENT_WIDTH - 8 });
  y += 1;
}

function cover(title, subtitle) {
  doc.setFillColor(...COLORS.teal);
  doc.rect(0, 0, PAGE.width, 110, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('NexoDocs', PAGE.margin, 40);
  doc.setFontSize(30);
  doc.text(doc.splitTextToSize(title, CONTENT_WIDTH), PAGE.margin, 70);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text(doc.splitTextToSize(subtitle, CONTENT_WIDTH), PAGE.margin, 95);
  y = 130;
}

const lines = (await readFile(SOURCE, 'utf8')).replace(/\r\n/g, '\n').split('\n');
let buffer = [];
const flush = () => {
  if (!buffer.length) return;
  paragraph(buffer.join(' '));
  y += 2.5;
  buffer = [];
};

const title = lines.find((l) => l.startsWith('# '))?.slice(2) ?? 'Manual de uso';
const subtitleIndex = lines.findIndex((l) => l.startsWith('# ')) + 2;
cover(title, lines[subtitleIndex] ?? '');
let firstSection = true;

for (const [index, raw] of lines.entries()) {
  if (index <= subtitleIndex) continue;
  const line = raw.trimEnd();
  if (!line.trim()) { flush(); continue; }
  if (line.startsWith('## ')) {
    flush();
    if (firstSection) { doc.addPage(); y = PAGE.margin; firstSection = false; }
    heading(line.slice(3), 2);
  } else if (line.startsWith('### ')) { flush(); heading(line.slice(4), 3); }
  else if (/^\s*-\s+/.test(line)) { flush(); listItem('•', line.replace(/^\s*-\s+/, '')); }
  else if (/^\s*\d+\.\s+/.test(line)) { flush(); const [, n, text] = line.match(/^\s*(\d+)\.\s+(.*)$/); listItem(`${n}.`, text); }
  else buffer.push(line.trim());
}
flush();

// Índice en la página 2 (después de la portada), con los números finales de página.
doc.insertPage(2);
doc.setPage(2);
y = PAGE.margin + 6;
doc.setFont('helvetica', 'bold');
doc.setFontSize(18);
doc.setTextColor(...COLORS.teal);
doc.text('Contenido', PAGE.margin, y);
y += 12;
doc.setFontSize(11);
for (const entry of toc) {
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.ink);
  doc.text(entry.text, PAGE.margin, y);
  doc.setTextColor(...COLORS.muted);
  doc.text(String(entry.page + 1), PAGE.width - PAGE.margin, y, { align: 'right' });
  doc.link(PAGE.margin, y - 4, CONTENT_WIDTH, 6, { pageNumber: entry.page + 1 });
  y += 8;
}

const total = doc.getNumberOfPages();
for (let page = 2; page <= total; page++) {
  doc.setPage(page);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.muted);
  doc.text('Manual de uso de NexoDocs', PAGE.margin, PAGE.height - 10);
  doc.text(`${page} / ${total}`, PAGE.width - PAGE.margin, PAGE.height - 10, { align: 'right' });
}

await writeFile(OUTPUT, Buffer.from(doc.output('arraybuffer')));
console.log(`Manual generado: ${path.relative(root, OUTPUT)} (${total} páginas)`);
