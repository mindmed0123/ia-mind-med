import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { LaudoForm } from "@/components/laudos/LaudoForm";
import { LaudoViewer } from "@/components/laudos/LaudoViewer";

const NovoLaudo = () => {
  const navigate = useNavigate();
  const [generatedLaudoId, setGeneratedLaudoId] = useState<string | null>(null);

  const handleLaudoGenerated = (laudoId: string) => {
    setGeneratedLaudoId(laudoId);
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao Dashboard
          </Button>
          <h1 className="text-3xl font-bold">
            {generatedLaudoId ? 'Visualizar Laudo' : 'Novo Laudo com IA'}
          </h1>
          <p className="text-muted-foreground mt-2">
            {generatedLaudoId 
              ? 'Laudo gerado com sucesso pela inteligência artificial'
              : 'Preencha os dados clínicos para gerar um laudo estruturado com IA'
            }
          </p>
        </div>

        {generatedLaudoId ? (
          <LaudoViewer laudoId={generatedLaudoId} />
        ) : (
          <LaudoForm onLaudoGenerated={handleLaudoGenerated} />
        )}
      </div>
    </div>
  );
};

export default NovoLaudo;