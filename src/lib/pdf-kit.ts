/**
 * MindMed — base visual dos PDFs vetoriais (laudo, registro de sessão e receita).
 * Cores, fontes, cabeçalho com a marca e rodapé com página/hash ficam aqui
 * para que todos os documentos saiam com a mesma cara.
 */
import { jsPDF } from 'jspdf';
import mindmedMark from '@/assets/mindmed-logo-mark.png';
import { normalizeDocumentFormat, type DocumentFormat } from '../../supabase/functions/_shared/document-format';
import type { PdfMeta } from '@/lib/pdf-generator';
import { formatDoctorTitle } from '@/lib/doctor-title';

export type RGB = [number, number, number];
export const C = {
  ink: [15, 23, 42] as RGB,
  body: [51, 65, 85] as RGB,
  muted: [100, 116, 139] as RGB,
  subtle: [148, 163, 184] as RGB,
  line: [226, 232, 240] as RGB,
  navy: [11, 42, 91] as RGB,
  blue: [15, 69, 179] as RGB,
  cyan: [0, 190, 240] as RGB,
  cyanDark: [3, 132, 199] as RGB,
  tint: [244, 247, 253] as RGB,
  blueTint: [231, 239, 253] as RGB,
  cyanTint: [230, 248, 254] as RGB,
  white: [255, 255, 255] as RGB,
  warnBg: [255, 247, 230] as RGB,
  warn: [217, 119, 6] as RGB,
  warnText: [146, 64, 14] as RGB,
  redBg: [254, 242, 242] as RGB,
  red: [185, 28, 28] as RGB,
};

export const PAGE_W = 210;
export const PAGE_H = 297;
export const PT = 0.3528; // mm por ponto

// ── Fontes ───────────────────────────────────────────────
const FONT_FILES: Record<string, string> = {
  Inter: 'Inter-Regular.ttf',
  InterSemi: 'Inter-SemiBold.ttf',
  InterBold: 'Inter-Bold.ttf',
  Merri: 'Merriweather-Regular.ttf',
  MerriBold: 'Merriweather-Bold.ttf',
};
const fontCache = new Map<string, Promise<string | null>>();

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function loadFont(name: string): Promise<string | null> {
  if (!fontCache.has(name)) {
    fontCache.set(
      name,
      fetch(`/fonts/pdf/${FONT_FILES[name]}`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('font'))))
        .then(toBase64)
        .catch(() => {
          fontCache.delete(name);
          return null;
        }),
    );
  }
  return fontCache.get(name)!;
}

export type Role = 'body' | 'semi' | 'bold' | 'display';
type FontSpec = Record<Role, [string, string]>;

async function setupFonts(doc: jsPDF, fonte: DocumentFormat['fonte']): Promise<FontSpec> {
  const helvetica: FontSpec = { body: ['helvetica', 'normal'], semi: ['helvetica', 'bold'], bold: ['helvetica', 'bold'], display: ['helvetica', 'bold'] };
  if (fonte === 'Arial') return helvetica;
  if (fonte === 'Times New Roman') return { body: ['times', 'normal'], semi: ['times', 'bold'], bold: ['times', 'bold'], display: ['times', 'bold'] };
  const wanted = fonte === 'Merriweather' ? ['Merri', 'InterSemi', 'InterBold', 'MerriBold'] : ['Inter', 'InterSemi', 'InterBold', 'MerriBold'];
  const data = await Promise.all(wanted.map(loadFont));
  if (data.some((d) => !d)) return helvetica;
  wanted.forEach((name, i) => {
    doc.addFileToVFS(FONT_FILES[name], data[i]!);
    doc.addFont(FONT_FILES[name], name, 'normal');
  });
  return { body: [wanted[0], 'normal'], semi: [wanted[1], 'normal'], bold: [wanted[2], 'normal'], display: [wanted[3], 'normal'] };
}

// ── Imagens ──────────────────────────────────────────────
export async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function imageToPng(url: string): Promise<{ data: string; ratio: number } | null> {
  try {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0);
    return { data: canvas.toDataURL('image/png'), ratio: image.naturalWidth / Math.max(1, image.naturalHeight) };
  } catch {
    return null;
  }
}

