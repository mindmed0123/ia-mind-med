import { ReactNode } from "react";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Activity } from "lucide-react";

interface Props {
  children: ReactNode;
}

export function AgendamentosGate({ children }: Props) {
  const { hasAccess, loading } = useFeatureAccess("appointments");

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Activity className="w-7 h-7 text-primary animate-spin" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="container max-w-3xl mx-auto px-4 py-16">
        <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 via-background to-accent/5 overflow-hidden">
          <CardContent className="pt-12 pb-12 text-center">
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary to-accent blur-xl opacity-40" />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Calendar className="w-10 h-10 text-primary-foreground" />
              </div>
            </div>

            <h2 className="text-2xl md:text-3xl font-bold mb-3 tracking-tight">
              Módulo de Agendamentos
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto mb-2">
              Uma agenda médica completa, multi-profissional, com agendamento online e gestão profissional do consultório.
            </p>
            <p className="text-sm text-muted-foreground mb-8 inline-flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Disponível mediante liberação
            </p>

            <div className="grid sm:grid-cols-3 gap-3 max-w-xl mx-auto mb-8 text-left">
              {[
                "Agenda visual dia/semana/mês",
                "Multi-médico com filtros",
                "Agendamento online por link",
                "Anti-conflito automático",
                "Tipos de atendimento personalizados",
                "Integração com pacientes",
              ].map((f) => (
                <div key={f} className="text-xs text-muted-foreground flex items-start gap-1.5 px-3 py-2 rounded-lg bg-card border border-border/60">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>

            <a href="mailto:contato@mindmed.online?subject=Liberação%20do%20módulo%20de%20Agendamentos">
              <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90">
                <Mail className="w-4 h-4 mr-2" />
                Solicitar acesso
              </Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
