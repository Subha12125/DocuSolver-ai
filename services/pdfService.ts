import { jsPDF } from 'jspdf';
import { QAPair } from '../types';

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

const svgToImageBase64 = (svgStr: string): Promise<string> => {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      if (!svgStr.includes('xmlns="http://www.w3.org/2000/svg"')) {
        svgStr = svgStr.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const width = (img.width && img.width > 0) ? img.width : 600;
        const height = (img.height && img.height > 0) ? img.height : 400;
        const scale = 2;
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) { URL.revokeObjectURL(url); resolve(''); return; }
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.95));
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(''); };
      img.src = url;
    } catch { resolve(''); }
  });
};

interface PDFGenerationResult {
  doc: jsPDF;
  errors: string[];
}

const createAnswerPDFDoc = async (qaPairs: QAPair[]): Promise<PDFGenerationResult> => {
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', putOnlyUsedFonts: true });
  const errors: string[] = [];

  const processedDiagrams = await Promise.all(
    qaPairs.map(p => (p.diagram && !p.image) ? svgToImageBase64(p.diagram) : Promise.resolve(null))
  );

  const M = 18;
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const CW = PW - M * 2;
  let Y = M;

  const pageBreak = (h: number) => {
    if (Y + h > PH - 18) { doc.addPage(); Y = M; return true; }
    return false;
  };

  // ===== TITLE BAR =====
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, PW, 22, 'F');
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("DocuSolver AI \u2014 Answer Key", M, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(200, 220, 255);
  doc.text(`Generated: ${new Date().toLocaleDateString()}  \u2022  ${qaPairs.length} Questions`, PW - M, 14, { align: 'right' });
  Y = 30;

  // ===== QUESTIONS =====
  for (let qi = 0; qi < qaPairs.length; qi++) {
    const pair = qaPairs[qi];
    pageBreak(45);

    // --- Question badge bar ---
    doc.setFillColor(238, 242, 255);
    doc.setDrawColor(199, 210, 254);
    doc.setLineWidth(0.4);
    doc.roundedRect(M, Y - 4, CW, 10, 2, 2, 'FD');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(67, 56, 202);
    doc.text(`Q${qi + 1}.`, M + 4, Y + 2.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    const qText = pair.question.replace(/\s+/g, ' ').replace(/\[Visual Description:?\s*(.*?)\]/i, '').trim();
    const qLines = doc.splitTextToSize(qText, CW - 18);
    let qy = Y + 2.5;
    qLines.forEach((l: string, i: number) => {
      if (i === 0) { doc.text(l, M + 14, qy); }
      else { qy += 5.5; pageBreak(6); doc.text(l, M + 4, qy); }
    });
    Y += Math.max(10, qLines.length * 5.5 + 4);

    // --- Image/Diagram ---
    let imgUrl: string | null = null;
    let imgType = 'PNG';
    if (pair.image && pair.image.startsWith('data:image')) {
      imgUrl = pair.image;
      if (pair.image.includes('image/jpeg')) imgType = 'JPEG';
    } else if (processedDiagrams[qi]) {
      imgUrl = processedDiagrams[qi];
      imgType = 'JPEG';
    }
    if (imgUrl) {
      try {
        const p = doc.getImageProperties(imgUrl);
        if (p.width > 0 && p.height > 0) {
          const r = p.width / p.height;
          let pw = Math.min(CW * 0.5, 90), ph = pw / r;
          if (ph > 70) { ph = 70; pw = ph * r; }
          pageBreak(ph + 8); Y += 3;
          doc.addImage(imgUrl, imgType, M, Y, pw, ph);
          Y += ph + 4;
        }
      } catch (e: any) { errors.push(`Q${qi + 1}: Image failed`); }
    }

    // --- ANSWER BADGE ---
    Y += 2;
    pageBreak(10);
    doc.setFillColor(37, 99, 235);
    doc.roundedRect(M, Y - 3.5, 22, 7, 1.5, 1.5, 'F');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text("ANSWER", M + 2.5, Y + 1);
    Y += 8;

    // --- ANSWER BODY ---
    const clean = pair.answer.replace(/\*\*/g, '').replace(/###|##|#/g, '').replace(/`/g, '');
    const ansLines = clean.split(/\r?\n/);
    // No 'Concept' — just direct answer sections
    const sectionRx = /^(Step \d+|Method \d+|Note|Explanation|Solution|Analysis|Given|Find|Conclusion|Summary|Final Answer|Formula|Calculation|Result):\s*(.*)/i;

    for (let li = 0; li < ansLines.length; li++) {
      const line = ansLines[li].trim();
      if (!line) { if (Y > M + 10) Y += 3; continue; }
      if (/^[\-=+|_]{3,}$/.test(line)) continue;

      // --- Section Header Card ---
      const hm = line.match(sectionRx);
      if (hm) {
        const label = hm[1], body = hm[2] || '';
        const hl = label.toLowerCase();
        Y += 2; pageBreak(12);

        let fR = 248, fG = 250, fB = 252, bR = 226, bG = 232, bB = 240, lR = 15, lG = 23, lB = 42;
        if (hl.includes('conclusion') || hl.includes('final') || hl.includes('result')) {
          fR = 236; fG = 253; fB = 245; bR = 134; bG = 239; bB = 172; lR = 5; lG = 102; lB = 68;
        } else if (hl === 'formula') {
          fR = 255; fG = 251; fB = 235; bR = 253; bG = 224; bB = 71; lR = 146; lG = 64; lB = 14;
        } else if (hl === 'calculation') {
          fR = 240; fG = 249; fB = 255; bR = 125; bG = 211; bB = 252; lR = 3; lG = 105; lB = 161;
        } else if (hl.includes('given') || hl.includes('find')) {
          fR = 239; fG = 246; fB = 255; bR = 147; bG = 197; bB = 253; lR = 29; lG = 78; lB = 216;
        } else if (hl.includes('step') || hl.includes('method')) {
          fR = 245; fG = 243; fB = 255; bR = 196; bG = 181; bB = 253; lR = 109; lG = 40; lB = 217;
        }

        doc.setFontSize(10);
        const bodyLines = body ? doc.splitTextToSize(body, CW - 8) : [];
        const cardH = Math.max(9, bodyLines.length * 5 + 7);

        doc.setFillColor(fR, fG, fB);
        doc.setDrawColor(bR, bG, bB);
        doc.setLineWidth(0.4);
        doc.roundedRect(M, Y - 3, CW, cardH, 2, 2, 'FD');

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(lR, lG, lB);
        doc.text(label.toUpperCase() + ":", M + 4, Y + 1.5);

        if (body) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          doc.setTextColor(30, 41, 59);
          const lw = doc.getTextWidth(label.toUpperCase() + ":  ");
          bodyLines.forEach((bl: string, bi: number) => {
            if (bi === 0) doc.text(bl, M + 4 + lw, Y + 1.5);
            else { Y += 5; doc.text(bl, M + 4, Y + 1.5); }
          });
        }
        Y += cardH;
        continue;
      }

      // --- Bullet Points ---
      const bm = line.match(/^([-\u2022*]|\d+[.):]|\([a-z0-9]+\)|[a-z]\.)\s+(.*)/i);
      if (bm) {
        const marker = bm[1], text = bm[2];
        pageBreak(7);
        if (marker === '-' || marker === '\u2022' || marker === '*') {
          doc.setFillColor(100, 116, 139);
          doc.circle(M + 3, Y - 1.2, 0.8, 'F');
        } else {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(100, 116, 139);
          doc.text(marker, M + 1, Y);
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(51, 65, 85);
        const bl = doc.splitTextToSize(text, CW - 12);
        bl.forEach((b: string, bi: number) => {
          if (bi > 0) pageBreak(5.5);
          doc.text(b, M + 8, Y);
          Y += 5.5;
        });
        continue;
      }

      // --- Regular text ---
      pageBreak(6);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      const wl = doc.splitTextToSize(line, CW - 2);
      wl.forEach((w: string, wi: number) => {
        if (wi > 0) pageBreak(5.5);
        doc.text(w, M + 2, Y);
        Y += 5.5;
      });
    }

    Y += 6;
    if (qi < qaPairs.length - 1) {
      pageBreak(10);
      doc.setDrawColor(200, 210, 225);
      doc.setLineWidth(0.3);
      doc.setLineDashPattern([3, 2], 0);
      doc.line(M + 20, Y, PW - M - 20, Y);
      doc.setLineDashPattern([], 0);
      Y += 8;
    }
  }

  // ===== FOOTER =====
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(160);
    doc.text(`Page ${p} of ${pages}`, PW / 2, PH - 8, { align: 'center' });
    doc.text('DocuSolver AI', M, PH - 8);
  }

  return { doc, errors };
};

// Direct jsPDF rendering — no html2canvas needed
export const generateAnswerPDF = async (qaPairs: QAPair[]): Promise<string[]> => {
  try {
    const { doc, errors } = await createAnswerPDFDoc(qaPairs);
    const filename = `docusolver-solution-key-${new Date().toISOString().substring(0, 10)}.pdf`;
    doc.save(filename);
    return errors;
  } catch (err: any) {
    console.error("PDF generation failed:", err);
    window.print();
    return ["Generated using native print fallback"];
  }
};

export const openPDFPreview = async (qaPairs: QAPair[]): Promise<string[]> => {
  try {
    const { doc, errors } = await createAnswerPDFDoc(qaPairs);
    const pdfBlob = doc.output('blob');
    const blobUrl = URL.createObjectURL(pdfBlob);

    const win = window.open(blobUrl, '_blank');
    if (!win) {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `docusolver-preview-${new Date().toISOString().substring(0, 10)}.pdf`;
      a.click();
    }

    return errors;
  } catch (err: any) {
    console.error("Preview failed:", err);
    window.print();
    return ["Opened native print preview session."];
  }
};
