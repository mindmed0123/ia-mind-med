import { useEffect, useState, useRef } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  Building2,
  Database,
  Target,
  Scale,
  Share2,
  ShieldCheck,
  Clock,
  UserCheck,
  Cookie,
  AlertCircle,
  Globe2,
  RefreshCw,
  MessageCircle,
  Lock,
  ShieldAlert,
  CheckCircle2,
  ArrowUp,
  Mail,
  Phone,
} from "lucide-react";

type Section = {
  id: string;
  number: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  content: React.ReactNode;
};

const sections: Section[] = [
  {
    id: "quem-somos",
    number: "01",
    title: "Quem somos",
    icon: Building2,
    content: (
      <div className="space-y-4">
        <p>
          A MindMed é uma plataforma tecnológica voltada para apoio à
          documentação clínica, geração de laudos médicos, transcrição
          inteligente, organização de prontuários e automação de processos
          administrativos na área da saúde.
        </p>
        <p>
          A plataforma pode ser utilizada por médicos, clínicas, hospitais,
          profissionais de saúde e demais usuários autorizados.
        </p>
      </div>
    ),
  },
  {
    id: "dados-coletados",
    number: "02",
    title: "Dados que coletamos",
    icon: Database,
    content: (
      <div className="space-y-6">
        <div>
          <h4 className="font-semibold text-foreground mb-2">2.1 Dados cadastrais</h4>
          <ul className="list-disc pl-5 space-y-1">
            <li>Nome completo</li>
            <li>E-mail</li>
            <li>Telefone</li>
            <li>CPF ou CNPJ</li>
            <li>Cargo ou especialidade médica</li>
            <li>Dados de acesso e autenticação</li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-foreground mb-2">2.2 Dados profissionais</h4>
          <ul className="list-disc pl-5 space-y-1">
            <li>CRM</li>
            <li>Especialidade</li>
            <li>Instituição vinculada</li>
            <li>Informações profissionais fornecidas pelo usuário</li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-foreground mb-2">2.3 Dados clínicos e sensíveis</h4>
          <p className="mb-2">
            Dependendo da utilização da plataforma, poderão ser tratados dados
            sensíveis relacionados à saúde, incluindo:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Áudios de consultas</li>
            <li>Transcrições médicas</li>
            <li>Informações clínicas de pacientes</li>
            <li>Exames enviados</li>
            <li>Hipóteses diagnósticas</li>
            <li>Prescrições</li>
            <li>Laudos e relatórios</li>
          </ul>
          <p className="mt-3 italic text-sm">
            Esses dados são tratados exclusivamente para execução das
            funcionalidades contratadas.
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-foreground mb-2">2.4 Dados técnicos e de navegação</h4>
          <ul className="list-disc pl-5 space-y-1">
            <li>Endereço IP</li>
            <li>Tipo de dispositivo</li>
            <li>Navegador</li>
            <li>Logs de acesso</li>
            <li>Cookies</li>
            <li>Dados de uso da plataforma</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: "finalidade",
    number: "03",
    title: "Finalidade do tratamento dos dados",
    icon: Target,
    content: (
      <div className="space-y-4">
        <p>Os dados poderão ser utilizados para:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Permitir o funcionamento da plataforma;</li>
          <li>Gerar transcrições, laudos e documentos médicos;</li>
          <li>Melhorar a experiência do usuário;</li>
          <li>Realizar autenticação e segurança;</li>
          <li>Cumprir obrigações legais e regulatórias;</li>
          <li>Garantir suporte técnico;</li>
          <li>Prevenir fraudes e acessos indevidos;</li>
          <li>Melhorar desempenho, estabilidade e funcionalidades da plataforma;</li>
          <li>Realizar análises estatísticas internas;</li>
          <li>Enviar comunicações operacionais.</li>
        </ul>
        <Card className="p-4 border-l-4 border-l-primary bg-primary/5">
          <p className="font-medium text-foreground">
            A MindMed não comercializa dados pessoais ou dados médicos dos
            usuários.
          </p>
        </Card>
      </div>
    ),
  },
  {
    id: "bases-legais",
    number: "04",
    title: "Bases legais utilizadas",
    icon: Scale,
    content: (
      <div className="space-y-4">
        <p>
          O tratamento de dados realizado pela MindMed poderá ocorrer com
          fundamento nas seguintes bases legais previstas na LGPD:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Execução de contrato;</li>
          <li>Consentimento do titular;</li>
          <li>Cumprimento de obrigação legal ou regulatória;</li>
          <li>Exercício regular de direitos;</li>
          <li>Proteção da vida e da saúde;</li>
          <li>Tutela da saúde;</li>
          <li>Legítimo interesse, quando aplicável.</li>
        </ul>
        <p className="text-sm italic">
          Dados sensíveis relacionados à saúde serão tratados observando os
          requisitos específicos da LGPD.
        </p>
      </div>
    ),
  },
  {
    id: "compartilhamento",
    number: "05",
    title: "Compartilhamento de dados",
    icon: Share2,
    content: (
      <div className="space-y-4">
        <p>A MindMed poderá compartilhar dados apenas quando necessário para:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Prestadores de serviços tecnológicos;</li>
          <li>Infraestrutura em nuvem;</li>
          <li>Ferramentas de processamento e armazenamento;</li>
          <li>Integrações autorizadas pelo usuário;</li>
          <li>Cumprimento de obrigações legais;</li>
          <li>Autoridades públicas mediante requisição legal.</li>
        </ul>
        <p>
          Todos os parceiros e fornecedores utilizados pela MindMed deverão
          seguir padrões adequados de segurança e confidencialidade.
        </p>
        <Card className="p-4 border-l-4 border-l-accent bg-accent/5">
          <p className="font-medium text-foreground">
            A MindMed não vende informações pessoais ou dados médicos.
          </p>
        </Card>
      </div>
    ),
  },
  {
    id: "seguranca",
    number: "06",
    title: "Armazenamento e segurança",
    icon: ShieldCheck,
    content: (
      <div className="space-y-4">
        <p>
          A MindMed adota medidas técnicas e administrativas adequadas para
          proteger os dados contra:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Acessos não autorizados;</li>
          <li>Vazamentos;</li>
          <li>Alterações indevidas;</li>
          <li>Perda de informações;</li>
          <li>Destruição ou divulgação inadequada.</li>
        </ul>
        <p>As medidas podem incluir:</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { icon: Lock, label: "Criptografia" },
            { icon: UserCheck, label: "Controle de acesso" },
            { icon: CheckCircle2, label: "Logs de auditoria" },
            { icon: ShieldAlert, label: "Monitoramento de segurança" },
            { icon: ShieldCheck, label: "Ambientes protegidos" },
            { icon: Lock, label: "Protocolos de autenticação" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
              <Icon className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm text-foreground">{label}</span>
            </div>
          ))}
        </div>
        <p className="text-sm italic">
          Apesar das melhores práticas de segurança, nenhum sistema é
          completamente imune a riscos.
        </p>
      </div>
    ),
  },
  {
    id: "retencao",
    number: "07",
    title: "Retenção dos dados",
    icon: Clock,
    content: (
      <div className="space-y-4">
        <p>Os dados serão armazenados somente pelo período necessário para:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Cumprimento das finalidades descritas;</li>
          <li>Obrigações legais e regulatórias;</li>
          <li>Exercício regular de direitos;</li>
          <li>Auditorias e segurança.</li>
        </ul>
        <p>
          Após esse período, os dados poderão ser excluídos ou anonimizados,
          salvo hipóteses legais de retenção obrigatória.
        </p>
      </div>
    ),
  },
  {
    id: "direitos",
    number: "08",
    title: "Direitos dos titulares",
    icon: UserCheck,
    content: (
      <div className="space-y-4">
        <p>Nos termos da LGPD, o titular dos dados poderá solicitar:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Confirmação da existência de tratamento;</li>
          <li>Acesso aos dados;</li>
          <li>Correção de dados incompletos ou desatualizados;</li>
          <li>Anonimização, bloqueio ou eliminação;</li>
          <li>Portabilidade dos dados;</li>
          <li>Revogação do consentimento;</li>
          <li>Informações sobre compartilhamento;</li>
          <li>Exclusão de dados tratados mediante consentimento.</li>
        </ul>
        <p>
          As solicitações poderão ser realizadas pelos canais oficiais de
          atendimento da MindMed.
        </p>
      </div>
    ),
  },
  {
    id: "cookies",
    number: "09",
    title: "Cookies e tecnologias similares",
    icon: Cookie,
    content: (
      <div className="space-y-4">
        <p>A MindMed poderá utilizar cookies e tecnologias semelhantes para:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Autenticação;</li>
          <li>Segurança;</li>
          <li>Desempenho;</li>
          <li>Estatísticas de uso;</li>
          <li>Personalização da experiência.</li>
        </ul>
        <p>O usuário poderá gerenciar cookies diretamente em seu navegador.</p>
      </div>
    ),
  },
  {
    id: "responsabilidades",
    number: "10",
    title: "Responsabilidades do usuário",
    icon: AlertCircle,
    content: (
      <div className="space-y-4">
        <p>O usuário é responsável por:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Utilizar a plataforma de forma ética e legal;</li>
          <li>Manter suas credenciais seguras;</li>
          <li>
            Garantir que possui autorização adequada para inserção de dados de
            terceiros;
          </li>
          <li>
            Verificar e validar conteúdos médicos gerados antes da utilização
            clínica.
          </li>
        </ul>
        <Card className="p-4 border-l-4 border-l-primary bg-primary/5">
          <p className="font-medium text-foreground">
            A MindMed atua como ferramenta de apoio tecnológico e não substitui
            avaliação, responsabilidade ou julgamento profissional médico.
          </p>
        </Card>
      </div>
    ),
  },
  {
    id: "transferencia",
    number: "11",
    title: "Transferência internacional de dados",
    icon: Globe2,
    content: (
      <p>
        Alguns dados poderão ser processados ou armazenados em servidores
        localizados fora do Brasil, sempre observando requisitos de segurança,
        confidencialidade e conformidade com a LGPD.
      </p>
    ),
  },
  {
    id: "alteracoes",
    number: "12",
    title: "Alterações desta Política",
    icon: RefreshCw,
    content: (
      <div className="space-y-4">
        <p>
          A MindMed poderá atualizar esta Política periodicamente para refletir
          melhorias, mudanças regulatórias ou novas funcionalidades.
        </p>
        <p>
          A versão mais atual estará sempre disponível nos canais oficiais da
          plataforma.
        </p>
      </div>
    ),
  },
  {
    id: "contato",
    number: "13",
    title: "Contato",
    icon: MessageCircle,
    content: (
      <div className="space-y-4">
        <p>
          Em caso de dúvidas, solicitações relacionadas à privacidade ou
          exercício de direitos previstos na LGPD, o usuário poderá entrar em
          contato com a MindMed pelos canais oficiais da empresa.
        </p>
        <div className="grid sm:grid-cols-2 gap-3 pt-2">
          <a
            href="mailto:contato@mindmed.com.br"
            className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card hover:border-primary hover:shadow-soft transition-base"
          >
            <Mail className="w-5 h-5 text-primary" />
            <div>
              <div className="text-xs text-muted-foreground">E-mail</div>
              <div className="text-sm font-medium text-foreground">
                contato@mindmed.com.br
              </div>
            </div>
          </a>
          <a
            href="https://wa.me/5511958890212"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card hover:border-primary hover:shadow-soft transition-base"
          >
            <Phone className="w-5 h-5 text-primary" />
            <div>
              <div className="text-xs text-muted-foreground">WhatsApp</div>
              <div className="text-sm font-medium text-foreground">
                (11) 95889-0212
              </div>
            </div>
          </a>
        </div>
      </div>
    ),
  },
];

