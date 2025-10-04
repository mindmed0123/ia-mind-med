import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UserX, AlertTriangle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AnonymizeDialogProps {
  laudoId: string;
  patientName: string;
  onAnonymized?: () => void;
}

export const AnonymizeDialog = ({ laudoId, patientName, onAnonymized }: AnonymizeDialogProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAnonymize = async () => {
    if (confirmation !== "CONFIRMAR") {
      toast({
        title: "Confirmação necessária",
        description: "Digite CONFIRMAR para prosseguir",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    try {
      // Buscar laudo atual
      const { data: laudo, error: fetchError } = await supabase
        .from('laudos')
        .select('sections, patient_data')
        .eq('id', laudoId)
        .single();

      if (fetchError) throw fetchError;

      // Gerar hash do nome para anonimização
      const hashBuffer = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(patientName + laudoId)
      );
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      const anonymousId = `PAC-${hash.substring(0, 8).toUpperCase()}`;

      // Atualizar sections
      const sectionsData = (laudo.sections || {}) as Record<string, any>;
      const updatedSections = { ...sectionsData };
      if (updatedSections.identificacao) {
        updatedSections.identificacao.nome = anonymousId;
      }

      // Atualizar patient_data
      const patientData = (laudo.patient_data || {}) as Record<string, any>;
      const updatedPatientData = { ...patientData };
      if (updatedPatientData.iniciais) {
        updatedPatientData.iniciais = anonymousId;
      }

      // Salvar no banco
      const { error: updateError } = await supabase
        .from('laudos')
        .update({
          sections: updatedSections as any,
          patient_data: updatedPatientData as any
        })
        .eq('id', laudoId);

      if (updateError) throw updateError;

      // Registrar auditoria
      await supabase.rpc('log_audit_action', {
        p_entity: 'REPORT',
        p_entity_id: laudoId,
        p_action: 'ANONYMIZE',
        p_diff: {
          original_name: patientName,
          anonymized_id: anonymousId,
          timestamp: new Date().toISOString()
        }
      });

      toast({
        title: "Laudo anonimizado",
        description: `O paciente agora é identificado como ${anonymousId}`,
      });

      setOpen(false);
      setConfirmation("");
      onAnonymized?.();
    } catch (error: any) {
      console.error('Erro ao anonimizar:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível anonimizar o laudo",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserX className="w-4 h-4 mr-2" />
          Anonimizar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserX className="w-5 h-5" />
            Anonimizar Laudo
          </DialogTitle>
          <DialogDescription>
            Esta ação substituirá os dados pessoais do paciente por um identificador único e anônimo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Atenção:</strong> Esta ação é irreversível. Os dados pessoais originais serão permanentemente substituídos.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <p className="text-sm">
              <strong>Paciente atual:</strong> {patientName}
            </p>
            <p className="text-sm text-muted-foreground">
              Será substituído por um código anônimo (ex: PAC-A1B2C3D4)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmation">
              Digite <strong>CONFIRMAR</strong> para prosseguir:
            </Label>
            <Input
              id="confirmation"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value.toUpperCase())}
              placeholder="CONFIRMAR"
            />
          </div>

          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              A anonimização é registrada no log de auditoria e é compatível com as diretrizes da LGPD para 
              pesquisas e estatísticas que não permitam identificação individual.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setOpen(false);
              setConfirmation("");
            }}
            disabled={isProcessing}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleAnonymize}
            disabled={confirmation !== "CONFIRMAR" || isProcessing}
          >
            {isProcessing ? "Processando..." : "Anonimizar Laudo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};