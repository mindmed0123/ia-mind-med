import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { PremiumButton } from "@/components/ui/button-variants";
import { Link } from "react-router-dom";
import {
  Mic,
  FileText,
  Copy,
  Check,
  Sparkles,
  ArrowRight,
} from "lucide-react";

const Produto = () => {
  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 gradient-subtle">
        <div className="container mx-auto text-center max-w-4xl">
          <h1 className="mb-6 animate-fade-up">Como a MindMed funciona</h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto animate-fade-up" style={{ animationDelay: "0.1s" }}>
            Da gravação ao laudo pronto: veja o fluxo completo que está
            revolucionando a rotina de médicos em todo o Brasil
          </p>
        </div>
      </section>

      {/* Fluxo detalhado */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="space-y-16">
            {/* Passo 1 */}
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="order-2 md:order-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Mic className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-2xl font-semibold">Grave a consulta</h3>
                </div>
                <p className="text-muted-foreground mb-4">
                  Durante a consulta, basta apertar gravar. Nossa tecnologia de
                  transcrição médica captura cada detalhe com precisão, incluindo
                  termos técnicos e nomenclaturas específicas da sua especialidade.
                </p>
                <ul className="space-y-2">
                  {[
                    "Transcrição em tempo real",
                    "Reconhecimento de termos médicos",
                    "Suporte para múltiplos idiomas",
                    "Gravação segura e criptografada",
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-accent" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="order-1 md:order-2">
                <Card className="shadow-large p-8 bg-gradient-to-br from-primary/5 to-accent/5">
                  <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                    <Mic className="w-24 h-24 text-primary/30 animate-float" />
                  </div>
                </Card>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center">
              <ArrowRight className="w-8 h-8 text-primary" />
            </div>

            {/* Passo 2 */}
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <Card className="shadow-large p-8 bg-gradient-to-br from-accent/5 to-primary/5">
                  <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                    <FileText className="w-24 h-24 text-accent/30 animate-float" />
                  </div>
                </Card>
              </div>
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-accent" />
                  </div>
                  <h3 className="text-2xl font-semibold">Resumo estruturado</h3>
                </div>
                <p className="text-muted-foreground mb-4">
                  Nossa IA analisa a transcrição e gera um resumo estruturado com
                  os pontos-chave: anamnese, exame físico, hipóteses diagnósticas,
                  conduta e orientações.
                </p>
                <ul className="space-y-2">
                  {[
                    "Extração automática de informações",
                    "Organização por seções clínicas",
                    "Destaque de sinais de alerta",
                    "Sugestões de CIDs relacionados",
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center">
              <ArrowRight className="w-8 h-8 text-accent" />
            </div>

            {/* Passo 3 */}
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="order-2 md:order-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Copy className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-2xl font-semibold">Laudo pronto para PEP</h3>
                </div>
                <p className="text-muted-foreground mb-4">
                  Receba um laudo formatado e pronto para copiar direto no seu
                  prontuário eletrônico. Revise, ajuste se necessário e finalize
                  em segundos.
                </p>
                <ul className="space-y-2">
                  {[
                    "Formato compatível com PEP",
                    "Edição inline antes de copiar",
                    "Histórico de versões",
                    "Exportação em PDF",
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-accent" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="order-1 md:order-2">
                <Card className="shadow-large p-8 bg-gradient-to-br from-primary/5 to-accent/5">
                  <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                    <Copy className="w-24 h-24 text-primary/30 animate-float" />
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Exemplo antes/depois */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="mb-4">Antes e depois</h2>
            <p className="text-lg text-muted-foreground">
              Veja a diferença na qualidade e tempo de produção
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Antes */}
            <Card className="shadow-soft">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-4 text-destructive">
                  <span className="text-sm font-semibold">ANTES</span>
                  <span className="text-xs text-muted-foreground">
                    (15-20 min por consulta)
                  </span>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg text-sm text-muted-foreground font-mono">
                  <p className="mb-2">Paciente relata dor abdominal...</p>
                  <p className="mb-2">Exame físico: abdomen flácido...</p>
                  <p>Conduta: solicitado exames...</p>
                  <p className="mt-4 text-xs italic">
                    [Anotações fragmentadas, difícil de revisar, sem padronização]
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Depois */}
            <Card className="shadow-soft border-2 border-accent">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-4 text-accent">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-sm font-semibold">DEPOIS</span>
                  <span className="text-xs text-muted-foreground">
                    (3-5 min por consulta)
                  </span>
                </div>
                <div className="bg-accent/5 p-4 rounded-lg text-sm font-mono">
                  <p className="font-semibold mb-2">ANAMNESE:</p>
                  <p className="mb-3 text-muted-foreground">
                    Paciente masculino, 45 anos, relata dor abdominal em
                    epigástrio há 3 dias, tipo queimação, intensidade 6/10...
                  </p>

                  <p className="font-semibold mb-2">EXAME FÍSICO:</p>
                  <p className="mb-3 text-muted-foreground">
                    Abdomen: flácido, ruídos hidroaéreos presentes, dor à
                    palpação profunda em epigástrio...
                  </p>

                  <p className="font-semibold mb-2">HIPÓTESE DIAGNÓSTICA:</p>
                  <p className="mb-3 text-muted-foreground">
                    Gastrite aguda (K29.1)
                  </p>

                  <p className="font-semibold mb-2">CONDUTA:</p>
                  <p className="text-muted-foreground">
                    Solicitado EDA. Prescrito omeprazol 20mg...
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <button className="text-sm text-accent hover:text-accent-hover flex items-center gap-1">
                    <Copy className="w-4 h-4" />
                    Copiar para PEP
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="mb-6">Experimente agora</h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Veja na prática como a MindMed pode transformar sua rotina clínica
          </p>
          <Link to="/auth">
            <PremiumButton>Começar teste grátis</PremiumButton>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Produto;
