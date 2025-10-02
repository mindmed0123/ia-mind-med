import { Link } from "react-router-dom";
import { PremiumButton, OutlinePremiumButton } from "@/components/ui/button-variants";
import {
  FileAudio,
  FileText,
  FileCheck,
  Shield,
  Zap,
  Lock,
  CheckCircle2,
  MessageCircle,
  Clock,
  TrendingDown,
  Sparkles,
  Stethoscope,
  Heart,
  Activity,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const Home = () => {
  const features = [
    {
      icon: FileAudio,
      title: "1. Transcreve",
      description: "Grave a consulta e nossa IA transcreve com precisão médica",
    },
    {
      icon: FileText,
      title: "2. Resume",
      description: "Gera resumo estruturado com os pontos-chave da consulta",
    },
    {
      icon: FileCheck,
      title: "3. Laudo PEP",
      description: "Laudo pronto para copiar direto no seu prontuário eletrônico",
    },
  ];

  const benefits = [
    {
      icon: Clock,
      stat: "40%",
      label: "Menos tempo em burocracia",
    },
    {
      icon: TrendingDown,
      stat: "60%",
      label: "Redução de burnout",
    },
    {
      icon: Sparkles,
      stat: "100%",
      label: "Laudos auditáveis",
    },
  ];

  const specialties = [
    { name: "Clínica Geral", icon: Stethoscope },
    { name: "Cardiologia", icon: Heart },
    { name: "Dermatologia", icon: Activity },
    { name: "Pediatria", icon: Heart },
    { name: "Ortopedia", icon: Activity },
    { name: "Odontologia", icon: Activity },
  ];

  const testimonials = [
    {
      name: "Dr. Carlos Mendes",
      specialty: "Cardiologista",
      text: "Reduzi 50% do tempo com anotações. Agora tenho mais tempo para cada paciente.",
    },
    {
      name: "Dra. Ana Paula",
      specialty: "Clínica Geral",
      text: "A precisão dos laudos é impressionante. Me sinto muito mais segura.",
    },
    {
      name: "Dr. Roberto Silva",
      specialty: "Ortopedista",
      text: "Integração perfeita com nosso PEP. Equipe toda adotou rapidamente.",
    },
  ];

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 gradient-subtle">
        <div className="container mx-auto text-center max-w-4xl">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 animate-fade-in">
            <Sparkles className="w-4 h-4" />
            Faça 10 consultas testes • LGPD by design
          </div>

          <h1 className="mb-6 text-balance animate-fade-up">
            Chega de burnout médico
          </h1>

          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto text-balance animate-fade-up" style={{ animationDelay: "0.1s" }}>
            A MindMed reduz até <strong className="text-primary">40% do tempo de burocracia clínica</strong>.
            Transcreva consultas, gere resumos estruturados e obtenha laudos prontos
            para o PEP — com LGPD by design.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-up" style={{ animationDelay: "0.2s" }}>
            <Link to="/auth">
              <PremiumButton>
                Começar agora
              </PremiumButton>
            </Link>
            <a href="https://wa.me/55XXXXXXXXXXX" target="_blank" rel="noopener noreferrer">
              <OutlinePremiumButton>
                <MessageCircle className="w-5 h-5 mr-2" />
                Falar com consultor
              </OutlinePremiumButton>
            </a>
          </div>

          <p className="text-sm text-muted-foreground mt-6">
            10 consultas para testar • Sem cartão de crédito
          </p>
        </div>
      </section>

      {/* Como funciona */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="mb-4">Como funciona</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Três passos simples para transformar sua consulta em um laudo profissional
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="shadow-soft hover:shadow-medium transition-smooth border-2 animate-fade-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardContent className="pt-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <feature.icon className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefícios com números */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className="text-center animate-fade-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <benefit.icon className="w-12 h-12 text-primary mx-auto mb-4" />
                <div className="text-5xl font-bold text-primary mb-2">{benefit.stat}</div>
                <p className="text-lg text-muted-foreground">{benefit.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Especialidades */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="mb-4">Templates por especialidade</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Laudos personalizados para cada área médica
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {specialties.map((specialty, index) => (
              <Card
                key={index}
                className="shadow-soft hover:shadow-medium transition-smooth cursor-pointer hover:scale-105 animate-fade-up"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <CardContent className="pt-6 text-center">
                  <specialty.icon className="w-8 h-8 text-primary mx-auto mb-2" />
                  <p className="text-sm font-medium">{specialty.name}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Provas */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="mb-4">Por que confiar na MindMed?</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="shadow-soft">
              <CardContent className="pt-6">
                <Shield className="w-12 h-12 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2">LGPD by design</h3>
                <p className="text-muted-foreground">
                  Arquitetura pensada desde o início para proteger dados sensíveis
                  e garantir conformidade total com LGPD/ANPD.
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-soft">
              <CardContent className="pt-6">
                <Zap className="w-12 h-12 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2">Explainable AI</h3>
                <p className="text-muted-foreground">
                  IA auditável e transparente. Saiba exatamente como cada laudo
                  foi gerado e ajuste conforme necessário.
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-soft">
              <CardContent className="pt-6">
                <Lock className="w-12 h-12 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2">Integração PEP</h3>
                <p className="text-muted-foreground">
                  Integração sob demanda com principais sistemas de prontuário
                  eletrônico (TOTVS, iClinic, MV e outros).
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Depoimentos */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="mb-4">O que dizem os médicos</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Profissionais que já reduziram burnout com a MindMed
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card
                key={index}
                className="shadow-soft animate-fade-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardContent className="pt-6">
                  <p className="text-muted-foreground mb-4 italic">
                    "{testimonial.text}"
                  </p>
                  <div>
                    <p className="font-semibold">{testimonial.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {testimonial.specialty}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Preços */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="mb-4">Planos que cabem no seu bolso</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Escolha o plano ideal para sua realidade
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="shadow-medium transition-smooth hover:shadow-large">
              <CardContent className="pt-6">
                <h3 className="text-2xl font-bold mb-2">Starter</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold">R$ 99,90</span>
                  <span className="text-muted-foreground">/mês</span>
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                  Perfeito para médicos iniciantes
                </p>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-sm">10 consultas incluídas/mês</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Transcrição em tempo real</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Laudos prontos para PEP</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-sm">LGPD by design</span>
                  </li>
                </ul>
                <Link to="/auth" className="block">
                  <OutlinePremiumButton className="w-full">
                    Começar agora
                  </OutlinePremiumButton>
                </Link>
              </CardContent>
            </Card>

            <Card className="shadow-medium transition-smooth hover:shadow-large border-2 border-primary scale-105">
              <CardContent className="pt-6">
                <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold mb-4">
                  <Sparkles className="w-3 h-3" />
                  Mais popular
                </div>
                <h3 className="text-2xl font-bold mb-2">Pro</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold">R$ 299,00</span>
                  <span className="text-muted-foreground">/mês</span>
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                  Para médicos com alta demanda
                </p>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Consultas ilimitadas*</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Integração com PEP</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Prioridade no suporte</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Templates customizados</span>
                  </li>
                </ul>
                <Link to="/auth" className="block">
                  <PremiumButton className="w-full">
                    Começar agora
                  </PremiumButton>
                </Link>
                <p className="text-xs text-muted-foreground mt-4 text-center">
                  *Uso justo: até 200 consultas/mês
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-medium transition-smooth hover:shadow-large">
              <CardContent className="pt-6">
                <h3 className="text-2xl font-bold mb-2">Clínicas</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold">Sob consulta</span>
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                  Solução completa para clínicas
                </p>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Múltiplos usuários</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Integração full PEP</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Suporte dedicado 24/7</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Personalização total</span>
                  </li>
                </ul>
                <a
                  href="https://wa.me/55XXXXXXXXXXX"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <OutlinePremiumButton className="w-full">
                    <MessageCircle className="w-5 h-5 mr-2" />
                    Falar com consultor
                  </OutlinePremiumButton>
                </a>
              </CardContent>
            </Card>
          </div>

          <div className="text-center mt-12">
            <Link to="/precos" className="text-primary hover:underline font-medium">
              Ver todos os detalhes dos planos →
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 px-4 gradient-primary text-white">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="mb-6 text-white">
            Pronto para reduzir seu burnout?
          </h2>
          <p className="text-xl mb-8 text-white/90 max-w-2xl mx-auto">
            Junte-se a centenas de médicos que já recuperaram tempo para o que
            realmente importa: cuidar de pacientes.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth">
              <PremiumButton className="bg-white text-primary hover:bg-white/90">
                Começar agora
              </PremiumButton>
            </Link>
            <a href="https://wa.me/55XXXXXXXXXXX" target="_blank" rel="noopener noreferrer">
              <OutlinePremiumButton className="border-white text-white hover:bg-white hover:text-primary">
                <MessageCircle className="w-5 h-5 mr-2" />
                Agendar demo
              </OutlinePremiumButton>
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Home;
