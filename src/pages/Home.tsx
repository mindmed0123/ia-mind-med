import { Link } from "react-router-dom";
import { PremiumButton, OutlinePremiumButton } from "@/components/ui/button-variants";
import { FileAudio, FileText, FileCheck, Shield, Zap, Target, CheckCircle2, MessageCircle, Clock, Brain, DollarSign, TrendingUp, BarChart3, Flame, Timer, Calculator, Users2, CalendarClock, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const Home = () => {
  const howItWorks = [{
    icon: FileAudio,
    title: "Transcreve automaticamente",
    description: "IA capta e transcreve toda a consulta em tempo real com precisão médica"
  }, {
    icon: Brain,
    title: "Gera laudos completos",
    description: "Transforma áudio em relatórios estruturados prontos para uso"
  }, {
    icon: FileText,
    title: "Sugere diagnósticos",
    description: "Dois diagnósticos por consulta: principal e alternativa clínica"
  }, {
    icon: FileCheck,
    title: "Exporta para PEP",
    description: "Integração direta com prontuários eletrônicos existentes"
  }];

  const benefits = [{
    icon: Clock,
    value: "2h/dia",
    title: "Tempo recuperado",
    description: "Elimine até 2 horas de papelada por dia de trabalho"
  }, {
    icon: Users2,
    value: "+30%",
    title: "Mais atendimentos",
    description: "Capacidade para até 10 consultas adicionais por semana"
  }, {
    icon: DollarSign,
    value: "R$ 12k+",
    title: "Faturamento extra",
    description: "Potencial de receita adicional mensal sem aumentar carga horária"
  }, {
    icon: Target,
    value: "99,8%",
    title: "Precisão clínica",
    description: "Laudos estruturados reduzem erros e aumentam qualidade"
  }];

  const expectedResults = [{
    icon: TrendingUp,
    result: "+8 pacientes/dia",
    description: "Potencial de atendimentos extras ao eliminar tempo com documentação manual"
  }, {
    icon: DollarSign,
    result: "Até R$ 15k/mês",
    description: "Receita adicional estimada ao converter tempo burocrático em consultas"
  }, {
    icon: Clock,
    result: "2h economizadas/dia",
    description: "Tempo médio recuperado por dia com geração automática de laudos"
  }];
  return <div className="min-h-screen">
      <Navbar />

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 gradient-primary text-white">
        <div className="container mx-auto text-center max-w-4xl">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm text-white text-sm font-medium mb-6 animate-fade-in border border-white/20">
            <Zap className="w-4 h-4" />
            10 consultas de teste • LGPD by design
          </div>

          <h1 className="mb-6 text-balance animate-fade-up text-white text-5xl md:text-6xl font-bold">
            Transforme 2 Horas de Papelada em 10 Pacientes a Mais por Dia
          </h1>

            <p className="text-xl text-white/90 mb-8 max-w-3xl mx-auto text-balance animate-fade-up leading-relaxed" style={{
          animationDelay: "0.1s"
        }}>
            A IA que <strong className="text-white font-bold">devolve tempo e aumenta o faturamento médico</strong> automaticamente. 
            Transcrição em tempo real, laudos prontos e diagnósticos sugeridos — sem você digitar uma linha.
          </p>


          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-up" style={{
          animationDelay: "0.2s"
        }}>
            <a href="https://pay.cakto.com.br/3bsu2vi_607441" target="_blank" rel="noopener noreferrer">
              <PremiumButton className="!bg-white !text-primary hover:!bg-white/90 shadow-xl text-lg px-8 py-6">
                🔵 Quero recuperar meu tempo agora
              </PremiumButton>
            </a>
          </div>
        </div>
      </section>

      {/* Seção 1 - Prova Lógica (Cálculo Financeiro) */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12 animate-fade-up">
            <h2 className="text-4xl md:text-5xl font-bold mb-8">
              Quanto Você Perde com Papelada?
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed mb-8">
              Cada hora perdida com burocracia é <strong className="text-foreground">dinheiro que você deixa de ganhar</strong>.
            </p>
          </div>

          <Card className="shadow-large border-2 border-primary/20 max-w-3xl mx-auto">
            <CardContent className="pt-8 pb-8">
              <div className="grid md:grid-cols-3 gap-8 mb-8">
                <div className="text-center">
                  <Calculator className="w-12 h-12 text-primary mx-auto mb-3" />
                  <div className="text-4xl font-bold text-primary mb-2">2h/dia</div>
                  <p className="text-sm text-muted-foreground">Tempo médio gasto com papelada</p>
                </div>
                <div className="text-center">
                  <CalendarClock className="w-12 h-12 text-primary mx-auto mb-3" />
                  <div className="text-4xl font-bold text-primary mb-2">40h/mês</div>
                  <p className="text-sm text-muted-foreground">Horas desperdiçadas por mês</p>
                </div>
                <div className="text-center">
                  <Wallet className="w-12 h-12 text-destructive mx-auto mb-3" />
                  <div className="text-4xl font-bold text-destructive mb-2">R$ 12k</div>
                  <p className="text-sm text-muted-foreground">Faturamento perdido mensal</p>
                </div>
              </div>

              <div className="bg-primary/5 rounded-lg p-6 border border-primary/20">
                <p className="text-center text-lg leading-relaxed">
                  <strong className="text-primary">Exemplo real:</strong> Um médico que cobra R$ 300 por consulta 
                  e perde 2h/dia com relatórios <strong className="text-foreground">desperdiça R$ 12.000/mês</strong> em 
                  consultas que poderia estar atendendo.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Seção 2 - A Solução */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="mb-6 text-4xl md:text-5xl font-bold">A Solução Inteligente</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              <strong className="text-primary">MindMed</strong> é a IA que transforma tempo perdido em faturamento médico.
            </p>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto mt-4">
              <strong className="text-foreground">Você não precisa trabalhar mais</strong> — só precisa deixar a IA cuidar do que não exige o seu CRM:
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
            <h2 className="mb-4 text-4xl md:text-5xl font-bold">Resultados Reais e Mensuráveis</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Médicos que usam MindMed recuperam tempo, aumentam atendimentos e elevam o faturamento
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit, index) => <Card key={index} className="shadow-soft hover:shadow-medium transition-smooth text-center animate-fade-up border-2" style={{
            animationDelay: `${index * 0.1}s`
          }}>
                <CardContent className="pt-6">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <benefit.icon className="w-8 h-8 text-primary" />
                  </div>
                  <div className="text-3xl font-bold text-primary mb-2">{benefit.value}</div>
                  <h3 className="text-lg font-semibold mb-2">{benefit.title}</h3>
                  <p className="text-sm text-muted-foreground">{benefit.description}</p>
                </CardContent>
              </Card>)}
          </div>
        </div>
      </section>

      {/* Seção 4 - Prova Social (Depoimentos) */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="mb-4 text-4xl md:text-5xl font-bold">Médicos Que Recuperaram Tempo e Faturamento</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Casos reais de profissionais que transformaram sua rotina com MindMed
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => <Card key={index} className="shadow-soft hover:shadow-medium transition-smooth animate-fade-up border-2" style={{
            animationDelay: `${index * 0.1}s`
          }}>
                <CardContent className="pt-6 pb-6">
                  <div className="mb-4">
                    <div className="text-2xl font-bold text-primary mb-1">{testimonial.result}</div>
                    <div className="text-sm text-muted-foreground">{testimonial.specialty}</div>
                  </div>
                  <p className="text-base text-foreground italic mb-4 leading-relaxed">"{testimonial.quote}"</p>
                  <p className="text-sm font-semibold text-foreground">— {testimonial.name}</p>
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

              <a href="https://pay.cakto.com.br/3bsu2vi_607441" target="_blank" rel="noopener noreferrer" className="block">
                <PremiumButton className="w-full text-lg py-6 whitespace-normal">
                  🔵 Recuperar meu tempo e aumentar meu faturamento
                </PremiumButton>
              </a>
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
                  <Timer className="w-4 h-4" />
                  Vagas Limitadas
                </div>
                <h2 className="mb-4 text-3xl md:text-4xl font-bold">
                  ⚠️ Apenas 50 Vagas Disponíveis para Early Adopters
                </h2>
                <p className="text-lg text-muted-foreground mb-6">
                  Benefícios exclusivos para os primeiros médicos:
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

              <a href="https://pay.cakto.com.br/3bsu2vi_607441" target="_blank" rel="noopener noreferrer" className="block">
                <PremiumButton className="w-full text-lg py-6 shadow-xl">
                  🔵 Garantir minha vaga de early adopter!
                </PremiumButton>
              </a>

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
            Recupere Até 20% do Seu Faturamento Perdido com Burocracia
          </h2>
          <p className="text-xl mb-8 text-white/90 max-w-2xl mx-auto leading-relaxed">
            Transforme tempo perdido em <strong className="text-white">consultas adicionais</strong>, 
            <strong className="text-white"> receita extra</strong> e <strong className="text-white">vida pessoal recuperada</strong>. 
            Comece hoje e veja os resultados na primeira semana.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="https://pay.cakto.com.br/3bsu2vi_607441" target="_blank" rel="noopener noreferrer">
              <PremiumButton className="bg-white text-primary hover:bg-white/90 shadow-xl text-lg px-8 py-6">
                🔵 Quero recuperar meu tempo agora
              </PremiumButton>
            </a>
            <a href="https://wa.me/5511958890212" target="_blank" rel="noopener noreferrer">
              <OutlinePremiumButton className="border-2 border-white text-white hover:bg-white hover:text-primary text-lg px-8 py-6">
                <MessageCircle className="w-5 h-5 mr-2" />
                Falar com consultor
              </OutlinePremiumButton>
            </a>
          </div>

          <p className="text-sm text-white/80 mt-6">
            ⏱️ 50 vagas limitadas • Suporte VIP • ROI comprovado
          </p>
        </div>
      </section>

      <Footer />
    </div>;
};
export default Home;