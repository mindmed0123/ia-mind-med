import { normalizeDocumentFormat, type DocumentFormat } from '../../supabase/functions/_shared/document-format';
import html2pdf from 'html2pdf.js';
import QRCode from 'qrcode';

import { formatDoctorTitle } from './doctor-title';
export { formatDoctorTitle };

// =====================================================
// MindMed PDF Engine v4 — Fast & Premium
// =====================================================

const PAGE_W = 210;
const PAGE_H = 297;
const HEADER_RESERVE = 30;
const FOOTER_RESERVE = 18;
const SIDE_MARGIN = 18;

const NAVY: [number, number, number] = [11, 61, 107];
const BLUE: [number, number, number] = [21, 101, 168];
const GOLD: [number, number, number] = [199, 148, 74];
const GRAY: [number, number, number] = [148, 163, 184];
const DARK_GRAY: [number, number, number] = [100, 116, 139];

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
  documentFormat?: DocumentFormat;
  logoUrl?: string | null;
  letterheadUrl?: string | null;
  /** 'CRP' muda o rótulo do registro e tira o "Dr(a)." nos PDFs vetoriais. */
  conselho?: string | null;
}

interface PdfOptions {
  html: string;
  fileName: string;
  verifyUrl: string;
  pdfMeta?: PdfMeta;
  documentFormat?: DocumentFormat;
  letterheadUrl?: string | null;
}

// ── Gradient bar (simplified — fewer segments for speed) ──
function drawGradientBar(doc: any, y: number, height: number): void {
  const segments = 40;
  const segW = PAGE_W / segments;
  for (let i = 0; i < segments; i++) {
    const t = i / segments;
    let r: number, g: number, b: number;
    if (t < 0.5) {
      const p = t / 0.5;
      r = NAVY[0] + (BLUE[0] - NAVY[0]) * p;
      g = NAVY[1] + (BLUE[1] - NAVY[1]) * p;
      b = NAVY[2] + (BLUE[2] - NAVY[2]) * p;
    } else {
      const p = (t - 0.5) / 0.5;
      r = BLUE[0] + (GOLD[0] - BLUE[0]) * p;
      g = BLUE[1] + (GOLD[1] - BLUE[1]) * p;
      b = BLUE[2] + (GOLD[2] - BLUE[2]) * p;
    }
    doc.setFillColor(Math.round(r), Math.round(g), Math.round(b));
    doc.rect(i * segW, y, segW + 0.5, height, 'F');
  }
}

// ── Header ──
function renderHeader(doc: any, meta: PdfMeta): void {
  drawGradientBar(doc, 0, 1.5);

  const logoX = SIDE_MARGIN;
  const logoY = 5;
  const logoSize = 10;
  doc.setFillColor(...NAVY);
  doc.roundedRect(logoX, logoY, logoSize, logoSize, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('M', logoX + logoSize / 2, logoY + 7.2, { align: 'center' });

  doc.setTextColor(...NAVY);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(meta.clinicName || 'MindMed', logoX + logoSize + 4, logoY + 5);
  
  doc.setFontSize(5.5);
  doc.setTextColor(...GRAY);
  doc.setFont('helvetica', 'normal');
  doc.text(
    meta.clinicName ? 'Powered by MindMed AI' : 'Laudos Médicos Inteligentes',
    logoX + logoSize + 4,
    logoY + 9
  );

  const rightX = PAGE_W - SIDE_MARGIN;
  doc.setTextColor(...NAVY);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(formatDoctorTitle(meta.doctorName), rightX, logoY + 4.5, { align: 'right' });

  if (meta.doctorCrm) {
    doc.setTextColor(...BLUE);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `CRM ${meta.doctorCrm}${meta.doctorCrmUf ? '/' + meta.doctorCrmUf : ''}`,
      rightX, logoY + 8.5, { align: 'right' }
    );
  }

  if (meta.doctorSpecialty) {
    doc.setTextColor(...DARK_GRAY);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(meta.doctorSpecialty, rightX, logoY + 12, { align: 'right' });
  }

  if (meta.doctorAddress) {
    doc.setFontSize(6); doc.setFont('helvetica','normal');
    doc.text(doc.splitTextToSize(meta.doctorAddress, PAGE_W - 2 * SIDE_MARGIN).slice(0,2), SIDE_MARGIN, 24);
  }
  const lineY = 20;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.5);
  doc.line(SIDE_MARGIN, lineY, PAGE_W / 2, lineY);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(PAGE_W / 2, lineY, PAGE_W - SIDE_MARGIN, lineY);
}

