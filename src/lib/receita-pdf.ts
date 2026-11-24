/**
 * MindMed — Receita em PDF (layout vetorial, mesma identidade do laudo).
 * Uma folha por tipo de receita; controladas saem em 2 vias com os campos
 * de comprador e fornecedor. A assinatura A1 é aplicada depois, em pdf-delivery.
 */
import QRCode from 'qrcode';
import type { ReceitaDocument, ReceitaItem, ReceitaPagina, TipoReceita } from '../../supabase/functions/_shared/receita-document';
import type { PdfMeta } from '@/lib/pdf-generator';
import { C, PAGE_W, createPdfKit, imageToPng, professionalName, registroLabel, type RGB } from '@/lib/pdf-kit';

const ITI_URL = 'https://validar.iti.gov.br';

const TONE: Record<TipoReceita, { accent: RGB; tint: RGB; text: RGB }> = {
  branca_comum: { accent: C.blue, tint: C.blueTint, text: C.navy },
  antimicrobiano: { accent: [180, 83, 9], tint: [255, 244, 230], text: [124, 45, 18] },
  controle_especial: { accent: [109, 40, 217], tint: [243, 240, 255], text: [76, 29, 149] },
  azul_b: { accent: [29, 78, 216], tint: [235, 243, 255], text: [30, 58, 138] },
  amarela_a: { accent: [202, 138, 4], tint: [254, 249, 220], text: [113, 63, 18] },
};

export interface RenderReceitaOptions {
  document: ReceitaDocument;
  meta?: PdfMeta | null;
  signatureUrl?: string | null;
  stampUrl?: string | null;
}

