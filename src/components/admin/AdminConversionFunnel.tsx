import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface FunnelData {
  totalSignups: number;
  lgpdConsent: number;
  onboardingCompleted: number;
  firstLaudo: number;
  activePaid: number;
}

interface AdminConversionFunnelProps {
  data: FunnelData;
}

export const AdminConversionFunnel = ({ data }: AdminConversionFunnelProps) => {
  const base = data.totalSignups || 1;
  const steps = [
    { label: "Cadastros", value: data.totalSignups, pct: 100 },
    { label: "Consentiu LGPD", value: data.lgpdConsent, pct: (data.lgpdConsent / base) * 100 },
    { label: "Completou Onboarding", value: data.onboardingCompleted, pct: (data.onboardingCompleted / base) * 100 },
    { label: "Gerou 1º Laudo", value: data.firstLaudo, pct: (data.firstLaudo / base) * 100 },
    { label: "Converteu (pago)", value: data.activePaid, pct: (data.activePaid / base) * 100 },
  ];

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="text-lg">Funil de Conversão</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {steps.map((step, i) => (
          <div key={step.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">{step.label}</span>
              <span className="text-sm text-muted-foreground">
                {step.value} ({step.pct.toFixed(1)}%)
              </span>
            </div>
            <Progress value={step.pct} className="h-3" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
