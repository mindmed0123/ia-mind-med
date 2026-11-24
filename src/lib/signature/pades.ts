/**
 * Assinatura digital de PDF com certificado A1 (.pfx/.p12) ICP-Brasil.
 * Tudo acontece no navegador do médico: o arquivo e a senha nunca saem do computador.
 * Formato: assinatura PAdES básica (CMS destacado, SHA-256, adbe.pkcs7.detached).
 */
import forge from 'node-forge';
import { PDFDocument, PDFName, PDFNumber, PDFHexString, PDFString, PDFArray, StandardFonts, rgb } from 'pdf-lib';

export interface CertificateInfo {
  nome: string;
  cpf: string | null;
  emissor: string;
  validoDe: string;
  validoAte: string;
  serial: string;
  icpBrasil: boolean;
}

export interface A1Certificate {
  key: forge.pki.rsa.PrivateKey;
  certificate: forge.pki.Certificate;
  chain: forge.pki.Certificate[];
  info: CertificateInfo;
}

export class CertificateError extends Error {
  constructor(public code: 'senha' | 'arquivo' | 'sem_chave' | 'vencido' | 'nao_icp' | 'ainda_nao_valido', message: string) {
    super(message);
  }
}

const SIGNATURE_BYTES = 16384;
const BYTE_RANGE_PLACEHOLDER = '**********';

function bytesToBinary(bytes: Uint8Array): string {
  let out = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    out += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return out;
}

function attr(entity: forge.pki.Certificate['subject'], short: string): string {
  const f = entity.attributes.filter((a) => a.shortName === short || a.name === short);
  return f.map((a) => String(a.value)).join(', ');
}

function extractCpf(cert: forge.pki.Certificate, cn: string): string | null {
  // Certificados de pessoa física ICP-Brasil: CN = "NOME:CPF" e/ou otherName 2.16.76.1.3.1 (nascimento + CPF).
  const fromCn = cn.split(':')[1]?.replace(/\D/g, '');
  if (fromCn && fromCn.length === 11) return fromCn;
  const san = cert.extensions.find((e: { name?: string }) => e.name === 'subjectAltName') as { value?: string } | undefined;
  if (san?.value) {
    const oid = forge.asn1.oidToDer('2.16.76.1.3.1').getBytes();
    const pos = san.value.indexOf(oid);
    if (pos >= 0) {
      const m = san.value.slice(pos + oid.length, pos + oid.length + 80).match(/(\d{8})(\d{11})/);
      if (m) return m[2];
    }
  }
  return null;
}

export function describeCertificate(cert: forge.pki.Certificate): CertificateInfo {
  const cn = attr(cert.subject, 'CN');
  const issuerText = cert.issuer.attributes.map((a) => String(a.value)).join(' ');
  const subjectText = cert.subject.attributes.map((a) => String(a.value)).join(' ');
  return {
    nome: cn.split(':')[0].trim() || cn,
    cpf: extractCpf(cert, cn),
    emissor: attr(cert.issuer, 'CN') || attr(cert.issuer, 'O'),
    validoDe: cert.validity.notBefore.toISOString(),
    validoAte: cert.validity.notAfter.toISOString(),
    serial: cert.serialNumber,
    icpBrasil: /ICP-Brasil/i.test(issuerText) || /ICP-Brasil/i.test(subjectText),
  };
}

/** Abre o arquivo .pfx com a senha e confere se o certificado pode assinar. */
export function loadA1(pfx: ArrayBuffer | Uint8Array, password: string, opts: { requireIcpBrasil?: boolean; now?: Date } = {}): A1Certificate {
  const bytes = pfx instanceof Uint8Array ? pfx : new Uint8Array(pfx);
  let p12: forge.pkcs12.Pkcs12Pfx;
  let asn1: forge.asn1.Asn1;
  try {
    asn1 = forge.asn1.fromDer(bytesToBinary(bytes));
  } catch {
    throw new CertificateError('arquivo', 'Arquivo de certificado inválido. Use o arquivo .pfx ou .p12 do seu certificado A1.');
  }
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password);
  } catch (e) {
    const msg = String((e as Error)?.message || '');
    if (/password|MAC|decrypt|pad/i.test(msg)) throw new CertificateError('senha', 'Senha do certificado incorreta.');
    throw new CertificateError('arquivo', 'Não foi possível abrir este certificado. Confira se é o arquivo .pfx ou .p12 do seu certificado A1.');
  }

  const keyBags = [
    ...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || []),
    ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || []),
  ];
  const certs = (p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [])
    .map((b) => b.cert)
    .filter((c): c is forge.pki.Certificate => !!c);
  const key = keyBags.map((b) => b.key).find(Boolean) as forge.pki.rsa.PrivateKey | undefined;
  if (!key || certs.length === 0) throw new CertificateError('sem_chave', 'O arquivo não contém a chave do certificado.');

  // Certificado do médico = o que corresponde à chave privada.
  const mine = certs.find((c) => {
    const pub = c.publicKey as forge.pki.rsa.PublicKey;
    return pub?.n && key.n && pub.n.equals(key.n);
  }) || certs[0];
  const chain = certs.filter((c) => c !== mine);
  const info = describeCertificate(mine);
  const now = opts.now || new Date();
  if (now > mine.validity.notAfter) throw new CertificateError('vencido', `Certificado vencido em ${mine.validity.notAfter.toLocaleDateString('pt-BR')}.`);
  if (now < mine.validity.notBefore) throw new CertificateError('ainda_nao_valido', 'Este certificado ainda não está válido.');
  if (opts.requireIcpBrasil !== false && !info.icpBrasil) {
    throw new CertificateError('nao_icp', 'Este certificado não é ICP-Brasil. Use o certificado digital A1 emitido para você (e-CPF ou certificado do conselho).');
  }
  return { key, certificate: mine, chain, info };
}