export async function renderReceitaPdf({ document: d, meta, signatureUrl, stampUrl }: RenderReceitaOptions): Promise<Blob> {
  const [k, sig, stamp, qr] = await Promise.all([
    createPdfKit(meta),
    signatureUrl ? imageToPng(signatureUrl) : Promise.resolve(null),
    stampUrl ? imageToPng(stampUrl) : Promise.resolve(null),
    QRCode.toDataURL(ITI_URL, { margin: 0, width: 300, errorCorrectionLevel: 'M', color: { dark: '#0B2A5B', light: '#FFFFFF' } }).catch(() => null),
  ]);
  const { doc, M, W, TOP, BOTTOM, BODY, font, lh, asc, split, fill, stroke, fit, ellipsis, eyebrow } = k;

  let y = TOP;
  let firstPage = true;
  const startPage = () => {
    if (!firstPage) doc.addPage();
    firstPage = false;
    k.drawLetterhead();
    k.drawHeader();
    y = TOP;
  };

  const banner = (p: ReceitaPagina, cont: boolean) => {
    const t = TONE[p.tipo];
    const h = 14;
    fill(t.accent);
    doc.roundedRect(M, y, W, h, 2.5, 2.5, 'F');
    fill(t.tint);
    doc.roundedRect(M + 1.6, y, W - 1.6, h, 2.5, 2.5, 'F');
    doc.rect(M + 1.6, y, 3, h, 'F');
    eyebrow(p.via || 'Receituário', M + 8, y + 5.2, t.accent, 6.2);
    const title = cont ? `${p.titulo} (continuação)` : p.titulo;
    fit(title, 'display', 11.5, 9, W / 2);
    doc.setTextColor(...t.text);
    doc.text(title, M + 8, y + 10.8);
    font('body', 6.8, t.text);
    doc.text(ellipsis(p.subtitulo, W / 2 - 10), PAGE_W - M - 5, y + 8.6, { align: 'right' });
    y += h + 4;
  };

  const patientCard = (p: ReceitaPagina) => {
    const h = p.controlado ? 31 : 24;
    fill(C.tint);
    doc.roundedRect(M, y, W, h, 3, 3, 'F');
    const leftX = M + 6;
    const rightColX = PAGE_W - M - 50;
    eyebrow('Paciente', leftX, y + 6.4, C.cyanDark, 6.2);
    const nameW = rightColX - leftX - 6;
    fit(d.paciente.nome, 'display', 15, 10, nameW);
    doc.setTextColor(...C.navy);
    doc.text(ellipsis(d.paciente.nome, nameW), leftX, y + 13.6);
    const sub = [d.paciente.idade, d.paciente.sexo, d.paciente.prontuario ? `Prontuário ${d.paciente.prontuario}` : '']
      .filter(Boolean)
      .join('   ·   ');
    if (sub) {
      font('body', 8.2, C.body);
      doc.text(ellipsis(sub, nameW), leftX, y + 19.2);
    }
    if (p.controlado) {
      // A Portaria 344/1998 pede o endereço do paciente nas receitas controladas.
      eyebrow('Endereço', leftX, y + 26.6, C.muted, 5.6);
      stroke(C.subtle, 0.25);
      doc.line(leftX + 15, y + 27, rightColX - 6, y + 27);
    }
    stroke(C.line, 0.3);
    doc.line(rightColX - 2, y + 5, rightColX - 2, y + h - 5);
    eyebrow('Data de emissão', rightColX + 3, y + 6.8, C.muted, 5.8);
    fit(d.dataEmissao || '—', 'semi', 9.2, 7, 45);
    doc.setTextColor(...C.ink);
    doc.text(d.dataEmissao || '—', rightColX + 3, y + 11.4);
    eyebrow('Receita nº', rightColX + 3, y + 16.6, C.muted, 5.8);
    font('semi', 9.2, C.ink);
    doc.text(d.numero || '—', rightColX + 3, y + 21.2);
    y += h + 6;
  };

  const rxTitle = () => {
    font('display', 16, C.navy);
    doc.text('Rx', M, y + 5.6);
    const rw = doc.getTextWidth('Rx');
    eyebrow('Prescrição', M + rw + 3, y + 5.2, C.muted, 6.4);
    stroke(C.line, 0.25);
    doc.line(M + rw + 22, y + 4.4, PAGE_W - M, y + 4.4);
    y += 10;
  };

  // ── Remédios ──
  const x0 = M + 11;
  const cw = W - 11;
  const NAME = 11;
  const OBS = BODY * 0.9;
  const chipH = 5.8;
  const chipsOf = (it: ReceitaItem) =>
    [it.dosagem ? ['Dose', it.dosagem] : null, it.duracao ? ['Duração', it.duracao] : null].filter(Boolean) as [string, string][];

  const measure = (it: ReceitaItem) => {
    font('bold', NAME);
    const nameLines = split(it.nome, cw);
    font('body', BODY);
    const posLines = it.posologia ? split(it.posologia, cw) : [];
    font('body', OBS);
    const obsLines = it.observacoes ? split(`Obs.: ${it.observacoes}`, cw) : [];
    const h =
      2.5 +
      nameLines.length * lh(NAME, 1.25) +
      (it.laboratorio ? lh(7.4, 1.3) : 0) +
      (chipsOf(it).length ? chipH + 2.2 : 0.8) +
      posLines.length * lh(BODY, 1.45) +
      (obsLines.length ? 0.8 + obsLines.length * lh(OBS, 1.45) : 0) +
      3.5;
    return { nameLines, posLines, obsLines, h };
  };

  const drawItem = (it: ReceitaItem, n: number, accent: RGB, m: ReturnType<typeof measure>) => {
    const top = y;
    fill(accent);
    doc.circle(M + 3.2, top + 4.6, 3, 'F');
    font('bold', 8, C.white);
    doc.text(String(n), M + 3.2, top + 5.75, { align: 'center' });
    let cy = top + 2.5;
    font('bold', NAME, C.ink);
    m.nameLines.forEach((l) => {
      doc.text(l, x0, cy + asc(NAME));
      cy += lh(NAME, 1.25);
    });
    if (it.laboratorio) {
      font('semi', 7.4, C.muted);
      doc.text(it.laboratorio, x0, cy + asc(7.4));
      cy += lh(7.4, 1.3);
    }
    const chips = chipsOf(it);
    if (chips.length) {
      cy += 0.8;
      let cx = x0;
      chips.forEach(([label, value]) => {
        font('semi', 5.8);
        const lw = doc.getTextWidth(label.toLocaleUpperCase('pt-BR')) + 0.35 * label.length;
        font('semi', 8);
        const vw = Math.min(doc.getTextWidth(value), cw - lw - 12);
        const w = lw + vw + 7;
        fill(C.tint);
        doc.roundedRect(cx, cy, w, chipH, 1.6, 1.6, 'F');
        eyebrow(label, cx + 2.6, cy + 3.85, C.muted, 5.8);
        font('semi', 8, C.ink);
        doc.text(ellipsis(value, vw + 0.5), cx + 2.6 + lw + 1.8, cy + 4);
        cx += w + 2;
      });
      cy += chipH + 1.4;
    } else {
      cy += 0.8;
    }
    font('body', BODY, C.body);
    m.posLines.forEach((l) => {
      doc.text(l, x0, cy + asc(BODY));
      cy += lh(BODY, 1.45);
    });
    if (m.obsLines.length) {
      cy += 0.8;
      font('body', OBS, C.muted);
      m.obsLines.forEach((l) => {
        doc.text(l, x0, cy + asc(OBS));
        cy += lh(OBS, 1.45);
      });
    }
    y = top + m.h;
  };

  // ── Rodapé da folha: comprador/fornecedor + assinatura ──
  const BOXES_H = 33;
  const SIG_H = 33;
  const zoneHeight = (p: ReceitaPagina) => SIG_H + (p.controlado ? BOXES_H + 5 : 0);

  const fieldBox = (x: number, top: number, w: number, title: string, fields: string[]) => {
    stroke(C.line, 0.3);
    fill(C.white);
    doc.roundedRect(x, top, w, BOXES_H, 2.2, 2.2, 'FD');
    eyebrow(title, x + 4, top + 5.4, C.navy, 6);
    fields.forEach((f, i) => {
      const fy = top + 11.4 + i * 6;
      font('body', 6.2, C.muted);
      doc.text(f, x + 4, fy);
      const tw = doc.getTextWidth(f);
      stroke(C.subtle, 0.2);
      doc.line(x + 5 + tw, fy + 0.4, x + w - 4, fy + 0.4);
    });
  };

  const drawZone = (p: ReceitaPagina) => {
    let top = BOTTOM - zoneHeight(p);
    if (p.controlado) {
      const gap = 4;
      const bw = (W - gap) / 2;
      fieldBox(M, top, bw, 'Identificação do comprador', ['Nome', 'RG / Órgão emissor', 'Endereço', 'Cidade / UF · Telefone']);
      fieldBox(M + bw + gap, top, bw, 'Identificação do fornecedor', ['Farmacêutico(a) / CRF', 'Assinatura', 'Data']);
      top += BOXES_H + 5;
    }
    const sigW = 78;
    if (sig) {
      const h = Math.min(13, 60 / sig.ratio);
      const w = h * sig.ratio;
      doc.addImage(sig.data, 'PNG', M + (sigW - w) / 2, top + 14 - h, w, h);
    }
    stroke(C.ink, 0.3);
    doc.line(M, top + 15, M + sigW, top + 15);
    const name = professionalName(meta);
    fit(name, 'bold', 10, 7.5, sigW);
    doc.setTextColor(...C.ink);
    doc.text(name, M, top + 20);
    const line2 = [registroLabel(meta), meta?.doctorSpecialty].filter(Boolean).join('  ·  ');
    if (line2) {
      font('semi', 7.8, C.blue);
      doc.text(ellipsis(line2, sigW), M, top + 24.2);
    }
    font('body', 6.8, C.muted);
    doc.text('Médico(a) responsável', M, top + 28);

    const qw = 74;
    const qx = PAGE_W - M - qw;
    if (stamp) {
      const free = qx - (M + sigW) - 8;
      if (free >= 14) {
        const s = Math.min(free, 26);
        const w = stamp.ratio >= 1 ? s : s * stamp.ratio;
        const h = stamp.ratio >= 1 ? s / stamp.ratio : s;
        doc.addImage(stamp.data, 'PNG', M + sigW + 4 + (free - w) / 2, top + (30 - h) / 2, w, h);
      }
    }
    fill(C.tint);
    doc.roundedRect(qx, top, qw, 30, 3, 3, 'F');
    let tx = qx + 5;
    if (qr) {
      fill(C.white);
      doc.roundedRect(qx + 3, top + 3, 24, 24, 1.5, 1.5, 'F');
      doc.addImage(qr, 'PNG', qx + 4.2, top + 4.2, 21.6, 21.6);
      tx = qx + 31;
    }
    const tw = qx + qw - tx - 3;
    eyebrow('Assinatura digital', tx, top + 6.6, C.cyanDark, 6.2);
    font('semi', 8.4, C.ink);
    doc.text('Confira a autenticidade', tx, top + 11.2);
    font('body', 6.6, C.body);
    split('Receitas assinadas com certificado ICP-Brasil podem ser conferidas em validar.iti.gov.br.', tw)
      .slice(0, 3)
      .forEach((l, i) => doc.text(l, tx, top + 15.2 + i * 2.9));
    font('bold', 7.4, C.navy);
    doc.text(`Nº ${d.numero}`, tx, top + 26.4);
  };

  const notes = () => {
    const parts: { title: string; text: string; tone: 'note' | 'plain' }[] = [];
    if (d.observacoes) parts.push({ title: 'Orientações ao paciente', text: d.observacoes, tone: 'note' });
    if (d.rodapeMedico) parts.push({ title: '', text: d.rodapeMedico, tone: 'plain' });
    return parts;
  };

  // ── Folhas ──
  d.paginas.forEach((p) => {
    const accent = TONE[p.tipo].accent;
    startPage();
    banner(p, false);
    patientCard(p);
    rxTitle();

    p.itens.forEach((it, i) => {
      const m = measure(it);
      if (y + m.h > BOTTOM) {
        startPage();
        banner(p, true);
        rxTitle();
      }
      drawItem(it, i + 1, accent, m);
      if (i < p.itens.length - 1) {
        stroke(C.line, 0.2);
        doc.line(x0, y - 1.2, PAGE_W - M, y - 1.2);
      }
    });

    notes().forEach((n) => {
      const size = n.tone === 'note' ? BODY * 0.95 : 7.2;
      font('body', size);
      const lines = split(n.text, W - 14);
      const h = (n.title ? 8.6 : 4) + lines.length * lh(size, 1.45) + 2;
      if (y + 3 + h > BOTTOM) {
        startPage();
        banner(p, true);
      }
      y += 3;
      if (n.tone === 'note') {
        fill(C.cyan);
        doc.roundedRect(M, y, W, h, 2.5, 2.5, 'F');
        fill(C.cyanTint);
        doc.roundedRect(M + 1.6, y, W - 1.6, h, 2.5, 2.5, 'F');
        doc.rect(M + 1.6, y, 3, h, 'F');
        eyebrow(n.title, M + 8, y + 5.4, C.cyanDark, 6.2);
        font('body', size, C.ink);
        lines.forEach((l, i) => doc.text(l, M + 8, y + 8.6 + asc(size) + i * lh(size, 1.45)));
      } else {
        font('body', size, C.muted);
        lines.forEach((l, i) => doc.text(l, M, y + 2 + asc(size) + i * lh(size, 1.45)));
      }
      y += h;
    });

    if (y + 6 > BOTTOM - zoneHeight(p)) {
      startPage();
      banner(p, true);
    }
    drawZone(p);
  });

  k.drawFooters({ disclaimer: d.disclaimer, idLine: `Receita ${d.numero}` });

  doc.setProperties({
    title: `Receita — ${d.paciente.nome}`,
    subject: 'Receituário médico',
    author: meta?.doctorName || 'MindMed',
    creator: 'MindMed',
    keywords: `MindMed, receita, ${d.numero}`,
  });
  doc.setLanguage('pt-BR');
  return doc.output('blob');
}

type PrescriptionExport = {
  html?: string;
  document?: ReceitaDocument | null;
  pdfMeta?: PdfMeta;
  signatureUrl?: string | null;
  stampUrl?: string | null;
  documentFormat?: PdfMeta['documentFormat'];
  letterheadUrl?: string | null;
};

/** Gera o PDF a partir da resposta de generate-prescription-pdf (layout novo; HTML antigo como reserva). */
export async function buildReceitaPdf(data: PrescriptionExport, fileName: string, prescriptionId: string): Promise<Blob> {
  if (data.document?.paginas?.length) {
    return renderReceitaPdf({ document: data.document, meta: data.pdfMeta, signatureUrl: data.signatureUrl, stampUrl: data.stampUrl });
  }
  const { generatePdf } = await import('@/lib/pdf-generator');
  return generatePdf({
    html: data.html || '',
    documentFormat: data.documentFormat,
    letterheadUrl: data.letterheadUrl,
    fileName,
    verifyUrl: `${window.location.origin}/r/${prescriptionId}`,
  });
}
