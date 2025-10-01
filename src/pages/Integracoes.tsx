import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { PremiumButton } from "@/components/ui/button-variants";
import {
  Plug,
  Database,
  Cloud,
  Lock,
  Zap,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

const Integracoes = () => {
  const pepSystems = [
    { name: "TOTVS", logo: "🏥" },
    { name: "iClinic", logo: "💊" },
    { name: "MV", logo: "⚕️" },
    { name: "Tasy", logo: "🩺" },
    { name: "Prontuário Fácil", logo: "📋" },
    { name: "Gestão DS", logo: "💉" },
  ];

  const integrationFeatures = [
    {
      icon: Plug,
      title: "API RESTful",
      description:
        "Interface padronizada para integração com qualquer sistema de PEP, PACS ou RIS.",
    },
    {
      icon: Database,
      title: "Sincronização automática",
      description:
        "Laudos gerados são automaticamente enviados para o prontuário do paciente.",
    },
    {
      icon: Cloud,
      title: "Cloud-native",
      description:
        "Infraestrutura escalável que cresce com sua clínica, sem downtime.",
    },
    {
      icon: Lock,
      title: "Segurança end-to-end",
      description:
        "Criptografia em trânsito e em repouso, com logs de auditoria completos.",
    },
    {
      icon: Zap,
      title: "Webhooks em tempo real",
      description:
        "Notificações instantâneas de novos laudos, atualizações e eventos.",
    },
    {
      icon: CheckCircle2,
      title: "Validação de dados",
      description:
        "Garantia de integridade e formato correto antes da integração.",
    },
  ];

  const integrationSteps = [
    {
      number: "1",
      title: "Análise técnica",
      description:
        "Nosso time analisa a API do seu PEP e mapeia os endpoints necessários.",
    },
    {
      number: "2",
      title: "Desenvolvimento",
      description:
        "Criamos os conectores customizados e testamos em ambiente homologado.",
    },
    {
      number: "3",
      title: "Testes e validação",
      description:
        "Validamos a integração com casos reais antes do go-live em produção.",
    },
    {
      number: "4",
      title: "Deploy e suporte",
      description:
        "Ativação em produção com acompanhamento dedicado nas primeiras semanas.",
    },
  ];

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 gradient-subtle">
        <div className="container mx-auto text-center max-w-4xl">
          <h1 className="mb-6">Integrações que funcionam</h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Conecte a MindMed ao seu prontuário eletrônico e tenha laudos
            automaticamente salvos no histórico do paciente
          </p>
        </div>
      </section>

      {/* PEPs compatíveis */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="mb-4">Sistemas compatíveis</h2>
            <p className="text-lg text-muted-foreground">
              Já integramos com os principais PEPs do mercado
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {pepSystems.map((system, index) => (
              <Card
                key={index}
                className="shadow-soft hover:shadow-medium transition-smooth text-center"
              >
                <CardContent className="pt-6">
                  <div className="text-5xl mb-3">{system.logo}</div>
                  <p className="font-semibold text-sm">{system.name}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-muted-foreground mb-4">
              Não encontrou seu PEP? Podemos criar uma integração customizada.
            </p>
            <a
              href="https://wa.me/55XXXXXXXXXXX"
              target="_blank"
              rel="noopener noreferrer"
            >
              <PremiumButton>Solicitar integração</PremiumButton>
            </a>
          </div>
        </div>
      </section>

      {/* Features de integração */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="mb-4">Recursos de integração</h2>
            <p className="text-lg text-muted-foreground">
              Tecnologia robusta para garantir confiabilidade e segurança
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {integrationFeatures.map((feature, index) => (
              <Card key={index} className="shadow-soft">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Processo de integração */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="mb-4">Como funciona a integração</h2>
            <p className="text-lg text-muted-foreground">
              Processo simples e transparente, com acompanhamento dedicado
            </p>
          </div>

          <div className="space-y-8">
            {integrationSteps.map((step, index) => (
              <div key={index} className="flex gap-8 items-start">
                <div className="flex-shrink-0 w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center text-2xl font-bold shadow-medium">
                  {step.number}
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-semibold mb-2">{step.title}</h3>
                  <p className="text-muted-foreground text-lg">
                    {step.description}
                  </p>
                </div>
                {index < integrationSteps.length - 1 && (
                  <ArrowRight className="hidden md:block w-6 h-6 text-primary mt-4" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* API para desenvolvedores */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center">
            <h2 className="mb-6">API para desenvolvedores</h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Documentação completa, exemplos de código e suporte técnico para
              criar sua própria integração
            </p>

            <Card className="shadow-large p-8 text-left bg-card">
              <pre className="text-sm overflow-x-auto">
                <code className="text-muted-foreground">
                  {`POST /api/v1/transcriptions
Authorization: Bearer YOUR_API_KEY

{
  "audio_url": "https://...",
  "patient_id": "PAC123",
  "specialty": "cardiology"
}

Response:
{
  "id": "TRANS456",
  "status": "processing",
  "estimated_time": "60s"
}`}
                </code>
              </pre>
            </Card>

            <div className="mt-8">
              <PremiumButton>Ver documentação completa</PremiumButton>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="mb-6">Pronto para integrar?</h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Fale com nosso time técnico e inicie a integração com seu PEP
          </p>
          <a
            href="https://wa.me/55XXXXXXXXXXX"
            target="_blank"
            rel="noopener noreferrer"
          >
            <PremiumButton>Falar com time técnico</PremiumButton>
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Integracoes;
