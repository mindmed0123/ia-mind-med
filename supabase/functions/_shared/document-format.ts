export type DocumentFormat = {
  fonte: string; corpo: number; margem_superior: number; margem_inferior: number; margem_lateral: number;
  cabecalho: boolean; logo: boolean; papel_timbrado: string | null; rodape: boolean;
};
export const DEFAULT_FORMAT: DocumentFormat = {fonte:'Inter',corpo:10,margem_superior:30,margem_inferior:18,margem_lateral:18,cabecalho:true,logo:true,papel_timbrado:null,rodape:true};
export function normalizeDocumentFormat(raw?: any): DocumentFormat {
  const number = (v: unknown, min: number, max: number, fallback: number) => typeof v === 'number' && Number.isFinite(v) && v>=min && v<=max ? v : fallback;
  return {...DEFAULT_FORMAT, fonte:['Inter','Merriweather','Arial','Times New Roman'].includes(raw?.fonte) ? raw.fonte : DEFAULT_FORMAT.fonte,
    corpo:number(Number(raw?.corpo),8,16,10), margem_superior:number(Number(raw?.margem_superior),25,50,30), margem_inferior:number(Number(raw?.margem_inferior),18,40,18), margem_lateral:number(Number(raw?.margem_lateral),10,35,18),
    cabecalho:raw?.cabecalho !== false,logo:raw?.logo !== false,rodape:raw?.rodape !== false,
    papel_timbrado:typeof raw?.papel_timbrado==='string' && raw.papel_timbrado.startsWith('https://') ? raw.papel_timbrado : null};
}
export function escapeDocument(text: unknown) { return String(text ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
export function formatHtml(html: string, f: DocumentFormat) {
  const css = `<style>body{font-family:'${f.fonte}',Arial,sans-serif!important;font-size:${f.corpo}pt!important} .content-wrapper,.page{font-family:inherit!important} .document-footer{font-size:7pt;overflow-wrap:anywhere;margin-top:16pt} ${!f.cabecalho ? '.header{display:none!important}' : ''}${!f.logo ? '.header img[alt="Logo"]{display:none!important}' : ''} @page{margin:${f.margem_superior}mm ${f.margem_lateral}mm ${f.margem_inferior}mm}</style>`;
  return html.replace('</head>',`${css}</head>`);
}