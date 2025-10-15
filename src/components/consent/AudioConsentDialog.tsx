import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, FileText } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AudioConsentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConsent: () => void;
}

const CONSENT_VERSION = '1.0.0';
const TERMS_URL = '/termos-de-uso';
const PRIVACY_URL = '/politica-de-privacidade';

export const AudioConsentDialog = ({ open, onOpenChange, onConsent }: AudioConsentDialogProps) => {
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleConsent = async () => {
    if (!agreed) {
      toast({
        title: 'Consentimento necessário',
        description: 'Você precisa concordar com os termos para continuar.',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Registrar consentimento
      const { error } = await supabase.from('consent_logs').insert({
        user_id: user.id,
        consent_type: 'audio_processing',
        version: CONSENT_VERSION,
        ip: await fetch('https://api.ipify.org?format=json')
          .then(r => r.json())
          .then(d => d.ip)
          .catch(() => 'unknown'),
        user_agent: navigator.userAgent,
        metadata: {
          timestamp: new Date().toISOString(),
          screen_resolution: `${window.screen.width}x${window.screen.height}`
        }
      });

      if (error) throw error;

      toast({
        title: 'Consentimento registrado',
        description: 'Você pode agora gravar ou enviar áudios.',
      });

      onConsent();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao registrar consentimento:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível registrar o consentimento. Tente novamente.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Consentimento LGPD - Processamento de Áudio
          </DialogTitle>
          <DialogDescription>
            Antes de gravar ou enviar áudio, precisamos do seu consentimento
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4 text-sm">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Este consentimento é obrigatório conforme a Lei Geral de Proteção de Dados (LGPD)
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <h3 className="font-semibold text-base">O que você está autorizando:</h3>
              
              <div className="space-y-2 pl-4">
                <p>✅ <strong>Coleta e armazenamento</strong> de gravações de áudio contendo dados clínicos</p>
                <p>✅ <strong>Transcrição automática</strong> do áudio usando inteligência artificial</p>
                <p>✅ <strong>Processamento dos dados</strong> para geração de laudos médicos</p>
                <p>✅ <strong>Armazenamento seguro</strong> dos dados em servidores criptografados</p>
              </div>

              <h3 className="font-semibold text-base mt-4">Seus direitos (LGPD):</h3>
              
              <div className="space-y-2 pl-4">
                <p>🔒 <strong>Segurança:</strong> Seus dados são criptografados e protegidos</p>
                <p>👁️ <strong>Acesso:</strong> Você pode acessar todos os seus dados a qualquer momento</p>
                <p>✏️ <strong>Correção:</strong> Você pode corrigir dados imprecisos</p>
                <p>🗑️ <strong>Exclusão:</strong> Você pode solicitar a exclusão dos seus dados</p>
                <p>📋 <strong>Portabilidade:</strong> Você pode exportar seus dados</p>
                <p>🚫 <strong>Revogação:</strong> Você pode revogar este consentimento a qualquer momento</p>
              </div>

              <h3 className="font-semibold text-base mt-4">Finalidade do processamento:</h3>
              
              <div className="space-y-2 pl-4">
                <p>📝 Geração automática de laudos médicos</p>
                <p>💾 Armazenamento para histórico e auditoria</p>
                <p>🔍 Melhoria da qualidade dos serviços</p>
              </div>

              <h3 className="font-semibold text-base mt-4">Compartilhamento de dados:</h3>
              
              <div className="space-y-2 pl-4">
                <p>❌ <strong>NÃO</strong> compartilhamos seus dados com terceiros para fins comerciais</p>
                <p>✅ Apenas processadores técnicos necessários (OpenAI para transcrição)</p>
                <p>✅ Compartilhamento apenas com seu consentimento explícito</p>
              </div>

              <div className="mt-6 p-4 bg-muted rounded-lg">
                <p className="text-xs">
                  <strong>Versão do termo:</strong> {CONSENT_VERSION}<br/>
                  <strong>Data:</strong> {new Date().toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="space-y-4">
          <div className="flex items-start space-x-2">
            <Checkbox 
              id="consent" 
              checked={agreed}
              onCheckedChange={(checked) => setAgreed(checked === true)}
            />
            <label 
              htmlFor="consent" 
              className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Li e concordo em coletar, armazenar e processar dados clínicos conforme descrito acima, 
              em conformidade com a LGPD. Declaro também ter lido e concordado com os{' '}
              <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                Termos de Uso
              </a>
              {' '}e a{' '}
              <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                Política de Privacidade
              </a>.
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleConsent} disabled={!agreed || loading}>
            {loading ? 'Registrando...' : 'Aceito e Autorizo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
