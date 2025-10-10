import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import FinancialCalculator from "@/components/FinancialCalculator";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Mic, FileText, Brain, Share2, Shield, Lock, Award, Stethoscope } from "lucide-react";
import heroImage from "@/assets/hero-medical.jpg";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 gradient-primary text-white relative overflow-hidden">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6 animate-fade-in">
              <div className="inline-block px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-sm font-medium">
                IA Médica que Transforma Tempo em Faturamento
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight">
                Transforme 2 horas de papelada em até 10 pacientes a mais por dia
              </h1>
              
              <p className="text-lg md:text-xl text-white/90 leading-relaxed">
                A IA da MindMed automatiza relatórios e transcrições para você focar no que fatura: <strong className="text-white">atender pacientes</strong>.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  size="lg"
                  className="bg-white text-primary hover:bg-white/90 font-semibold text-lg px-8 py-6"
                  asChild
                >
                  <a href="/contato">Recuperar meu tempo agora</a>
                </Button>
                <Button 
                  size="lg"
                  variant="outline"
                  className="border-2 border-white text-white hover:bg-white/10 font-semibold text-lg px-8 py-6"
                  asChild
                >
                  <a href="#calculadora">Calcular ganhos</a>
                </Button>
              </div>
              
              <div className="pt-8">
                <p className="text-white/70 text-sm mb-3">Confiado por médicos em:</p>
                <div className="flex flex-wrap gap-6 text-white/80 text-sm font-medium">
                  <span>Hospital XYZ</span>
                  <span>Clínica ABC</span>
                  <span>Rede Med+</span>
                  <span>Instituto DEF</span>
                </div>
              </div>
            </div>
            
            <div className="relative animate-fade-in" style={{ animationDelay: "0.2s" }}>
              <img 
                src={heroImage} 
                alt="Médica usando tecnologia MindMed"
                className="rounded-2xl shadow-2xl w-full"
              />
              <div className="absolute -bottom-6 -right-6 bg-white rounded-xl p-6 shadow-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-foreground">2.5h</div>
                    <div className="text-sm text-muted-foreground">economizado/dia</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Stats Bar */}
          <div className="mt-20 grid grid-cols-2 md:grid-cols-5 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-white mb-2">10.000+</div>
              <div className="text-white/70 text-sm">Consultas Processadas</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-white mb-2">500+</div>
              <div className="text-white/70 text-sm">Médicos Ativos</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-white mb-2">4.9</div>
              <div className="text-white/70 text-sm">Avaliação Média</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-white mb-2">99.8%</div>
              <div className="text-white/70 text-sm">Precisão IA</div>
            </div>
            <div className="text-center md:col-span-1 col-span-2">
              <div className="text-3xl md:text-4xl font-bold text-white mb-2">2.5h</div>
              <div className="text-white/70 text-sm">economizado/dia</div>
            </div>
          </div>
        </div>
      </section>

      {/* Financial Calculator */}
      <section id="calculadora" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <FinancialCalculator />
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 px-4 bg-background">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <p className="text-primary font-semibold mb-4">Benefícios</p>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Por que escolher a MindMed?</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Tecnologia que entende que <strong className="text-foreground">tempo é dinheiro</strong> na medicina
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="p-6 shadow-soft hover:shadow-medium transition-smooth">
              <div className="text-5xl mb-4">⏱️</div>
              <h3 className="text-xl font-bold mb-3">Mais Tempo</h3>
              <p className="text-muted-foreground">
                Recupere até 75% do tempo gasto em documentação e papelada médica.
              </p>
            </Card>
            
            <Card className="p-6 shadow-soft hover:shadow-medium transition-smooth">
              <div className="text-5xl mb-4">📈</div>
              <h3 className="text-xl font-bold mb-3">Mais Consultas</h3>
              <p className="text-muted-foreground">
                Atenda até 10 pacientes a mais por dia com o tempo recuperado.
              </p>
            </Card>
            
            <Card className="p-6 shadow-soft hover:shadow-medium transition-smooth">
              <div className="text-5xl mb-4">💰</div>
              <h3 className="text-xl font-bold mb-3">Mais Faturamento</h3>
              <p className="text-muted-foreground">
                Aumente sua receita em até 50% sem trabalhar horas extras.
              </p>
            </Card>
            
            <Card className="p-6 shadow-soft hover:shadow-medium transition-smooth">
              <div className="text-5xl mb-4">✅</div>
              <h3 className="text-xl font-bold mb-3">Mais Compliance</h3>
              <p className="text-muted-foreground">
                Documentação padronizada e completa, reduzindo riscos legais.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <p className="text-primary font-semibold mb-4">Como Funciona</p>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">4 passos para recuperar seu tempo</h2>
            <p className="text-xl text-muted-foreground">
              Simples, rápido e integrado ao seu fluxo de trabalho
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="p-8 shadow-soft hover:shadow-medium transition-smooth">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xl flex-shrink-0">
                  01
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-3">Capture o Áudio</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Grave a consulta usando seu smartphone, tablet ou microfone. Nossa IA funciona com qualquer dispositivo.
                  </p>
                </div>
              </div>
            </Card>
            
            <Card className="p-8 shadow-soft hover:shadow-medium transition-smooth">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xl flex-shrink-0">
                  02
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-3">Transcrição Automática</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Nossa IA médica transcreve automaticamente, reconhecendo termos técnicos e jargões da sua especialidade.
                  </p>
                </div>
              </div>
            </Card>
            
            <Card className="p-8 shadow-soft hover:shadow-medium transition-smooth">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xl flex-shrink-0">
                  03
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-3">Geração de Laudo</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Em segundos, seu laudo estruturado está pronto com todas as seções necessárias para seu prontuário.
                  </p>
                </div>
              </div>
            </Card>
            
            <Card className="p-8 shadow-soft hover:shadow-medium transition-smooth">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xl flex-shrink-0">
                  04
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-3">Integração ao EMR</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Exporte diretamente para seu sistema de prontuário eletrônico ou copie com um clique.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Technology & Security */}
      <section className="py-20 px-4 bg-background">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <p className="text-primary font-semibold mb-4">Tecnologia & Segurança</p>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">IA Clínica de Classe Mundial</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Tecnologia de ponta com segurança máxima para seus dados e de seus pacientes
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="p-6 text-center shadow-soft hover:shadow-medium transition-smooth">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-bold mb-3">Criptografia End-to-End</h3>
              <p className="text-sm text-muted-foreground">
                Dados protegidos com criptografia AES-256 em trânsito e em repouso.
              </p>
            </Card>
            
            <Card className="p-6 text-center shadow-soft hover:shadow-medium transition-smooth">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-bold mb-3">Conformidade LGPD</h3>
              <p className="text-sm text-muted-foreground">
                100% adequado à Lei Geral de Proteção de Dados Pessoais.
              </p>
            </Card>
            
            <Card className="p-6 text-center shadow-soft hover:shadow-medium transition-smooth">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Brain className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-bold mb-3">IA Especializada</h3>
              <p className="text-sm text-muted-foreground">
                Modelos treinados especificamente para terminologia médica brasileira.
              </p>
            </Card>
            
            <Card className="p-6 text-center shadow-soft hover:shadow-medium transition-smooth">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Stethoscope className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-bold mb-3">Multi-especialidade</h3>
              <p className="text-sm text-muted-foreground">
                Suporte para mais de 40 especialidades médicas diferentes.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <p className="text-primary font-semibold mb-4">Depoimentos</p>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Médicos que já recuperaram seu tempo</h2>
            <p className="text-xl text-muted-foreground">
              Histórias reais de profissionais que transformaram sua prática
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-8 shadow-soft hover:shadow-medium transition-smooth">
              <div className="mb-6">
                <div className="text-2xl font-bold text-primary mb-2">+35% faturamento</div>
                <div className="text-sm text-muted-foreground">Cardiologia • São Paulo, SP</div>
              </div>
              <p className="text-muted-foreground mb-6 italic leading-relaxed">
                "Recuperei 2 horas por dia que antes gastava com laudos. Agora consigo atender mais pacientes e ainda sair no horário. Meu faturamento aumentou 35% em 3 meses."
              </p>
              <p className="font-semibold">Dra. Ana Silva</p>
            </Card>
            
            <Card className="p-8 shadow-soft hover:shadow-medium transition-smooth">
              <div className="mb-6">
                <div className="text-2xl font-bold text-primary mb-2">10h/semana economizadas</div>
                <div className="text-sm text-muted-foreground">Ortopedia • Rio de Janeiro, RJ</div>
              </div>
              <p className="text-muted-foreground mb-6 italic leading-relaxed">
                "A precisão da transcrição é impressionante. Termos técnicos complexos são capturados perfeitamente. Minha equipe toda usa e economizamos mais de 10 horas por semana."
              </p>
              <p className="font-semibold">Dr. Carlos Mendes</p>
            </Card>
            
            <Card className="p-8 shadow-soft hover:shadow-medium transition-smooth">
              <div className="mb-6">
                <div className="text-2xl font-bold text-primary mb-2">+8 pacientes/dia</div>
                <div className="text-sm text-muted-foreground">Pediatria • Belo Horizonte, MG</div>
              </div>
              <p className="text-muted-foreground mb-6 italic leading-relaxed">
                "Como mãe e médica, tempo é tudo. O MindMed me devolveu meu equilíbrio. Consigo atender mais crianças e ainda ter tempo para minha família. Investimento que se paga sozinho."
              </p>
              <p className="font-semibold">Dra. Marina Costa</p>
            </Card>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 gradient-primary text-white">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Pronto para recuperar seu tempo e aumentar seu faturamento?
          </h2>
          <p className="text-xl text-white/90 mb-8 leading-relaxed">
            Junte-se a centenas de médicos que já transformaram sua prática com a MindMed
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
            <Button 
              size="lg"
              className="bg-white text-primary hover:bg-white/90 font-semibold text-lg px-8 py-6"
              asChild
            >
              <a href="/contato">Solicitar Demonstração Gratuita</a>
            </Button>
            <Button 
              size="lg"
              variant="outline"
              className="border-2 border-white text-white hover:bg-white/10 font-semibold text-lg px-8 py-6"
              asChild
            >
              <a href="/precos">Ver Planos e Preços</a>
            </Button>
          </div>
          
          <p className="text-white/70 text-sm">
            Sem cartão de crédito necessário para demonstração
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
