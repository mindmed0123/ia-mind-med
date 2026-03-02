import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PremiumButton, OutlinePremiumButton } from "@/components/ui/button-variants";
import { Check, MessageCircle, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

const Precos = () => {
  const plans = [
    {
      name: "Starter",
      price: "R$ 99,90",
      period: "/mês",
      description: "Perfeito para médicos iniciantes ou consultórios pequenos",
      features: [
        "10 consultas incluídas por mês",
        "Transcrição em tempo real",
        "Resumos estruturados",
        "Laudos prontos para PEP",
        "Templates por especialidade",
        "Suporte por email",
        "LGPD by design",
      ],
      cta: "Começar agora",
      ctaLink: "https://pay.cakto.com.br/3bsu2vi_607441",
      highlighted: false,
      isStripe: true,
    },
    {
      name: "Pro",
      price: "R$ 299",
      period: "/mês",
      description: "Para médicos com alta demanda de atendimentos",
      features: [
        "✨ Consultas ILIMITADAS",
        "🎤 Transcrição ilimitada",
        "📄 Laudos ilimitados",
        "⚡ Suporte prioritário",
        "🔗 Integração com PEP",
        "📊 API de acesso",
        "📈 Relatórios mensais",
        "🎓 Treinamento personalizado",
      ],
      cta: "Começar agora",
      ctaLink: "https://pay.cakto.com.br/u95r4cv_607505",
      highlighted: true,
      isStripe: true,
      badge: "Mais popular",
    },
    {
      name: "Clínicas",
      price: "Sob consulta",
      period: "",
      description: "Solução completa para clínicas e hospitais",
      features: [
        "Múltiplos usuários",
        "Gerenciamento centralizado",
        "Integração full PEP/PACS/RIS",
        "SLA garantido",
        "Suporte dedicado 24/7",
        "Onboarding presencial",
        "Auditoria e compliance",
        "Personalização total",
      ],
      cta: "Falar com consultor",
      ctaLink: "https://wa.me/5511958890212",
      highlighted: false,
      isWhatsApp: true,
    },
  ];

  const faqs = [
    {
      q: "O que acontece quando acabo as 10 consultas do Starter?",
      a: "Você receberá um aviso quando atingir o limite. Pode fazer upgrade para o Pro a qualquer momento e continuar usando imediatamente.",
    },
    {
      q: "Como funciona o período de teste?",
      a: "O plano Starter inclui 10 consultas para você testar todas as funcionalidades. Após o uso, faça upgrade para continuar.",
    },
    {
      q: "Posso cancelar a qualquer momento?",
      a: "Sim, sem multas ou burocracia. Seus dados ficam disponíveis por 30 dias após o cancelamento.",
    },
    {
      q: "Os dados são seguros?",
      a: "Sim. Seguimos as diretrizes da LGPD com criptografia em trânsito e em repouso para todos os dados clínicos.",
    },
    {
      q: "Vocês integram com prontuários eletrônicos?",
      a: "Atualmente os laudos podem ser exportados em PDF e Markdown para uso em qualquer PEP. Integrações diretas estão no roadmap.",
    },
  ];

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 gradient-subtle">
        <div className="container mx-auto text-center max-w-4xl">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            Faça 10 consultas testes • Sem cartão de crédito
          </div>
          <h1 className="mb-6">Planos que cabem no seu bolso</h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Escolha o plano ideal para sua realidade. Sem compromisso.
          </p>
        </div>
      </section>

      {/* Planos */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan, index) => (
              <Card
                key={index}
                className={`shadow-medium transition-smooth hover:shadow-large ${
                  plan.highlighted ? "border-2 border-primary scale-105" : ""
                }`}
              >
                <CardHeader>
                  {plan.badge && (
                    <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold mb-4 w-fit">
                      <Sparkles className="w-3 h-3" />
                      {plan.badge}
                    </div>
                  )}
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <div className="mb-2">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                </CardHeader>

                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {plan.isWhatsApp ? (
                    <a
                      href={plan.ctaLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <OutlinePremiumButton className="w-full">
                        <MessageCircle className="w-5 h-5 mr-2" />
                        {plan.cta}
                      </OutlinePremiumButton>
                    </a>
                  ) : plan.isStripe ? (
                    <a
                      href={plan.ctaLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      {plan.highlighted ? (
                        <PremiumButton className="w-full">{plan.cta}</PremiumButton>
                      ) : (
                        <OutlinePremiumButton className="w-full">
                          {plan.cta}
                        </OutlinePremiumButton>
                      )}
                    </a>
                  ) : (
                    <Link to={plan.ctaLink}>
                      {plan.highlighted ? (
                        <PremiumButton className="w-full">{plan.cta}</PremiumButton>
                      ) : (
                        <OutlinePremiumButton className="w-full">
                          {plan.cta}
                        </OutlinePremiumButton>
                      )}
                    </Link>
                  )}

                  {plan.name === "Pro" && (
                    <p className="text-xs text-muted-foreground mt-4 text-center">
                      *Uso justo: até 200 consultas/mês
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="mb-4">Perguntas frequentes</h2>
            <p className="text-lg text-muted-foreground">
              Tire suas dúvidas sobre nossos planos
            </p>
          </div>

          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <Card key={index} className="shadow-soft">
                <CardContent className="pt-6">
                  <h3 className="text-lg font-semibold mb-2">{faq.q}</h3>
                  <p className="text-muted-foreground">{faq.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="mb-6">Ainda com dúvidas?</h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Fale com nosso time e descubra qual plano é o melhor para você
          </p>
          <a
            href="https://wa.me/5511958890212"
            target="_blank"
            rel="noopener noreferrer"
          >
            <PremiumButton>
              <MessageCircle className="w-5 h-5 mr-2" />
              Conversar no WhatsApp
            </PremiumButton>
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Precos;
