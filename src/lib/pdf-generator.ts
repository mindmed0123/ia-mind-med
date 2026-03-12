import html2pdf from 'html2pdf.js';
import QRCode from 'qrcode';

// =====================================================
// MindMed PDF Engine v2 — Hybrid Architecture
// =====================================================
// Content: Rendered by html2pdf.js (HTML→Canvas→PDF)
// Header/Footer: Drawn by jsPDF on every page post-render
// This ensures proper pagination with fixed page chrome.
// =====================================================

// --- Page geometry (A4 in mm) ---
const PAGE_W = 210;
const PAGE_H = 297;
const HEADER_RESERVE = 28;   // mm reserved at top for jsPDF header
const FOOTER_RESERVE = 20;   // mm reserved at bottom for jsPDF footer
const SIDE_MARGIN = 20;      // mm left/right

// --- Brand colors (RGB) ---
const NAVY: [number, number, number] = [11, 61, 107];
const BLUE: [number, number, number] = [21, 101, 168];
const GOLD: [number, number, number] = [199, 148, 74];
const GOLD_LIGHT: [number, number, number] = [212, 168, 75];
const GRAY: [number, number, number] = [148, 163, 184];
const DARK_GRAY: [number, number, number] = [100, 116, 139];

// --- Types ---
export interface PdfMeta {
  doctorName: string;
  doctorCrm: string;
  doctorCrmUf: string;
  doctorSpecialty: string;
  clinicName: string;
  doctorPhone: string;
  doctorAddress: string;
  hash: string;
  dateFormatted: string;
  timeFormatted: string;
}

interface PdfOptions {
  html: string;
  fileName: string;
  verifyUrl: string;
  pdfMeta?: PdfMeta;
}

// =====================================================
// Gradient bar renderer (simulates CSS gradient)
// =====================================================
function drawGradientBar(doc: any, y: number, height: number): void {
  const segments = 80;
  const segW = PAGE_W / segments;
  for (let i = 0; i < segments; i++) {
    const t = i / segments;
    let r: number, g: number, b: number;
    if (t < 0.35) {
      const p = t / 0.35;
      r = NAVY[0] + (BLUE[0] - NAVY[0]) * p;
      g = NAVY[1] + (BLUE[1] - NAVY[1]) * p;
      b = NAVY[2] + (BLUE[2] - NAVY[2]) * p;
    } else if (t < 0.65) {
      const p = (t - 0.35) / 0.3;
      r = BLUE[0] + (GOLD[0] - BLUE[0]) * p;
      g = BLUE[1] + (GOLD[1] - BLUE[1]) * p;
      b = BLUE[2] + (GOLD[2] - BLUE[2]) * p;
    } else {
      const p = (t - 0.65) / 0.35;
      r = GOLD[0] + (GOLD_LIGHT[0] - GOLD[0]) * p;
      g = GOLD[1] + (GOLD_LIGHT[1] - GOLD[1]) * p;
      b = GOLD[2] + (GOLD_LIGHT[2] - GOLD[2]) * p;
    }
    doc.setFillColor(Math.round(r), Math.round(g), Math.round(b));
    doc.rect(i * segW, y, segW + 0.5, height, 'F');
  }
}

// =====================================================
// Header renderer (called on every page)
// =====================================================
function renderHeader(doc: any, meta: PdfMeta): void {
  // 1. Gold accent bar at very top
  drawGradientBar(doc, 0, 2);

  // 2. Logo "M" badge
  const logoX = SIDE_MARGIN;
  const logoY = 5;
  const logoSize = 9;
  doc.setFillColor(...NAVY);
  doc.roundedRect(logoX, logoY, logoSize, logoSize, 1.8, 1.8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('M', logoX + logoSize / 2, logoY + 6.8, { align: 'center' });

  // 3. Clinic / brand name
  doc.setTextColor(...NAVY);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(meta.clinicName || 'MindMed', logoX + logoSize + 3.5, logoY + 4.5);

  doc.setFontSize(5);
  doc.setTextColor(...GRAY);
  doc.setFont('helvetica', 'normal');
  doc.text(
    meta.clinicName ? 'Powered by MindMed AI' : 'Laudos Médicos Inteligentes',
    logoX + logoSize + 3.5,
    logoY + 8
  );

  // 4. Doctor info (right-aligned)
  const rightX = PAGE_W - SIDE_MARGIN;
  doc.setTextColor(...NAVY);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`Dr(a). ${meta.doctorName}`, rightX, logoY + 4, { align: 'right' });

  if (meta.doctorCrm) {
    doc.setTextColor(...BLUE);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `CRM ${meta.doctorCrm}${meta.doctorCrmUf ? '/' + meta.doctorCrmUf : ''}`,
      rightX, logoY + 7.5, { align: 'right' }
    );
  }

  if (meta.doctorSpecialty) {
    doc.setTextColor(...DARK_GRAY);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.text(meta.doctorSpecialty, rightX, logoY + 10.5, { align: 'right' });
  }

  // 5. Separator line (simulated gradient)
  const lineY = 18;
  const midX = PAGE_W * 0.5;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.4);
  doc.line(SIDE_MARGIN, lineY, midX, lineY);
  doc.setDrawColor(203, 213, 225);
  doc.line(midX, lineY, PAGE_W - SIDE_MARGIN, lineY);
}