// ── Profissional ─────────────────────────────────────────
export const isPsicologia = (meta?: PdfMeta | null) => meta?.conselho === 'CRP';

/** Nome do profissional como sai no documento (psicólogos sem "Dr(a)."). */
export function professionalName(meta?: PdfMeta | null): string {
  if (isPsicologia(meta)) return (meta?.doctorName || 'Psicólogo(a) responsável').trim();
  return formatDoctorTitle(meta?.doctorName || 'Médico responsável');
}

/** "CRM 123456/SP" ou "CRP 06/123456". */
export function registroLabel(meta?: PdfMeta | null): string {
  const num = (meta?.doctorCrm || '').trim();
  if (!num) return '';
  const uf = (meta?.doctorCrmUf || '').trim();
  if (isPsicologia(meta)) return `CRP ${num}${uf && !num.includes('/') ? ' · ' + uf : ''}`;
  return `CRM ${num}${uf ? '/' + uf : ''}`;
}

// ── Kit de desenho ───────────────────────────────────────
export async function createPdfKit(meta?: PdfMeta | null) {
  const format = normalizeDocumentFormat(meta?.documentFormat);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const F = await setupFonts(doc, format.fonte);

  const [markData, clinicLogo, letterhead] = await Promise.all([
    urlToDataUrl(mindmedMark),
    format.logo && meta?.logoUrl ? imageToPng(meta.logoUrl) : Promise.resolve(null),
    meta?.letterheadUrl ? imageToPng(meta.letterheadUrl) : Promise.resolve(null),
  ]);

  const M = format.margem_lateral;
  const W = PAGE_W - 2 * M;
  const TOP = format.cabecalho ? Math.max(format.margem_superior, 32) : format.margem_superior;
  const BOTTOM = PAGE_H - (format.rodape ? Math.max(format.margem_inferior, 20) : Math.max(format.margem_inferior, 12));
  const BODY = Math.max(8, Math.min(12, format.corpo * 0.92));

  const font = (role: Role, size: number, color: RGB = C.body) => {
    doc.setFont(F[role][0], F[role][1]);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  const lh = (size: number, factor = 1.5) => size * PT * factor;
  const asc = (size: number) => size * PT * 0.78;
  const split = (text: string, width: number): string[] => doc.splitTextToSize(text, width) as string[];
  const upper = (t: string) => t.toLocaleUpperCase('pt-BR');
  const fill = (c: RGB) => doc.setFillColor(...c);
  const stroke = (c: RGB, w = 0.3) => {
    doc.setDrawColor(...c);
    doc.setLineWidth(w);
  };
  /** Reduz o corpo da fonte até o texto caber na largura. */
  const fit = (text: string, role: Role, start: number, min: number, maxW: number) => {
    let size = start;
    font(role, size);
    while (size > min && doc.getTextWidth(text) > maxW) {
      size -= 0.25;
      doc.setFontSize(size);
    }
    return size;
  };
  /** Corta com reticências o que não cabe numa linha. */
  const ellipsis = (text: string, maxW: number) => {
    if (doc.getTextWidth(text) <= maxW) return text;
    let t = text;
    while (t.length > 3 && doc.getTextWidth(t + '…') > maxW) t = t.slice(0, -1);
    return t + '…';
  };
  const eyebrow = (text: string, x: number, yy: number, color: RGB, size = 6.4) => {
    font('semi', size, color);
    doc.text(upper(text), x, yy, { charSpace: 0.35 });
  };

  const gradientBar = (y: number, h: number) => {
    const steps = 48;
    const segW = PAGE_W / steps;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      fill([0, 1, 2].map((k) => Math.round(C.blue[k] + (C.cyan[k] - C.blue[k]) * t)) as RGB);
      doc.rect(i * segW, y, segW + 0.3, h, 'F');
    }
  };

  const drawLetterhead = () => {
    if (!letterhead) return;
    const anyDoc = doc as unknown as { GState: new (o: { opacity: number }) => unknown; setGState: (g: unknown) => void };
    doc.saveGraphicsState();
    anyDoc.setGState(new anyDoc.GState({ opacity: 0.12 }));
    doc.addImage(letterhead.data, 'PNG', 0, 0, PAGE_W, PAGE_H);
    doc.restoreGraphicsState();
  };

  const drawHeader = () => {
    if (!format.cabecalho) return;
    gradientBar(0, 1.6);
    const y0 = 8;
    let textX = M;
    if (clinicLogo) {
      const h = 11;
      const w = Math.min(28, h * clinicLogo.ratio);
      doc.addImage(clinicLogo.data, 'PNG', M, y0, w, h);
      textX = M + w + 3.5;
    } else if (format.logo && markData) {
      doc.addImage(markData, 'PNG', M, y0, 11, 11);
      textX = M + 14;
    }
    const brand = meta?.clinicName?.trim() || 'MindMed';
    fit(brand, 'display', 14, 9, PAGE_W / 2 - textX);
    doc.setTextColor(...C.navy);
    doc.text(brand, textX, y0 + 5.6);
    font('body', 6.6, C.muted);
    doc.text(meta?.clinicName ? 'Documentação clínica com MindMed' : 'Documentação clínica inteligente', textX, y0 + 9.6);

    const rx = PAGE_W - M;
    const name = professionalName(meta);
    fit(name, 'bold', 10, 7.5, PAGE_W / 2 - M - 4);
    doc.setTextColor(...C.ink);
    doc.text(name, rx, y0 + 3.6, { align: 'right' });
    const reg = registroLabel(meta);
    if (reg) {
      font('semi', 7.6, C.blue);
      doc.text(reg, rx, y0 + 7.6, { align: 'right' });
    }
    const extra = [meta?.doctorSpecialty, meta?.doctorPhone].filter(Boolean).join('  ·  ');
    if (extra) {
      font('body', 6.8, C.muted);
      doc.text(ellipsis(extra, PAGE_W / 2 - M), rx, y0 + 11.2, { align: 'right' });
    }
    if (meta?.doctorAddress) {
      font('body', 6.2, C.subtle);
      doc.text(ellipsis(meta.doctorAddress, PAGE_W / 2 - M), rx, y0 + 14.6, { align: 'right' });
    }
    const ly = 25.5;
    stroke(C.line, 0.25);
    doc.line(M, ly, PAGE_W - M, ly);
    stroke(C.blue, 0.7);
    doc.line(M, ly, M + 22, ly);
  };

  /** Rodapé de todas as páginas (precisa do total, por isso roda no fim). */
  const drawFooters = (opts: { disclaimer: string; idLine: string }) => {
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      if (!format.rodape) continue;
      const fy = PAGE_H - 16;
      stroke(C.line, 0.25);
      doc.line(M, fy, PAGE_W - M, fy);
      let tx = M;
      if (markData) {
        doc.addImage(markData, 'PNG', M, fy + 2.6, 5.4, 5.4);
        tx = M + 7.2;
      }
      font('bold', 7, C.navy);
      doc.text('MindMed', tx, fy + 5);
      font('body', 5.8, C.muted);
      split(opts.disclaimer, PAGE_W - 2 * M - 62).slice(0, 2).forEach((l, li) => doc.text(l, tx, fy + 7.9 + li * 2.5));
      font('semi', 7.2, C.ink);
      doc.text(`Página ${i} de ${total}`, PAGE_W - M, fy + 5, { align: 'right' });
      const id = meta?.hash ? `${opts.idLine}  ·  SHA-256 ${meta.hash.slice(0, 16)}…` : opts.idLine;
      font('body', 5.4, C.subtle);
      doc.text(id, PAGE_W - M, fy + 8.2, { align: 'right' });
      gradientBar(PAGE_H - 1.1, 1.1);
    }
  };

  return {
    doc, format, M, W, TOP, BOTTOM, BODY,
    font, lh, asc, split, upper, fill, stroke, fit, ellipsis, eyebrow,
    gradientBar, drawLetterhead, drawHeader, drawFooters,
  };
}

export type PdfKit = Awaited<ReturnType<typeof createPdfKit>>;
