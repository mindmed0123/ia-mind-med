import { Link } from "react-router-dom";
import { PremiumButton, OutlinePremiumButton } from "@/components/ui/button-variants";
import { FileAudio, FileText, FileCheck, Shield, Zap, Target, CheckCircle2, MessageCircle, Clock, Brain, Sparkles, Stethoscope, Users, TrendingUp, AlertCircle, BarChart3, Flame, Timer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
const Home = () => {
  const howItWorks = [{
    icon: FileAudio,
    title: "Escuta em tempo real",
    description: "Nossa IA capta e transcreve automaticamente toda a consulta com precisão médica"
  }, {
    icon: FileText,
    title: "Organiza laudos estruturados",
    description: "Transforma a conversa em laudos prontos, com todos os dados organizados"
  }, {
    icon: Brain,
    title: "Sugere diagnósticos",
    description: "Dois diagnósticos: o mais provável e uma alternativa clínica"
  }, {
    icon: FileCheck,
    title: "Integra com PEP",
    description: "Copie direto para seu prontuário eletrônico de forma segura"
  }];
  const benefits = [{
    icon: Clock,
    title: "40% menos tempo",
    description: "Economize até 40% do tempo gasto em prontuários"
  }, {
    icon: Users,
    title: "Atenda mais pacientes",
    description: "Sem aumentar sua carga horária ou comprometer qualidade"
  }, {
    icon: Target,
    title: "Menos erros clínicos",
    description: "Laudos estruturados reduzem riscos de falhas"
  }, {
    icon: Shield,
    title: "LGPD by design",
    description: "Proteção máxima de dados sensíveis e compliance total"
  }, {
    icon: Brain,
    title: "Mais clareza",
    description: "Diagnósticos organizados aumentam sua confiança clínica"
  }, {
    icon: Sparkles,
    title: "Menos burocracia",
    description: "Foque no que realmente importa: cuidar de pacientes"
  }];
  const testimonials = [{
    icon: TrendingUp,
    stat: "2x",
    label: "mais foco no paciente durante a consulta"
  }, {
    icon: Brain,
    stat: "100%",
    label: "mais clareza e confiança nos diagnósticos"
  }, {
    icon: BarChart3,
    stat: "40%",
    label: "redução do estresse e sobrecarga mental"
  }];
  return <div className="min-h-screen">
      <Navbar />

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 gradient-primary text-white">
        <div className="container mx-auto text-center max-w-4xl">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm text-white text-sm font-medium mb-6 animate-fade-in border border-white/20">
            <Sparkles className="w-4 h-4" />
            Faça 10 consultas testes • LGPD by design
          </div>

          <h1 className="mb-6 text-balance animate-fade-up text-white text-5xl md:text-6xl font-bold">
            O Maior Inimigo do Burnout Médico
          </h1>

          <p className="text-xl text-white/90 mb-8 max-w-3xl mx-auto text-balance animate-fade-up leading-relaxed" style={{
          animationDelay: "0.1s"
        }}>
            Transforme suas consultas em laudos completos com inteligência artificial auditável, 
            reduza até <strong className="text-white font-bold">40% da burocracia clínica</strong> e foque no que 
            realmente importa: <strong className="text-white font-bold">seus pacientes</strong>.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-up" style={{
          animationDelay: "0.2s"
        }}>
            <Link to="/auth">
              
            </Link>
          </div>
        </div>
      </section>

      {/* Seção 1 - Problema */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center space-y-6 animate-fade-up">
            <h2 className="text-4xl md:text-5xl font-bold mb-8">
              Você se formou para salvar vidas.
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed">
              Mas hoje, gasta quase <strong className="text-foreground">metade do tempo</strong> em frente ao computador 
              digitando relatórios, prontuários e anotações repetitivas.
            </p>
            <p className="text-xl text-muted-foreground leading-relaxed">
              Isso não é medicina. <strong className="text-foreground">Isso é burocracia.</strong>
            </p>
            <p className="text-xl text-muted-foreground leading-relaxed">
              E é por isso que o burnout médico está entre as maiores causas de 
              <strong className="text-destructive"> afastamento e desistência da profissão</strong>.
            </p>
          </div>
        </div>
      </section>

      {/* Seção 2 - A Solução */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="mb-6 text-4xl md:text-5xl font-bold">A Solução</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              A <strong className="text-primary">MindMed</strong> foi criada para devolver ao médico 
              o que lhe pertence: <strong className="text-foreground">tempo, clareza e qualidade de vida</strong>.
            </p>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto mt-4">
              Com tecnologia de ponta em transcrição automática e geração de laudos inteligentes, nossa IA:
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {howItWorks.map((item, index) => <Card key={index} className="shadow-soft hover:shadow-medium transition-smooth border-2 animate-fade-up" style={{
            animationDelay: `${index * 0.1}s`
          }}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-accent" />
                        {item.title}
                      </h3>
                      <p className="text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>)}
          </div>
        </div>
      </section>

      {/* Seção 3 - Benefícios */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="mb-4 text-4xl md:text-5xl font-bold">Benefícios Claros e Tangíveis</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((benefit, index) => <Card key={index} className="shadow-soft hover:shadow-medium transition-smooth text-center animate-fade-up" style={{
            animationDelay: `${index * 0.1}s`
          }}>
                <CardContent className="pt-6">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <benefit.icon className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{benefit.title}</h3>
                  <p className="text-muted-foreground">{benefit.description}</p>
                </CardContent>
              </Card>)}
          </div>
        </div>
      </section>

      {/* Seção 4 - Prova Social */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              📊 Médicos que testaram a MindMed relatam:
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => <Card key={index} className="shadow-soft hover:shadow-medium transition-smooth text-center animate-fade-up border-2" style={{
            animationDelay: `${index * 0.1}s`
          }}>
                <CardContent className="pt-6">
                  <testimonial.icon className="w-12 h-12 text-primary mx-auto mb-4" />
                  <div className="text-5xl font-bold text-primary mb-3">{testimonial.stat}</div>
                  <p className="text-lg text-muted-foreground">{testimonial.label}</p>
                </CardContent>
              </Card>)}
          </div>
        </div>
      </section>

      {/* Seção 5 - Oferta/Plano */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-semibold mb-6">
              <Flame className="w-4 h-4" />
              Oferta Especial
            </div>
            <h2 className="mb-4 text-4xl md:text-5xl font-bold">Plano Starter</h2>
            <p className="text-lg text-muted-foreground">
              🔥 Comece agora e revolucione sua rotina clínica
            </p>
          </div>

          <Card className="shadow-large border-2 border-primary max-w-2xl mx-auto">
            <CardContent className="pt-8 pb-8">
              <div className="text-center mb-8">
                <div className="mb-4">
                  <span className="text-6xl font-bold text-primary">R$ 99,90</span>
                  <span className="text-2xl text-muted-foreground"></span>
                </div>
                <p className="text-muted-foreground">
                  Inclui <strong className="text-foreground">10 consultas </strong> de teste
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Após o período inicial, planos completos a partir de R$ 299,00/mês
                </p>
              </div>

              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-accent flex-shrink-0 mt-0.5" />
                  <span className="text-base">Transcrição em tempo real com precisão médica</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-accent flex-shrink-0 mt-0.5" />
                  <span className="text-base">Laudos estruturados prontos para PEP</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-accent flex-shrink-0 mt-0.5" />
                  <span className="text-base">Sugestão de dois diagnósticos por consulta</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-accent flex-shrink-0 mt-0.5" />
                  <span className="text-base">Proteção máxima: LGPD by design</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-accent flex-shrink-0 mt-0.5" />
                  <span className="text-base">Suporte por email e documentação completa</span>
                </li>
              </ul>

              <Link to="/auth" className="block">
                <PremiumButton className="w-full text-lg py-6">
                  🔵 Comece agora e revolucione sua rotina clínica
                </PremiumButton>
              </Link>
            </CardContent>
          </Card>

          <div className="text-center mt-12">
            <Link to="/precos" className="text-primary hover:underline font-medium text-lg">
              Ver todos os planos disponíveis →
            </Link>
          </div>
        </div>
      </section>

      {/* Seção 6 - Urgência */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <Card className="shadow-xl border-2 border-accent bg-gradient-to-br from-accent/5 to-accent/10">
            <CardContent className="pt-8 pb-8">
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-accent-foreground text-sm font-semibold mb-6">
                  <AlertCircle className="w-4 h-4" />
                  Vagas Limitadas
                </div>
                <h2 className="mb-4 text-3xl md:text-4xl font-bold">
                  ⚠️ Vagas limitadas para early adopters médicos
                </h2>
                <p className="text-lg text-muted-foreground mb-6">
                  com benefícios exclusivos:
                </p>
              </div>

              <div className="space-y-4 mb-8 max-w-2xl mx-auto">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-accent flex-shrink-0 mt-0.5" />
                  <span className="text-base"><strong>Suporte VIP</strong> direto com nossa equipe técnica</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-accent flex-shrink-0 mt-0.5" />
                  <span className="text-base"><strong>Grupo privado no WhatsApp</strong> com atualizações e networking médico</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-accent flex-shrink-0 mt-0.5" />
                  <span className="text-base"><strong>Prioridade</strong> em novas integrações e funcionalidades</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-accent flex-shrink-0 mt-0.5" />
                  <span className="text-base"><strong>Desconto vitalício</strong> no upgrade para planos superiores</span>
                </div>
              </div>

              <Link to="/auth" className="block">
                <PremiumButton className="w-full text-lg py-6 shadow-xl">
                  🔵 Quero ser um early adopter agora!
                </PremiumButton>
              </Link>

              <p className="text-center text-sm text-muted-foreground mt-4">
                <Timer className="w-4 h-4 inline mr-1" />
                Apenas <strong className="text-accent">50 vagas disponíveis</strong> neste lote
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 px-4 gradient-primary text-white">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="mb-6 text-white text-4xl md:text-5xl font-bold">
            Pronto para acabar com o burnout?
          </h2>
          <p className="text-xl mb-8 text-white/90 max-w-2xl mx-auto leading-relaxed">
            Junte-se aos médicos que já recuperaram <strong className="text-white">tempo</strong>, 
            <strong className="text-white"> clareza</strong> e <strong className="text-white">qualidade de vida</strong> para 
            focar no que realmente importa: <strong className="text-white">cuidar de pacientes</strong>.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth">
              <PremiumButton className="bg-white text-primary hover:bg-white/90 shadow-xl text-lg px-8 py-6">
                🔵 Quero testar agora
              </PremiumButton>
            </Link>
            <a href="https://wa.me/55XXXXXXXXXXX" target="_blank" rel="noopener noreferrer">
              <OutlinePremiumButton className="border-2 border-white text-white hover:bg-white hover:text-primary text-lg px-8 py-6">
                <MessageCircle className="w-5 h-5 mr-2" />
                Falar com consultor
              </OutlinePremiumButton>
            </a>
          </div>

          <p className="text-sm text-white/80 mt-6">
            ⏱️ Vagas limitadas • Suporte VIP • Grupo exclusivo
          </p>
        </div>
      </section>

      <Footer />
    </div>;
};
export default Home;