// =====================================================
// Footer renderer (called on every page)
// =====================================================
function renderFooter(doc: any, meta: PdfMeta, pageNum: number, totalPages: number): void {
  const footerTop = PAGE_H - FOOTER_RESERVE;

  // 1. Separator line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.25);
  doc.line(SIDE_MARGIN, footerTop, PAGE_W - SIDE_MARGIN, footerTop);

  // 2. Left column: branding + legal
  doc.setTextColor(...DARK_GRAY);
  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Emitido via MindMed AI', SIDE_MARGIN, footerTop + 4);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text('Documento protegido pela LGPD (Lei nº 13.709/2018)', SIDE_MARGIN, footerTop + 7);
  doc.text(`Gerado em ${meta.dateFormatted} às ${meta.timeFormatted}`, SIDE_MARGIN, footerTop + 10);

  // 3. Right column: hash + page number
  const rightX = PAGE_W - SIDE_MARGIN;
  doc.setFontSize(5);
  doc.setTextColor(...GRAY);
  doc.text('Verificação Digital', rightX, footerTop + 4, { align: 'right' });
  doc.setFont('courier', 'normal');
  doc.setFontSize(4.5);
  doc.text(meta.hash.substring(0, 32) + '...', rightX, footerTop + 7, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...DARK_GRAY);
  doc.text(`Página ${pageNum} de ${totalPages}`, rightX, footerTop + 10, { align: 'right' });

  // 4. Bottom accent bar
  drawGradientBar(doc, PAGE_H - 2, 2);
}

// =====================================================
// Main PDF generation function
// =====================================================
export const generatePdf = async ({ html, fileName, verifyUrl, pdfMeta }: PdfOptions): Promise<Blob> => {
  try {
    // 1. Generate QR Code
    const qrCodeDataUrl = await QRCode.toDataURL(verifyUrl, {
      width: 150,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' }
    });

    // 2. Replace QR placeholder in HTML
    const htmlWithQr = html.replace(
      '📱 [QR Code seria gerado aqui]',
      `<img src="${qrCodeDataUrl}" alt="QR Code de Verificação" style="max-width:150px;margin:10px auto;display:block;" />`
    );

    // 3. html2pdf options with reserved margins for header/footer
    const options = {
      margin: [HEADER_RESERVE, SIDE_MARGIN, FOOTER_RESERVE, SIDE_MARGIN] as [number, number, number, number],
      filename: fileName,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: {
        scale: 2.5,
        useCORS: true,
        logging: false,
        letterRendering: true,
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait' as const,
        compress: true,
      },
      pagebreak: {
        mode: ['avoid-all', 'css'] as string[],
      },
    };

    // 4. Generate PDF: HTML content → canvas → pages
    const worker = html2pdf().set(options).from(htmlWithQr);
    const pdfDoc = await new Promise<any>((resolve, reject) => {
      worker.toPdf().get('pdf').then((pdf: any) => {
        resolve(pdf);
      }).catch(reject);
    });

    // 5. Post-process: draw header & footer on every page
    if (pdfMeta) {
      const totalPages = pdfDoc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdfDoc.setPage(i);
        renderHeader(pdfDoc, pdfMeta);
        renderFooter(pdfDoc, pdfMeta, i, totalPages);
      }
    }

    // 6. Output as blob
    return pdfDoc.output('blob');
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    throw new Error('Falha na geração do PDF');
  }
};

// =====================================================
// Download helper
// =====================================================
export const downloadPdf = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// =====================================================
// Upload to storage
// =====================================================
export const uploadPdfToStorage = async (
  blob: Blob,
  filePath: string,
  supabase: any
): Promise<string> => {
  try {
    const { error: uploadError } = await supabase.storage
      .from('audio-files')
      .upload(filePath, blob, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data: urlData, error: urlError } = await supabase.storage
      .from('audio-files')
      .createSignedUrl(filePath, 7 * 24 * 60 * 60);

    if (urlError) throw urlError;

    return urlData.signedUrl;
  } catch (error) {
    console.error('Erro ao fazer upload do PDF:', error);
    throw new Error('Falha no upload do PDF');
  }
};