// ── Footer ──
function renderFooter(doc: any, meta: PdfMeta, pageNum: number, totalPages: number): void {
  const footerTop = PAGE_H - FOOTER_RESERVE;

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.line(SIDE_MARGIN, footerTop, PAGE_W - SIDE_MARGIN, footerTop);

  doc.setTextColor(...DARK_GRAY);
  doc.setFontSize(5);
  doc.setFont('helvetica', 'normal');
  doc.text('Documento com auxílio de IA · Revisão profissional · LGPD', SIDE_MARGIN, footerTop + 4);
  doc.setTextColor(...GRAY);
  doc.setFontSize(4.5);
  doc.text(`${meta.dateFormatted} às ${meta.timeFormatted}`, SIDE_MARGIN, footerTop + 7);

  const rightX = PAGE_W - SIDE_MARGIN;
  doc.setFont('courier', 'normal');
  doc.setFontSize(4);
  doc.setTextColor(...GRAY);
  doc.setFontSize(3);
  doc.text(meta.hash, rightX, footerTop + 4, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...DARK_GRAY);
  doc.text(`${pageNum}/${totalPages}`, rightX, footerTop + 7.5, { align: 'right' });

  drawGradientBar(doc, PAGE_H - 1.5, 1.5);
}

// ── QR code cache ──
const qrCache = new Map<string, string>();

async function getQrDataUrl(url: string): Promise<string> {
  const cached = qrCache.get(url);
  if (cached) return cached;
  const dataUrl = await QRCode.toDataURL(url, {
    width: 120, margin: 1,
    color: { dark: '#000000', light: '#ffffff' }
  });
  qrCache.set(url, dataUrl);
  return dataUrl;
}

// ── Main Generator (optimized for speed) ──
export const generatePdf = async ({ html, fileName, verifyUrl, pdfMeta, documentFormat, letterheadUrl }: PdfOptions): Promise<Blob> => {
  try {
    const placeholder = '📱 [QR Code seria gerado aqui]';
    let htmlWithQr = html;
    if (verifyUrl && html.includes(placeholder)) {
      const qrCodeDataUrl = await getQrDataUrl(verifyUrl);
      const imgTag = `<img src="${qrCodeDataUrl}" alt="QR Code" style="max-width:100px;display:block;" />`;
      htmlWithQr = html.split(placeholder).join(imgTag);
    } else if (html.includes(placeholder)) {
      // Sem URL: remove o placeholder para não vazar texto
      htmlWithQr = html.split(placeholder).join('');
    }

    const format = normalizeDocumentFormat(documentFormat || pdfMeta?.documentFormat);
    const options = {
      margin: [format.margem_superior, format.margem_lateral, format.margem_inferior, format.margem_lateral] as [number, number, number, number],
      filename: fileName,
      image: { type: 'jpeg' as const, quality: 0.85 },
      html2canvas: {
        scale: 1.5,
        useCORS: true,
        logging: false,
        letterRendering: false,
        imageTimeout: 5000,
        removeContainer: true,
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait' as const,
        compress: true,
      },
      pagebreak: {
        mode: ['css', 'legacy'] as string[],
      },
    };

    const worker = html2pdf().set(options).from(htmlWithQr);
    const pdfDoc = await new Promise<any>((resolve, reject) => {
      worker.toPdf().get('pdf').then((pdf: any) => resolve(pdf)).catch(reject);
    });

    if (pdfMeta) {
      const totalPages = pdfDoc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdfDoc.setPage(i);
        if (format.cabecalho) renderHeader(pdfDoc, pdfMeta);
        if (format.rodape) renderFooter(pdfDoc, pdfMeta, i, totalPages);
      }
    }

    const loadImage = async (url: string) => {
      const image = new Image(); image.crossOrigin = 'anonymous'; image.src = url;
      await image.decode();
      const canvas = document.createElement('canvas'); canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
      const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Imagem indisponível');ctx.drawImage(image,0,0);
      return canvas.toDataURL('image/png');
    };
    if (format.logo && pdfMeta?.logoUrl) {
      const logo = await loadImage(pdfMeta.logoUrl);
      for(let i=1;i<=pdfDoc.internal.getNumberOfPages();i++){pdfDoc.setPage(i);pdfDoc.addImage(logo,'PNG',SIDE_MARGIN,5,10,10);}
    }
    const letterhead = letterheadUrl || pdfMeta?.letterheadUrl;
    if(letterhead){
      const image = await loadImage(letterhead);
      for(let i=1;i<=pdfDoc.internal.getNumberOfPages();i++){pdfDoc.setPage(i);pdfDoc.saveGraphicsState();pdfDoc.setGState(new pdfDoc.GState({opacity:0.12}));pdfDoc.addImage(image,'PNG',0,0,PAGE_W,PAGE_H);pdfDoc.restoreGraphicsState();}
    }
    return pdfDoc.output('blob');
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    throw new Error('Falha na geração do PDF');
  }
};

// ── Download helper ──
export const downloadPdf = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// ── Upload to storage ──
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
