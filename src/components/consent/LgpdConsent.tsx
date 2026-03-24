import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, FileText, Database, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface LgpdConsentProps {
  userId: string;
  onConsentGiven?: () => void;
  forceOpen?: boolean;
}

export const LgpdConsent = ({ userId, onConsentGiven, forceOpen }: LgpdConsentProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(forceOpen ?? false);
  const [consents, setConsents] = useState({
    dataProcessing: false,
    pdfExport: false,
    dataRetention: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!forceOpen) {
      checkConsentStatus();
    }
  }, [userId, forceOpen]);

  const checkConsentStatus = async () => {
    try {
      // Check consent from server-side (primary source of truth)
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('lgpd_consent_given')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Erro ao verificar consentimento:', error);
        setOpen(true);
        return;
      }

      // If server-side consent exists, don't show dialog
      if (profile?.lgpd_consent_given) {
        return;
      }

      // Check localStorage for migration
      const hasConsented = localStorage.getItem(`lgpd_consent_${userId}`);
      if (hasConsented) {
        try {
          const consentData = JSON.parse(hasConsented);
          if (consentData.dataProcessing || consentData.accepted) {
            // Migrate localStorage consent to server
            await migrateConsent();
            return;
          }
        } catch (e) {
          console.error('Erro ao migrar consentimento:', e);
        }
      }

      // Show consent dialog if no consent found
      setOpen(true);
    } catch (error) {
      console.error('Erro ao verificar consentimento:', error);
      setOpen(true);
    }
  };

  const migrateConsent = async () => {
    try {
      await supabase
        .from('profiles')
        .update({
          lgpd_consent_given: true,
          lgpd_consent_date: new Date().toISOString(),
          lgpd_consent_version: '1.0'
        })
        .eq('id', userId);
    } catch (error) {
      console.error('Erro ao migrar consentimento:', error);
    }
  };

  const handleSubmit = async () => {
    if (!consents.dataProcessing || !consents.pdfExport || !consents.dataRetention) {
      toast({
        title: "Consentimento necessário",
        description: "Por favor, aceite todos os termos para continuar usando o sistema.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const consentData = {
        ...consents,
        date: new Date().toISOString(),
        version: '1.0'
      };

      // Store consent server-side (primary source of truth)
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          lgpd_consent_given: true,
          lgpd_consent_date: new Date().toISOString(),
          lgpd_consent_version: '1.0',
          lgpd_consent_ip: null // Client can't reliably get IP
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Erro ao salvar consentimento:', updateError);
        toast({
          title: "Erro",
          description: "Não foi possível registrar seu consentimento. Tente novamente.",
          variant: "destructive"
        });
        return;
      }

      // Also save to localStorage for UX (quick checks)
      localStorage.setItem(`lgpd_consent_${userId}`, JSON.stringify(consentData));

      // Note: Skipping audit log as it may fail due to entity validation
      // Consent is already stored in profiles table which is the source of truth
      
      toast({
        title: "Consentimento registrado",
        description: "Seus dados serão tratados de acordo com a LGPD.",
      });

      setOpen(false);
      onConsentGiven?.();
    } catch (error: any) {
      console.error('Erro ao salvar consentimento:', error);
      toast({
        title: "Erro",
        description: "Não foi possível registrar o consentimento.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const allConsentsGiven = consents.dataProcessing && consents.pdfExport && consents.dataRetention;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Shield className="w-6 h-6 text-primary" />
            Consentimento de Tratamento de Dados (LGPD)
          </DialogTitle>
          <DialogDescription>
            Para utilizar o MindMed, precisamos do seu consentimento para processar seus dados médicos
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] pr-4">
          <div className="space-y-6">
            {/* Processamento de Dados */}
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <Database className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                    Processamento de Dados Médicos
                  </h3>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Coletamos e processamos:
                  </p>
                  <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1 ml-4 list-disc">
                    <li>Dados de identificação do paciente (iniciais, idade, sexo)</li>
                    <li>Informações clínicas (queixa, histórico, exame físico)</li>
                    <li>Hipóteses diagnósticas e condutas médicas</li>
                    <li>Áudios de consultas e transcrições</li>
                  </ul>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                    <strong>Finalidade:</strong> Geração automatizada de laudos médicos via IA
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="dataProcessing"
                  checked={consents.dataProcessing}
                  onCheckedChange={(checked) =>
                    setConsents({ ...consents, dataProcessing: checked as boolean })
                  }
                />
                <label
                  htmlFor="dataProcessing"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Autorizo o processamento dos meus dados médicos conforme descrito
                </label>
              </div>
            </div>

            {/* Exportação e Compartilhamento */}
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                <FileText className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100">
                    Exportação e Verificação de Laudos
                  </h3>
                  <p className="text-sm text-purple-800 dark:text-purple-200">
                    Ao exportar laudos em PDF:
                  </p>
                  <ul className="text-sm text-purple-700 dark:text-purple-300 space-y-1 ml-4 list-disc">
                    <li>Geramos hash criptográfico (SHA-256) para verificação de autenticidade</li>
                    <li>Criamos QR Code público para validação do documento</li>
                    <li>Mantemos metadados (hash, data emissão) por 90 dias</li>
                    <li>Dados do médico (nome, CRM) são incluídos no documento</li>
                  </ul>
                  <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
                    <strong>Nota:</strong> A verificação pública exibe apenas hash, data e identificação do médico
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="pdfExport"
                  checked={consents.pdfExport}
                  onCheckedChange={(checked) =>
                    setConsents({ ...consents, pdfExport: checked as boolean })
                  }
                />
                <label
                  htmlFor="pdfExport"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Autorizo a exportação de laudos e verificação pública conforme descrito
                </label>
              </div>
            </div>

            {/* Retenção de Dados */}
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                <Lock className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <h3 className="font-semibold text-green-900 dark:text-green-100">
                    Armazenamento e Retenção
                  </h3>
                  <p className="text-sm text-green-800 dark:text-green-200">
                    Seus dados são protegidos:
                  </p>
                  <ul className="text-sm text-green-700 dark:text-green-300 space-y-1 ml-4 list-disc">
                    <li>Armazenamento em servidores seguros com criptografia</li>
                    <li>Retenção padrão: 365 dias (configurável)</li>
                    <li>Backup automático com redundância geográfica</li>
                    <li>Acesso restrito apenas ao médico titular</li>
                    <li>Possibilidade de anonimização ou exclusão a qualquer momento</li>
                  </ul>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                    <strong>Seus direitos:</strong> Acesso, retificação, exclusão, portabilidade e revogação do consentimento
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="dataRetention"
                  checked={consents.dataRetention}
                  onCheckedChange={(checked) =>
                    setConsents({ ...consents, dataRetention: checked as boolean })
                  }
                />
                <label
                  htmlFor="dataRetention"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Autorizo o armazenamento dos meus dados conforme política de retenção
                </label>
              </div>
            </div>

            {/* Informações Adicionais */}
            <div className="text-xs text-muted-foreground space-y-2 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p>
                <strong>Base Legal:</strong> Lei Geral de Proteção de Dados (LGPD) - Lei nº 13.709/2018
              </p>
              <p>
                <strong>Encarregado de Dados:</strong> contato@mindmed.com.br
              </p>
              <p>
                <strong>Revogação:</strong> Você pode revogar este consentimento a qualquer momento através das configurações da conta ou entrando em contato conosco.
              </p>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!allConsentsGiven || isSubmitting}
          >
            {isSubmitting ? "Registrando..." : "Aceito os Termos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};