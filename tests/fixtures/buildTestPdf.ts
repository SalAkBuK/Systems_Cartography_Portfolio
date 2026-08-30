/**
 * Constructs a minimal, real, pdfjs-parseable PDF containing a recognizable
 * LinkedIn-export-shaped layout (two columns split at ~35% page width, per
 * `extractPdfColumnsFromBytes`'s sidebar/main heuristic). Used by tests that
 * need to exercise the actual `/api/upload-pdf` HTTP + PDF-parsing path,
 * rather than mocking it.
 *
 * NOTE: pdfjs takes ownership of the underlying buffer it is given, so a
 * fresh call to this builder is required for each separate parse -- reusing
 * the same Uint8Array across two `parseLinkedInPdfBytes` calls fails.
 */
function escapePdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

export function buildMinimalLinkedInPdf(
  mainLines: string[] = [
    'Jordan Candidate',
    'Full-stack Web Development Student',
    'Lorton, Virginia, United States',
    'Education',
    'The George Washington University',
    'Full-stack Web Development',
    'University of Portsmouth',
    'Bachelor of Science in Computing'
  ],
  sidebarLines: string[] = [
    'Contact',
    'jordan.candidate@example.com',
    'www.linkedin.com/in/jordan-',
    'candidate (LinkedIn)',
    'Top Skills',
    'Software Projects',
    'IT Projects',
    'Certifications',
    'Certificate in Programming'
  ]
): Uint8Array {
  const startY = 740;
  const lineHeight = 20;
  let ops = '';
  mainLines.forEach((line, i) => {
    ops += `1 0 0 1 250 ${startY - i * lineHeight} Tm (${escapePdfText(line)}) Tj\n`;
  });
  sidebarLines.forEach((line, i) => {
    ops += `1 0 0 1 50 ${startY - i * lineHeight} Tm (${escapePdfText(line)}) Tj\n`;
  });
  const content = `BT\n/F1 10 Tf\n${ops}ET`;

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((obj, idx) => {
    offsets.push(pdf.length);
    pdf += `${idx + 1} 0 obj\n${obj}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    xref += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  }
  pdf += xref;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Uint8Array(Buffer.from(pdf, 'latin1'));
}
