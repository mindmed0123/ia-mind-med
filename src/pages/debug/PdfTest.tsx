import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FileText, Download } from "lucide-react";

const PdfTest = () => {
  const [testHtml] = useState(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    h1 { color: #2563eb; }
    .section { margin: 20px 0; }
  </style>
</head>
<body>
  <h1>Teste de Geração de PDF</h1>
  <div class="section">
    <h2>Informações do Paciente</h2>
    <p>Nome: João Silva</p>
    <p>Idade: 45 anos</p>
  </div>
  <div class="section">
    <h2>Diagnóstico</h2>
    <p>Teste de renderização de PDF no MindMed</p>
  </div>
</body>
</html>
  `);

  const handleTestRender = () => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.top = '0';
    iframe.style.left = '0';
    iframe.style.zIndex = '9999';
    iframe.style.background = 'white';
    
    document.body.appendChild(iframe);
    
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(testHtml);
      iframeDoc.close();
    }
    
    setTimeout(() => {
      const closeBtn = document.createElement('button');
      closeBtn.textContent = 'Fechar Preview';
      closeBtn.style.position = 'fixed';
      closeBtn.style.top = '10px';
      closeBtn.style.right = '10px';
      closeBtn.style.zIndex = '10000';
      closeBtn.style.padding = '10px 20px';
      closeBtn.style.background = '#dc2626';
      closeBtn.style.color = 'white';
      closeBtn.style.border = 'none';
      closeBtn.style.borderRadius = '6px';
      closeBtn.style.cursor = 'pointer';
      closeBtn.onclick = () => {
        document.body.removeChild(iframe);
        document.body.removeChild(closeBtn);
      };
      document.body.appendChild(closeBtn);
    }, 100);
  };

  return (
    <div className="min-h-screen bg-gradient-subtle p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-2 mb-6">
          <FileText className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">Debug: Teste de PDF</h1>
          <Badge variant="secondary">Desenvolvimento</Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Preview de Renderização HTML</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Este teste mostra como o HTML será renderizado antes de ser convertido em PDF.
            </p>
            
            <Textarea
              value={testHtml}
              readOnly
              rows={15}
              className="font-mono text-xs"
            />
            
            <div className="flex gap-2">
              <Button onClick={handleTestRender}>
                <FileText className="w-4 h-4 mr-2" />
                Preview HTML
              </Button>
              <Button variant="outline" disabled>
                <Download className="w-4 h-4 mr-2" />
                Baixar PDF (Em desenvolvimento)
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Informações de Diagnóstico</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium">Edge Function</p>
                <Badge variant="secondary">export-pdf</Badge>
              </div>
              <div>
                <p className="text-sm font-medium">Status</p>
                <Badge>Configurado</Badge>
              </div>
              <div>
                <p className="text-sm font-medium">Biblioteca PDF</p>
                <p className="text-sm text-muted-foreground">html2pdf.js / puppeteer</p>
              </div>
              <div>
                <p className="text-sm font-medium">Formato</p>
                <p className="text-sm text-muted-foreground">A4, 2cm margens</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-2">📝 Notas de Desenvolvimento</h3>
            <ul className="text-sm space-y-1 text-blue-900 dark:text-blue-100">
              <li>• A conversão HTML→PDF será feita no Edge Function em produção</li>
              <li>• QR Code de verificação será gerado com a biblioteca qrcode</li>
              <li>• Hash SHA-256 será calculado do conteúdo completo do laudo</li>
              <li>• PDF será armazenado no Supabase Storage por 90 dias</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PdfTest;