const Privacidade = () => {
  const isMobile = useIsMobile();
  const [activeId, setActiveId] = useState(sections[0].id);
  const [readingProgress, setReadingProgress] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // SEO
  useEffect(() => {
    document.title = "Política de Privacidade | MindMed — LGPD e Proteção de Dados";
    const desc =
      "Política de Privacidade da MindMed: como protegemos dados clínicos sensíveis com criptografia, conformidade LGPD e padrões enterprise de segurança.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", desc);

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", window.location.origin + "/privacidade");
  }, []);

  // Reading progress + scroll-to-top visibility
  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      setReadingProgress(Math.min(100, Math.max(0, progress)));
      setShowScrollTop(scrollTop > 600);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scrollspy (desktop)
  useEffect(() => {
    if (isMobile) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.25, 0.5, 1] }
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [isMobile]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 96;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  // JSON-LD
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Política de Privacidade — MindMed",
    description:
      "Política de Privacidade da MindMed em conformidade com a LGPD.",
    dateModified: "2026-05-01",
    publisher: {
      "@type": "Organization",
      name: "MindMed",
    },
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Reading progress bar */}
      <div
        className="fixed top-0 left-0 right-0 h-1 z-[60] bg-transparent"
        aria-hidden="true"
      >
        <div
          className="h-full gradient-primary transition-[width] duration-150"
          style={{ width: `${readingProgress}%` }}
        />
      </div>

      <Navbar />

      <main className="flex-1 pt-20">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border">
          <div className="absolute inset-0 gradient-subtle" aria-hidden="true" />
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, hsl(var(--primary)) 1px, transparent 0)",
              backgroundSize: "32px 32px",
            }}
            aria-hidden="true"
          />
          <div className="relative container mx-auto px-4 py-16 md:py-24 max-w-5xl">
            <div className="flex flex-col items-start gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <Badge
                variant="outline"
                className="border-primary/30 bg-primary/5 text-primary px-3 py-1.5 gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Conformidade LGPD · Lei nº 13.709/2018
              </Badge>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground text-balance">
                Política de{" "}
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Privacidade
                </span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-3xl leading-relaxed text-balance">
                Como a MindMed protege, armazena e trata os dados clínicos e
                pessoais dos profissionais de saúde e seus pacientes — com
                segurança de nível hospitalar e total transparência.
              </p>

              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  Última atualização: <strong className="text-foreground font-medium">Maio de 2026</strong>
                </span>
                <span className="hidden sm:inline">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="w-4 h-4" />
                  Criptografia em trânsito e em repouso
                </span>
              </div>

              {/* Trust strip */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full pt-6">
                {[
                  { icon: ShieldCheck, label: "LGPD by design" },
                  { icon: Lock, label: "Criptografia AES-256" },
                  { icon: UserCheck, label: "Acesso isolado (RLS)" },
                  { icon: CheckCircle2, label: "Logs de auditoria" },
                ].map(({ icon: Icon, label }) => (
                  <Card
                    key={label}
                    className="p-3 flex items-center gap-2.5 border-border/60 bg-card/80 backdrop-blur-sm"
                  >
                    <Icon className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-xs md:text-sm font-medium text-foreground">
                      {label}
                    </span>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Intro */}
        <section className="container mx-auto px-4 py-10 max-w-5xl">
          <Card className="p-6 md:p-8 border-l-4 border-l-primary shadow-soft">
            <p className="text-base md:text-lg leading-relaxed text-foreground">
              A MindMed valoriza a privacidade, a segurança e a transparência no
              tratamento de dados pessoais e dados sensíveis relacionados à
              saúde. Esta Política de Privacidade explica como coletamos,
              utilizamos, armazenamos, protegemos e compartilhamos informações
              dos usuários da plataforma, em conformidade com a{" "}
              <strong className="text-primary">
                Lei Geral de Proteção de Dados Pessoais (LGPD)
              </strong>
              .
            </p>
            <p className="mt-3 text-sm text-muted-foreground italic">
              Ao utilizar a plataforma MindMed, o usuário declara estar ciente
              das práticas descritas nesta Política.
            </p>
          </Card>
        </section>

        {/* Content */}
        <section className="container mx-auto px-4 pb-20 max-w-7xl">
          <div className="grid lg:grid-cols-[260px_1fr] gap-10">
            {/* Side Nav (desktop) */}
            {!isMobile && (
              <aside className="hidden lg:block">
                <div className="sticky top-24">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4 px-3">
                    Sumário
                  </div>
                  <nav aria-label="Navegação da política">
                    <ul className="space-y-0.5 max-h-[calc(100vh-12rem)] overflow-y-auto pr-2">
                      {sections.map((s) => {
                        const active = activeId === s.id;
                        return (
                          <li key={s.id}>
                            <button
                              onClick={() => scrollTo(s.id)}
                              className={cn(
                                "w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-lg text-sm transition-base group relative",
                                active
                                  ? "bg-primary/10 text-primary font-medium"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                              )}
                            >
                              <span
                                className={cn(
                                  "absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-r-full transition-all",
                                  active ? "h-6 bg-primary" : "h-0 bg-transparent"
                                )}
                                aria-hidden="true"
                              />
                              <span
                                className={cn(
                                  "text-[10px] font-mono mt-0.5 tabular-nums",
                                  active ? "text-primary" : "text-muted-foreground/60"
                                )}
                              >
                                {s.number}
                              </span>
                              <span className="leading-snug">{s.title}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </nav>

                  {/* Help card */}
                  <Card className="mt-6 p-4 border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <MessageCircle className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm text-foreground">
                          Precisa de ajuda?
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1 mb-3 leading-relaxed">
                          Nossa equipe de privacidade está disponível.
                        </p>
                        <Button
                          asChild
                          size="sm"
                          className="w-full gradient-primary text-xs h-8"
                        >
                          <a
                            href="https://wa.me/5511958890212"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Falar com suporte
                          </a>
                        </Button>
                      </div>
                    </div>
                  </Card>
                </div>
              </aside>
            )}

            {/* Content body */}
            <div ref={contentRef} className="min-w-0">
              {isMobile ? (
                <Accordion type="single" collapsible className="space-y-3">
                  {sections.map((s) => (
                    <AccordionItem
                      key={s.id}
                      value={s.id}
                      id={s.id}
                      className="border border-border rounded-xl bg-card px-4 shadow-soft overflow-hidden"
                    >
                      <AccordionTrigger className="hover:no-underline py-4">
                        <div className="flex items-center gap-3 text-left">
                          <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                            <s.icon className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[10px] font-mono text-muted-foreground/70 tabular-nums">
                              {s.number}
                            </div>
                            <div className="font-semibold text-foreground text-sm leading-tight">
                              {s.title}
                            </div>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground leading-relaxed text-sm pb-5 break-words">
                        {s.content}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <div className="space-y-6">
                  {sections.map((s, idx) => (
                    <article
                      key={s.id}
                      id={s.id}
                      className="scroll-mt-24 animate-in fade-in slide-in-from-bottom-2 duration-500"
                      style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
                    >
                      <Card className="p-7 md:p-9 border-border/70 hover:shadow-medium transition-smooth break-words">
                        <header className="flex items-start gap-4 mb-5 pb-5 border-b border-border/60">
                          <div className="p-3 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 shrink-0">
                            <s.icon className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-mono text-muted-foreground tabular-nums mb-1">
                              SEÇÃO {s.number}
                            </div>
                            <h2 className="text-2xl md:text-[28px] font-bold text-foreground tracking-tight leading-tight">
                              {s.title}
                            </h2>
                          </div>
                        </header>
                        <div className="text-muted-foreground leading-relaxed text-[15px] md:text-base [&>div>p]:mb-0 [&_strong]:text-foreground space-y-4">
                          {s.content}
                        </div>
                      </Card>
                    </article>
                  ))}
                </div>
              )}

              {/* Bottom CTA */}
              <Card className="mt-10 p-8 md:p-10 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5 text-center">
                <div className="flex justify-center mb-4">
                  <div className="p-3 rounded-2xl bg-primary/10">
                    <ShieldCheck className="w-7 h-7 text-primary" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-2">
                  Comprometidos com sua privacidade
                </h3>
                <p className="text-muted-foreground max-w-xl mx-auto mb-6 leading-relaxed">
                  Tem alguma dúvida sobre como tratamos seus dados? Nossa equipe
                  de privacidade está pronta para responder.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button asChild size="lg" className="gradient-primary shadow-soft">
                    <a
                      href="https://wa.me/5511958890212"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Falar com suporte
                    </a>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <a href="mailto:contato@mindmed.com.br">
                      <Mail className="w-4 h-4 mr-2" />
                      Enviar e-mail
                    </a>
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </section>
      </main>

      {/* Scroll to top */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Voltar ao topo"
        className={cn(
          "fixed bottom-6 right-6 z-50 w-11 h-11 rounded-full gradient-primary text-primary-foreground shadow-large flex items-center justify-center transition-all duration-300",
          showScrollTop
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4 pointer-events-none"
        )}
      >
        <ArrowUp className="w-5 h-5" />
      </button>

      <Footer />
    </div>
  );
};

export default Privacidade;
