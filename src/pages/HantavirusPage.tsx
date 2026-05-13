import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { HantavirusButton } from "@/components/hantavirus/HantavirusButton";
import { HantavirusHistorico } from "@/components/hantavirus/HantavirusHistorico";

export default function HantavirusPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-30">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            <div>
              <h1 className="text-lg font-semibold flex items-center gap-2">
                🦠 Triagem Hantavírus
              </h1>
              <p className="text-xs text-muted-foreground">
                Auxílio diagnóstico — Surto ativo maio 2026
              </p>
            </div>
          </div>
          <Badge className="bg-red-600 hover:bg-red-600 text-white animate-pulse">
            SURTO ATIVO
          </Badge>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="pt-5 space-y-2 text-sm">
            <p className="font-semibold text-red-800">
              🚨 Surto internacional do vírus Andes (maio 2026)
            </p>
            <p className="text-red-700">
              Em maio de 2026, foi confirmado um surto do vírus Andes a bordo do navio MV Hondius.
              O vírus Andes é o único hantavírus com transmissão humano-humano.
              Mortalidade ~40%. Mantenha vigilância ativa.
            </p>
            <div className="flex flex-wrap gap-3 text-xs pt-1">
              <a className="underline text-red-700" href="https://www.cdc.gov/hantavirus/" target="_blank" rel="noreferrer">CDC</a>
              <a className="underline text-red-700" href="https://www.ecdc.europa.eu/en/hantavirus-infection" target="_blank" rel="noreferrer">ECDC</a>
              <a className="underline text-red-700" href="https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/h/hantavirose" target="_blank" rel="noreferrer">Ministério da Saúde</a>
            </div>
          </CardContent>
        </Card>

        <HantavirusButton variant="alert" />

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <InfoCard emoji="🦠" title="O que é"
            text="Vírus RNA da família Hantaviridae. Causa SPH (síndrome pulmonar) e febre hemorrágica com síndrome renal." />
          <InfoCard emoji="📊" title="Mortalidade"
            text="~40% nos casos de SPH. Vírus Andes (único com transmissão humano-humano)." />
          <InfoCard emoji="🐀" title="Transmissão"
            text="Contato com roedores infectados, fezes/urina; aerossóis em ambientes fechados." />
          <InfoCard emoji="⚡" title="Curso clínico"
            text="Fase prodrômica (3–7 dias) → fase cardiopulmonar (4–10 dias). Evolução rápida." />
        </div>

        <HantavirusHistorico />
      </main>
    </div>
  );
}

function InfoCard({ emoji, title, text }: { emoji: string; title: string; text: string }) {
  return (
    <Card>
      <CardContent className="pt-5 space-y-1">
        <div className="text-2xl">{emoji}</div>
        <div className="font-semibold">{title}</div>
        <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
      </CardContent>
    </Card>
  );
}
