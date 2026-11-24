/**
 * MindMed — Laudo em PDF (layout vetorial).
 * Texto nítido e selecionável, quebra de página limpa, marca MindMed
 * e área de assinatura + QR de verificação. A assinatura A1 é aplicada
 * depois, em pdf-delivery, sobre este arquivo.
 */
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import mindmedMark from '@/assets/mindmed-logo-mark.png';
import { normalizeDocumentFormat, type DocumentFormat } from '../../supabase/functions/_shared/document-format';
import type { LaudoBlock, LaudoDocument } from '../../supabase/functions/_shared/laudo-document';
import type { PdfMeta } from '@/lib/pdf-generator';
import { formatDoctorTitle } from '@/lib/doctor-title';

type RGB = [number, number, number];
const C = {
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

const PAGE_W = 210;
const PAGE_H = 297;
const PT = 0.3528; // mm por ponto

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

type Role = 'body' | 'semi' | 'bold' | 'display';
type FontSpec = Record<Role, [string, string]>;

async function setupFonts(doc: jsPDF, fonte: DocumentFormat['fonte']): Promise<FontSpec> {
  if (fonte === 'Arial') return { body: ['helvetica', 'normal'], semi: ['helvetica', 'bold'], bold: ['helvetica', 'bold'], display: ['helvetica', 'bold'] };
  if (fonte === 'Times New Roman') return { body: ['times', 'normal'], semi: ['times', 'bold'], bold: ['times', 'bold'], display: ['times', 'bold'] };
  const wanted = fonte === 'Merriweather' ? ['Merri', 'InterSemi', 'InterBold', 'MerriBold'] : ['Inter', 'InterSemi', 'InterBold', 'MerriBold'];
  const data = await Promise.all(wanted.map(loadFont));
  if (data.some((d) => !d)) return { body: ['helvetica', 'normal'], semi: ['helvetica', 'bold'], bold: ['helvetica', 'bold'], display: ['helvetica', 'bold'] };
  wanted.forEach((name, i) => {
    doc.addFileToVFS(FONT_FILES[name], data[i]!);
    doc.addFont(FONT_FILES[name], name, 'normal');
  });
  return { body: [wanted[0], 'normal'], semi: [wanted[1], 'normal'], bold: [wanted[2], 'normal'], display: [wanted[3], 'normal'] };
}

// ── Imagens ──────────────────────────────────────────────
async function urlToDataUrl(url: string): Promise<string | null> {
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

async function imageToPng(url: string): Promise<{ data: string; ratio: number } | null> {
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

// ── Renderização ─────────────────────────────────────────
export interface RenderLaudoOptions {
  document: LaudoDocument;
  meta?: PdfMeta | null;
  verifyUrl?: string | null;
}

export async function renderLaudoPdf({ document: d, meta, verifyUrl }: RenderLaudoOptions): Promise<Blob> {
  const format = normalizeDocumentFormat(meta?.documentFormat);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const F = await setupFonts(doc, format.fonte);

  const [markData, clinicLogo, letterhead, qrData] = await Promise.all([
    urlToDataUrl(mindmedMark),
    format.logo && meta?.logoUrl ? imageToPng(meta.logoUrl) : Promise.resolve(null),
    meta?.letterheadUrl ? imageToPng(meta.letterheadUrl) : Promise.resolve(null),
    verifyUrl
      ? QRCode.toDataURL(verifyUrl, { margin: 0, width: 360, errorCorrectionLevel: 'M', color: { dark: '#0B2A5B', light: '#FFFFFF' } }).catch(() => null)
      : Promise.resolve(null),
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
    const maxBrandW = PAGE_W / 2 - textX;
    fit(brand, 'display', 14, 9, maxBrandW);
    doc.setTextColor(...C.navy);
    doc.text(brand, textX, y0 + 5.6);
    font('body', 6.6, C.muted);
    doc.text(meta?.clinicName ? 'Documentação clínica com MindMed' : 'Documentação clínica inteligente', textX, y0 + 9.6);

    const rx = PAGE_W - M;
    const docName = formatDoctorTitle(meta?.doctorName || 'Médico responsável');
    fit(docName, 'bold', 10, 7.5, PAGE_W / 2 - M - 4);
    doc.setTextColor(...C.ink);
    doc.text(docName, rx, y0 + 3.6, { align: 'right' });
    if (meta?.doctorCrm) {
      font('semi', 7.6, C.blue);
      doc.text(`CRM ${meta.doctorCrm}${meta.doctorCrmUf ? '/' + meta.doctorCrmUf : ''}`, rx, y0 + 7.6, { align: 'right' });
    }
    const extra = [meta?.doctorSpecialty, meta?.doctorPhone].filter(Boolean).join('  ·  ');
    if (extra) {
      font('body', 6.8, C.muted);
      doc.text(extra, rx, y0 + 11.2, { align: 'right' });
    }
    if (meta?.doctorAddress) {
      font('body', 6.2, C.subtle);
      doc.text(split(meta.doctorAddress, PAGE_W / 2 - M)[0], rx, y0 + 14.6, { align: 'right' });
    }
    const ly = 25.5;
    stroke(C.line, 0.25);
    doc.line(M, ly, PAGE_W - M, ly);
    stroke(C.blue, 0.7);
    doc.line(M, ly, M + 22, ly);
  };

  let y = TOP;
  const newPage = () => {
    doc.addPage();
    drawLetterhead();
    drawHeader();
    y = TOP;
  };
  const ensure = (h: number) => {
    if (y + h > BOTTOM) newPage();
  };
  const room = () => BOTTOM - y;

  /** Parágrafo com quebra automática e de página; aceita linhas com marcador. */
  const paragraph = (text: string, opts: { x?: number; width?: number; size?: number; role?: Role; color?: RGB; factor?: number } = {}) => {
    const x = opts.x ?? M;
    const width = opts.width ?? W;
    const size = opts.size ?? BODY;
    const step = lh(size, opts.factor ?? 1.5);
    for (const raw of text.split('\n')) {
      const para = raw.trim();
      if (!para) {
        y += step * 0.45;
        continue;
      }
      const bullet = /^[-•*]\s+/.test(para);
      const content = bullet ? para.replace(/^[-•*]\s+/, '') : para;
      const indent = bullet ? 4 : 0;
      font(opts.role ?? 'body', size, opts.color ?? C.body);
      const lines = split(content, width - indent);
      lines.forEach((line, i) => {
        if (y + step > BOTTOM) {
          newPage();
          font(opts.role ?? 'body', size, opts.color ?? C.body);
        }
        if (bullet && i === 0) {
          fill(C.cyanDark);
          doc.circle(x + 1.2, y + asc(size) - size * PT * 0.3, 0.55, 'F');
        }
        doc.text(line, x + indent, y + asc(size));
        y += step;
      });
    }
  };

  const eyebrow = (text: string, x: number, yy: number, color: RGB, size = 6.4) => {
    font('semi', size, color);
    doc.text(upper(text), x, yy, { charSpace: 0.35 });
  };

  let sectionNo = 0;
  const sectionTitle = (title: string, minFollow = 9) => {
    if (y > TOP + 1) y += sectionNo === 0 ? 1 : 4;
    ensure(13 + minFollow);
    sectionNo += 1;
    const num = String(sectionNo).padStart(2, '0');
    fill(C.blueTint);
    doc.roundedRect(M, y, 7.5, 7.5, 1.8, 1.8, 'F');
    font('bold', 7.8, C.blue);
    doc.text(num, M + 3.75, y + 5.15, { align: 'center' });
    font('display', 12, C.navy);
    doc.text(title, M + 11, y + 5.5);
    stroke(C.line, 0.25);
    doc.line(M + 11, y + 9.6, PAGE_W - M, y + 9.6);
    y += 13;
  };

  // ── Página 1 ──
  drawLetterhead();
  drawHeader();

  // Cartão do paciente
  {
    const cardH = 27;
    const x = M;
    fill(C.tint);
    doc.roundedRect(x, y, W, cardH, 3, 3, 'F');
    fill(C.blue);
    doc.roundedRect(x, y, 2.4, cardH, 1.2, 1.2, 'F');
    fill(C.tint);
    doc.rect(x + 1.2, y, 1.6, cardH, 'F');

    const leftX = x + 8;
    const rightColX = PAGE_W - M - 50;
    eyebrow(d.titulo, leftX, y + 7, C.cyanDark, 6.8);
    const nameW = rightColX - leftX - 6;
    let nameSize = fit(d.paciente.nome, 'display', 17, 11, nameW);
    let name = d.paciente.nome;
    if (doc.getTextWidth(name) > nameW) {
      while (name.length > 4 && doc.getTextWidth(name + '…') > nameW) name = name.slice(0, -1);
      name += '…';
      nameSize = 11;
    }
    doc.setTextColor(...C.navy);
    doc.text(name, leftX, y + 15.2);
    void nameSize;
    const sub = [d.paciente.idade, d.paciente.sexo].filter(Boolean).join('   ·   ');
    if (sub) {
      font('body', 8.6, C.body);
      doc.text(sub, leftX, y + 21.2);
    }
    stroke(C.line, 0.3);
    doc.line(rightColX - 2, y + 6, rightColX - 2, y + cardH - 6);
    eyebrow('Data da consulta', rightColX + 3, y + 7.6, C.muted, 5.8);
    font('semi', 9.5, C.ink);
    doc.text(d.dataConsulta || '—', rightColX + 3, y + 12.2);
    eyebrow('Documento nº', rightColX + 3, y + 17.4, C.muted, 5.8);
    font('semi', 9.5, C.ink);
    doc.text(d.numero || '—', rightColX + 3, y + 22);
    y += cardH + 4;
  }

  // Sinais vitais
  if (d.sinaisVitais.length) {
    const vit = d.sinaisVitais.slice(0, 12);
    const perRow = vit.length <= 7 ? vit.length : Math.ceil(vit.length / 2);
    const gap = 2.4;
    const tileW = (W - gap * (perRow - 1)) / perRow;
    const tileH = 13.4;
    eyebrow('Sinais vitais', M, y + 2.5, C.muted, 6.2);
    y += 5;
    vit.forEach((v, i) => {
      const col = i % perRow;
      if (col === 0 && i > 0) y += tileH + gap;
      const tx = M + col * (tileW + gap);
      fill(C.white);
      stroke(C.line, 0.3);
      doc.roundedRect(tx, y, tileW, tileH, 2, 2, 'FD');
      const label = upper(v.label);
      fit(label, 'semi', 5.6, 4.4, tileW - 4);
      doc.setTextColor(...C.muted);
      doc.text(label, tx + tileW / 2, y + 4.5, { align: 'center' });
      const m = v.value.match(/^([\d.,/x×]+)\s*(.*)$/i);
      const num = m ? m[1] : v.value;
      const unit = m ? m[2] : '';
      const numSize = fit(num, 'bold', 11, 7, tileW - 4);
      doc.setTextColor(...C.ink);
      if (unit) {
        font('body', 6, C.muted);
        const uw = doc.getTextWidth(unit);
        font('bold', numSize, C.ink);
        const nw = doc.getTextWidth(num);
        if (nw + 1 + uw <= tileW - 3) {
          const sx = tx + (tileW - nw - 1 - uw) / 2;
          doc.text(num, sx, y + 10.2);
          font('body', 6, C.muted);
          doc.text(unit, sx + nw + 1, y + 10.2);
        } else {
          doc.text(num, tx + tileW / 2, y + 9.1, { align: 'center' });
          font('body', 5.6, C.muted);
          doc.text(unit, tx + tileW / 2, y + 11.9, { align: 'center' });
        }
      } else {
        doc.text(num, tx + tileW / 2, y + 10.2, { align: 'center' });
      }
    });
    y += tileH + 4;
  }

  // Alergias
  if (d.alergias.length) {
    const text = d.alergias.join(', ');
    font('semi', 8.6, C.red);
    const lines = split(text, W - 30);
    const h = Math.max(9, 4 + lines.length * lh(8.6, 1.35) + 1.5);
    fill(C.redBg);
    doc.roundedRect(M, y, W, h, 2, 2, 'F');
    eyebrow('Alergias', M + 5, y + 5.6, C.red, 6.4);
    font('semi', 8.6, C.red);
    lines.forEach((l, i) => doc.text(l, M + 25, y + 5.8 + i * lh(8.6, 1.35)));
    y += h + 3;
  }

  // ── Blocos ──
  const renderBlock = (b: LaudoBlock) => {
    if (b.kind === 'fields') {
      // O título nunca fica sozinho no fim da página: leva junto o rótulo e 2 linhas.
      sectionTitle(b.title, (b.items[0]?.label ? 4.6 : 0) + lh(BODY) * 2 + 1);
      b.items.forEach((item, idx) => {
        if (item.label) {
          ensure(4.5 + lh(BODY) * 2);
          eyebrow(item.label, M + 11, y + 2.4, C.blue, 6.6);
          y += 4.4;
        }
        paragraph(item.text, { x: M + 11, width: W - 11 });
        if (idx < b.items.length - 1) y += 2.4;
      });
      return;
    }

    if (b.kind === 'text') {
      sectionTitle(b.title, lh(BODY) * 2 + 1);
      paragraph(b.text, { x: M + 11, width: W - 11, size: b.small ? BODY * 0.9 : BODY, color: b.small ? C.muted : C.body });
      return;
    }

    if (b.kind === 'hypotheses') {
      sectionTitle(b.title, 26);
      const x = M + 11;
      const w = W - 11;
      const pad = 5;
      const card = (opts: { label: string; titulo: string; detalhe?: string; primary: boolean }) => {
        const innerW = w - 2 * pad - (opts.primary ? 2 : 0);
        const tSize = opts.primary ? 11.5 : 10;
        font(opts.primary ? 'bold' : 'semi', tSize);
        const tLines = split(opts.titulo, innerW);
        font('body', BODY * 0.92);
        const dLines = opts.detalhe ? split(opts.detalhe, innerW) : [];
        const h = pad + 3.2 + 2.2 + tLines.length * lh(tSize, 1.3) + (dLines.length ? 1.6 + dLines.length * lh(BODY * 0.92, 1.5) : 0) + pad - 1.5;
        if (h <= BOTTOM - TOP) ensure(h);
        const top = y;
        if (opts.primary) {
          fill(C.blue);
          doc.roundedRect(x, top, w, h, 2.5, 2.5, 'F');
          fill(C.tint);
          doc.roundedRect(x + 1.6, top, w - 1.6, h, 2.5, 2.5, 'F');
          doc.rect(x + 1.6, top, 3, h, 'F');
        } else {
          fill(C.white);
          stroke(C.line, 0.3);
          doc.roundedRect(x, top, w, h, 2.5, 2.5, 'FD');
        }
        const ix = x + pad + (opts.primary ? 2 : 0);
        let cy = top + pad + 2.4;
        eyebrow(opts.label, ix, cy, opts.primary ? C.cyanDark : C.muted, 6.2);
        cy += 2.4;
        font(opts.primary ? 'bold' : 'semi', tSize, C.ink);
        tLines.forEach((l) => {
          doc.text(l, ix, cy + asc(tSize));
          cy += lh(tSize, 1.3);
        });
        if (dLines.length) {
          cy += 1.6;
          font('body', BODY * 0.92, C.body);
          dLines.forEach((l) => {
            doc.text(l, ix, cy + asc(BODY * 0.92));
            cy += lh(BODY * 0.92, 1.5);
          });
        }
        y = top + h + 3;
      };
      if (b.principal) card({ label: 'Hipótese principal', titulo: b.principal.titulo, detalhe: b.principal.detalhe, primary: true });
      b.diferenciais.forEach((df) => card({ label: 'Diagnóstico diferencial', titulo: df.titulo, detalhe: df.detalhe, primary: false }));
      if (b.cid10.length) {
        ensure(12);
        y += 1;
        eyebrow('CID-10', x, y + 4.2, C.muted, 6.4);
        let cx = x + 15;
        const chipH = 6.6;
        b.cid10.forEach((c) => {
          const label = c.descricao ? `${c.codigo}  ·  ${c.descricao}` : c.codigo;
          font('bold', 8, C.blue);
          let cw = doc.getTextWidth(label) + 7;
          if (cw > w - 15) cw = w - 15;
          if (cx + cw > x + w) {
            cx = x + 15;
            y += chipH + 2;
            ensure(chipH + 2);
          }
          fill(C.blueTint);
          doc.roundedRect(cx, y, cw, chipH, chipH / 2, chipH / 2, 'F');
          font('bold', 8, C.blue);
          doc.text(split(label, cw - 6)[0], cx + 3.5, y + 4.5);
          cx += cw + 2.2;
        });
        y += chipH + 2;
      }
      return;
    }

    if (b.kind === 'checklist') {
      sectionTitle(b.title);
      const x = M + 11;
      const w = W - 11;
      const cols = b.items.length >= 4 ? 2 : 1;
      const colGap = 6;
      const colW = (w - colGap * (cols - 1)) / cols;
      const step = lh(BODY, 1.45);
      for (let i = 0; i < b.items.length; i += cols) {
        const row = b.items.slice(i, i + cols);
        font('body', BODY);
        const linesPer = row.map((t) => split(t, colW - 6));
        const h = Math.max(...linesPer.map((l) => l.length)) * step + 2.4;
        ensure(h);
        row.forEach((_, ci) => {
          const cx = x + ci * (colW + colGap);
          fill(C.blueTint);
          doc.roundedRect(cx, y + 0.6, 3.6, 3.6, 0.9, 0.9, 'F');
          stroke(C.blue, 0.45);
          doc.lines([[0.7, 0.75], [1.4, -1.6]], cx + 0.95, y + 2.5);
          font('body', BODY, C.body);
          linesPer[ci].forEach((l, li) => doc.text(l, cx + 6, y + asc(BODY) + li * step));
        });
        y += h;
      }
      return;
    }

    if (b.kind === 'steps') {
      sectionTitle(b.title, lh(BODY) * 2 + 2);
      const x = M + 11;
      const w = W - 11;
      const step = lh(BODY, 1.5);
      b.items.forEach((item, i) => {
        font('body', BODY);
        const lines = split(item, w - 9);
        ensure(Math.min(lines.length, 3) * step + 1);
        fill(C.blue);
        doc.circle(x + 2.7, y + 2.3, 2.6, 'F');
        font('bold', 7, C.white);
        doc.text(String(i + 1), x + 2.7, y + 3.35, { align: 'center' });
        font('body', BODY, C.body);
        lines.forEach((l) => {
          if (y + step > BOTTOM) {
            newPage();
            font('body', BODY, C.body);
          }
          doc.text(l, x + 9, y + asc(BODY) + 0.3);
          y += step;
        });
        y += 1.8;
      });
      return;
    }

    if (b.kind === 'callout') {
      const warn = b.tone === 'warning';
      const x = M;
      const w = W;
      const size = BODY;
      font(warn ? 'body' : 'semi', size);
      const lines = split(b.text, w - 16);
      const h = 5.2 + 3.2 + lines.length * lh(size, 1.45) + 2.4;
      ensure(h + 4);
      y += 3;
      fill(warn ? C.warn : C.cyan);
      doc.roundedRect(x, y, w, h, 2.5, 2.5, 'F');
      fill(warn ? C.warnBg : C.cyanTint);
      doc.roundedRect(x + 1.6, y, w - 1.6, h, 2.5, 2.5, 'F');
      doc.rect(x + 1.6, y, 3, h, 'F');
      eyebrow(warn ? b.title : `Próximo passo · ${b.title}`, x + 8, y + 5.4, warn ? C.warnText : C.cyanDark, 6.4);
      font(warn ? 'body' : 'semi', size, warn ? C.warnText : C.ink);
      lines.forEach((l, i) => doc.text(l, x + 8, y + 8.4 + asc(size) + i * lh(size, 1.45)));
      y += h + 2;
    }
  };

  d.blocks.forEach(renderBlock);

  // ── Fechamento: assinatura + verificação ──
  {
    const blockH = 31;
    if (room() < blockH + 6) newPage();
    else y += 6;
    const top = y;
    const sigW = 80;
    font('body', 7.4, C.muted);
    doc.text(`Emitido em ${meta?.dateFormatted || d.dataConsulta}${meta?.timeFormatted ? ' às ' + meta.timeFormatted : ''}`, M, top + 3);
    stroke(C.ink, 0.3);
    doc.line(M, top + 15, M + sigW, top + 15);
    const docName = formatDoctorTitle(meta?.doctorName || 'Médico responsável');
    fit(docName, 'bold', 10, 7.5, sigW);
    doc.setTextColor(...C.ink);
    doc.text(docName, M, top + 20);
    const crm = meta?.doctorCrm ? `CRM ${meta.doctorCrm}${meta.doctorCrmUf ? '/' + meta.doctorCrmUf : ''}` : '';
    const line2 = [crm, meta?.doctorSpecialty].filter(Boolean).join('  ·  ');
    if (line2) {
      font('semi', 7.8, C.blue);
      doc.text(split(line2, sigW)[0], M, top + 24.2);
    }
    font('body', 6.8, C.muted);
    doc.text('Médico(a) responsável', M, top + 28);

    if (qrData) {
      const cw = 74;
      const ch = 30;
      const cx = PAGE_W - M - cw;
      fill(C.tint);
      doc.roundedRect(cx, top, cw, ch, 3, 3, 'F');
      fill(C.white);
      doc.roundedRect(cx + 3, top + 3, 24, 24, 1.5, 1.5, 'F');
      doc.addImage(qrData, 'PNG', cx + 4.2, top + 4.2, 21.6, 21.6);
      const tx = cx + 31;
      eyebrow('Verificação', tx, top + 6.6, C.cyanDark, 6.2);
      font('semi', 8.4, C.ink);
      doc.text(split('Documento autêntico?', cw - 34), tx, top + 11.2);
      font('body', 6.8, C.body);
      split('Aponte a câmera do celular para o código e confira os dados do médico e do laudo.', cw - 34).slice(0, 3).forEach((l, i) => doc.text(l, tx, top + 15.2 + i * 3));
      font('bold', 7.4, C.navy);
      doc.text(`Nº ${d.numero}`, tx, top + 26.4);
    }
    y = top + blockH;
  }

  // ── Rodapé (precisa do total de páginas) ──
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
    split(d.disclaimer, PAGE_W - 2 * M - 62).slice(0, 2).forEach((l, li) => doc.text(l, tx, fy + 7.9 + li * 2.5));
    font('semi', 7.2, C.ink);
    doc.text(`Página ${i} de ${total}`, PAGE_W - M, fy + 5, { align: 'right' });
    if (meta?.hash) {
      font('body', 5.4, C.subtle);
      doc.text(`Laudo ${d.numero}  ·  SHA-256 ${meta.hash.slice(0, 16)}…`, PAGE_W - M, fy + 8.2, { align: 'right' });
    }
    gradientBar(PAGE_H - 1.1, 1.1);
  }

  doc.setProperties({
    title: `${d.titulo} — ${d.paciente.nome}`,
    subject: 'Laudo médico',
    author: meta?.doctorName || 'MindMed',
    creator: 'MindMed',
    keywords: `MindMed, laudo, ${d.numero}`,
  });
  doc.setLanguage('pt-BR');
  return doc.output('blob');
}

/** Endereço público que o QR do laudo abre para conferir a autenticidade. */
export function laudoVerifyUrl(laudoId: string, token: string): string {
  return `${window.location.origin}/verificar/${laudoId}?t=${encodeURIComponent(token)}`;
}

// deno-lint-ignore no-explicit-any
type ExportData = { html?: string; document?: LaudoDocument | null; pdfMeta?: PdfMeta; fileName: string; verifyToken?: string };

/** Gera o PDF a partir da resposta da função export-pdf (layout novo; CRP segue no antigo). */
export async function buildLaudoPdf(data: ExportData, laudoId: string): Promise<Blob> {
  const verifyUrl = data.verifyToken ? laudoVerifyUrl(laudoId, data.verifyToken) : null;
  if (data.document) return renderLaudoPdf({ document: data.document, meta: data.pdfMeta, verifyUrl });
  const { generatePdf } = await import('@/lib/pdf-generator');
  return generatePdf({ html: data.html || '', fileName: data.fileName, verifyUrl: verifyUrl || '', pdfMeta: data.pdfMeta });
}
