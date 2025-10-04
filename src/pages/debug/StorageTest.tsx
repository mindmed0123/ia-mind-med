import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Download, Trash2, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const StorageTest = () => {
  const { toast } = useToast();
  const [testStatus, setTestStatus] = useState<{
    write: 'idle' | 'success' | 'error';
    read: 'idle' | 'success' | 'error';
  }>({ write: 'idle', read: 'idle' });
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const testWriteOperation = async () => {
    setIsLoading(true);
    try {
      // Criar um arquivo de teste
      const testContent = `Teste de escrita - ${new Date().toISOString()}`;
      const blob = new Blob([testContent], { type: 'text/plain' });
      const fileName = `test-${Date.now()}.txt`;
      const filePath = `debug/${fileName}`;

      // Upload para o Storage
      const { error: uploadError } = await supabase.storage
        .from('audio-files')
        .upload(filePath, blob);

      if (uploadError) throw uploadError;

      setUploadedFile(filePath);
      setTestStatus(prev => ({ ...prev, write: 'success' }));
      
      toast({
        title: "✅ Escrita bem-sucedida",
        description: `Arquivo ${fileName} criado com sucesso`
      });
    } catch (error: any) {
      console.error('Erro na escrita:', error);
      setTestStatus(prev => ({ ...prev, write: 'error' }));
      
      toast({
        title: "❌ Erro na escrita",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testReadOperation = async () => {
    if (!uploadedFile) {
      toast({
        title: "Atenção",
        description: "Execute o teste de escrita primeiro",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      // Tentar ler o arquivo
      const { data, error } = await supabase.storage
        .from('audio-files')
        .download(uploadedFile);

      if (error) throw error;

      if (data) {
        const text = await data.text();
        console.log('Conteúdo lido:', text);
        setTestStatus(prev => ({ ...prev, read: 'success' }));
        
        toast({
          title: "✅ Leitura bem-sucedida",
          description: `Arquivo lido: ${text.substring(0, 50)}...`
        });
      }
    } catch (error: any) {
      console.error('Erro na leitura:', error);
      setTestStatus(prev => ({ ...prev, read: 'error' }));
      
      toast({
        title: "❌ Erro na leitura",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const cleanupTest = async () => {
    if (!uploadedFile) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.storage
        .from('audio-files')
        .remove([uploadedFile]);

      if (error) throw error;

      setUploadedFile(null);
      setTestStatus({ write: 'idle', read: 'idle' });
      
      toast({
        title: "Limpeza concluída",
        description: "Arquivo de teste removido"
      });
    } catch (error: any) {
      console.error('Erro na limpeza:', error);
      toast({
        title: "Erro na limpeza",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: 'idle' | 'success' | 'error') => {
    switch (status) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error': return <XCircle className="w-5 h-5 text-red-500" />;
      default: return <div className="w-5 h-5 rounded-full border-2 border-gray-300" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-2 mb-6">
          <Upload className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">Debug: Teste de Storage</h1>
          <Badge variant="secondary">Desenvolvimento</Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Testes de Operações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                onClick={testWriteOperation}
                disabled={isLoading}
                className="h-20 flex flex-col gap-2"
              >
                <Upload className="w-6 h-6" />
                <span>1. Testar Escrita</span>
              </Button>

              <Button
                onClick={testReadOperation}
                disabled={isLoading || !uploadedFile}
                variant="outline"
                className="h-20 flex flex-col gap-2"
              >
                <Download className="w-6 h-6" />
                <span>2. Testar Leitura</span>
              </Button>

              <Button
                onClick={cleanupTest}
                disabled={isLoading || !uploadedFile}
                variant="destructive"
                className="h-20 flex flex-col gap-2"
              >
                <Trash2 className="w-6 h-6" />
                <span>3. Limpar Teste</span>
              </Button>
            </div>

            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <span className="text-sm font-medium">Escrita S3</span>
                {getStatusIcon(testStatus.write)}
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <span className="text-sm font-medium">Leitura S3</span>
                {getStatusIcon(testStatus.read)}
              </div>
            </div>

            {uploadedFile && (
              <Alert>
                <AlertDescription>
                  <strong>Arquivo ativo:</strong> {uploadedFile}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configuração do Storage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium">Bucket</p>
                <Badge variant="secondary">audio-files</Badge>
              </div>
              <div>
                <p className="text-sm font-medium">Visibilidade</p>
                <Badge>Privado</Badge>
              </div>
              <div>
                <p className="text-sm font-medium">Limite de Upload</p>
                <p className="text-sm text-muted-foreground">50 MB</p>
              </div>
              <div>
                <p className="text-sm font-medium">Retenção</p>
                <p className="text-sm text-muted-foreground">365 dias</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estrutura de Pastas</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg text-sm">
{`audio-files/
├── reports/
│   └── {report_id}/
│       ├── exports/
│       │   └── {timestamp}.pdf
│       └── imports/
│           └── {filename}.pdf
├── audio/
│   └── {user_id}/
│       └── {recording}.mp3
└── debug/
    └── test-*.txt`}
            </pre>
          </CardContent>
        </Card>

        <Card className="bg-green-50 dark:bg-green-950 border-green-200">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-2">✅ Checklist de Storage</h3>
            <ul className="text-sm space-y-1 text-green-900 dark:text-green-100">
              <li>• Bucket 'audio-files' configurado com RLS</li>
              <li>• Políticas de acesso privado por user_id</li>
              <li>• URLs assinadas com expiração de 7 dias para downloads</li>
              <li>• Suporte a uploads de até 50MB</li>
              <li>• Retenção automática configurável via ENV</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StorageTest;