export interface SignOptions {
  reason?: string;
  location?: string;
  contactInfo?: string;
  /** Texto curto mostrado no rodapé de cada página. */
  stamp?: boolean;
  date?: Date;
}

function maskCpf(cpf: string | null): string {
  if (!cpf || cpf.length !== 11) return '';
  return ` · CPF ***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
}

/** Assina o PDF e devolve os bytes do PDF assinado. */
export async function signPdf(pdf: ArrayBuffer | Uint8Array, a1: A1Certificate, opts: SignOptions = {}): Promise<Uint8Array> {
  const date = opts.date || new Date();
  const doc = await PDFDocument.load(pdf, { updateMetadata: false });
  const pages = doc.getPages();

  if (opts.stamp !== false) {
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const when = date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const text = `Assinado digitalmente por ${a1.info.nome}${maskCpf(a1.info.cpf)} · Certificado ICP-Brasil · ${when} · Verifique em validar.iti.gov.br`;
    pages.forEach((page) => {
      const { width } = page.getSize();
      let size = 6.5;
      while (size > 4.5 && font.widthOfTextAtSize(text, size) > width - 24) size -= 0.25;
      page.drawText(text, { x: 12, y: 6, size, font, color: rgb(0.2, 0.25, 0.35) });
    });
  }

  const ctx = doc.context;
  const byteRange = PDFArray.withContext(ctx);
  byteRange.push(PDFNumber.of(0));
  byteRange.push(PDFName.of(BYTE_RANGE_PLACEHOLDER));
  byteRange.push(PDFName.of(BYTE_RANGE_PLACEHOLDER));
  byteRange.push(PDFName.of(BYTE_RANGE_PLACEHOLDER));

  const sigDict = ctx.obj({
    Type: 'Sig',
    Filter: 'Adobe.PPKLite',
    SubFilter: 'adbe.pkcs7.detached',
    ByteRange: byteRange,
    Contents: PDFHexString.of('0'.repeat(SIGNATURE_BYTES * 2)),
    Reason: PDFString.of(opts.reason || 'Documento assinado pelo profissional responsável'),
    Location: PDFString.of(opts.location || 'Brasil'),
    ContactInfo: PDFString.of(opts.contactInfo || ''),
    Name: PDFString.of(a1.info.nome),
    M: PDFString.fromDate(date),
  });
  const sigRef = ctx.register(sigDict);
  const widget = ctx.obj({
    Type: 'Annot',
    Subtype: 'Widget',
    FT: 'Sig',
    Rect: [0, 0, 0, 0],
    V: sigRef,
    T: PDFString.of(`Assinatura ${a1.info.nome}`),
    F: 4,
    P: pages[0].ref,
  });
  const widgetRef = ctx.register(widget);
  const annots = pages[0].node.lookupMaybe(PDFName.of('Annots'), PDFArray);
  if (annots) annots.push(widgetRef);
  else pages[0].node.set(PDFName.of('Annots'), ctx.obj([widgetRef]));
  doc.catalog.set(PDFName.of('AcroForm'), ctx.obj({ SigFlags: 3, Fields: [widgetRef] }));

  const saved = await doc.save({ useObjectStreams: false });
  const bin = bytesToBinary(saved);

  // Posições do campo de assinatura e do intervalo de bytes.
  const brMarker = `/ByteRange [ 0 /${BYTE_RANGE_PLACEHOLDER} /${BYTE_RANGE_PLACEHOLDER} /${BYTE_RANGE_PLACEHOLDER} ]`;
  const brPos = bin.indexOf(brMarker);
  if (brPos < 0) throw new Error('Não foi possível preparar a assinatura do PDF.');
  const contentsTag = `/Contents <${'0'.repeat(32)}`;
  const contentsPos = bin.indexOf(contentsTag, 0);
  if (contentsPos < 0) throw new Error('Não foi possível preparar a assinatura do PDF.');
  const start = contentsPos + '/Contents '.length; // posição do "<"
  const end = start + SIGNATURE_BYTES * 2 + 2; // depois do ">"
  if (saved[end - 1] !== 0x3e) throw new Error('Estrutura inesperada no PDF.');

  const range = [0, start, end, saved.length - end];
  let brText = `/ByteRange [${range.join(' ')}]`;
  if (brText.length > brMarker.length) throw new Error('Documento grande demais para assinar.');
  brText = brText.padEnd(brMarker.length, ' ');
  const out = new Uint8Array(saved);
  for (let i = 0; i < brText.length; i++) out[brPos + i] = brText.charCodeAt(i);

  const signedPart = bytesToBinary(out.subarray(0, start)) + bytesToBinary(out.subarray(end));
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(signedPart);
  p7.addCertificate(a1.certificate);
  a1.chain.forEach((c) => p7.addCertificate(c));
  p7.addSigner({
    key: a1.key,
    certificate: a1.certificate,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: date as unknown as string },
    ],
  });
  p7.sign({ detached: true });
  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  const hex = forge.util.bytesToHex(der);
  if (hex.length > SIGNATURE_BYTES * 2) throw new Error('Assinatura maior que o espaço reservado.');
  const padded = hex.padEnd(SIGNATURE_BYTES * 2, '0');
  for (let i = 0; i < padded.length; i++) out[start + 1 + i] = padded.charCodeAt(i);
  return out;
}
