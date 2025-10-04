import html2pdf from 'html2pdf.js';
import QRCode from 'qrcode';

interface PdfOptions {
  html: string;
  fileName: string;
  verifyUrl: string;
}

export const generatePdf = async ({ html, fileName, verifyUrl }: PdfOptions): Promise<Blob> => {
  try {
    // Gerar QR Code
    const qrCodeDataUrl = await QRCode.toDataURL(verifyUrl, {
      width: 150,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });

    // Inserir QR Code no HTML
    const htmlWithQr = html.replace(
      '📱 [QR Code seria gerado aqui]',
      `<img src="${qrCodeDataUrl}" alt="QR Code de Verificação" style="max-width: 150px; margin: 10px auto; display: block;" />`
    );

    // Configurações do PDF com tipo correto
    const margin: [number, number, number, number] = [20, 20, 20, 20];
    
    const options = {
      margin,
      filename: fileName,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { 
        scale: 2,
        useCORS: true,
        logging: false
      },
      jsPDF: { 
        unit: 'mm', 
        format: 'a4', 
        orientation: 'portrait' as const,
        compress: true
      }
    };

    // Gerar PDF
    const pdfBlob = await html2pdf()
      .set(options)
      .from(htmlWithQr)
      .output('blob');

    return pdfBlob;
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    throw new Error('Falha na geração do PDF');
  }
};

export const downloadPdf = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

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

    // Gerar URL assinada (válida por 7 dias)
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