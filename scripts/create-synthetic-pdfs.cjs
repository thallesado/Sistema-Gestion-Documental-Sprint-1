const fs = require('fs');
const path = require('path');
const dir = path.resolve('synthetic-pdfs/finocode');
fs.mkdirSync(dir, { recursive: true });

function createMinimalPdf(title) {
  const content = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 55 >>
stream
BT
/F1 18 Tf
50 700 Td
(${title}) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000349 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
434
%%EOF`;
  return Buffer.from(content, 'binary');
}

for (let i = 1; i <= 10; i++) {
  const p = path.join(dir, `documento-sintetico-${i}.pdf`);
  fs.writeFileSync(p, createMinimalPdf(`Documento Sintetico FinoCode ${i}`));
}
console.log('10 synthetic PDFs created successfully in', dir);
