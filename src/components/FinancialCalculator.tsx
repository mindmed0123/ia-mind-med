import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calculator, TrendingUp, Clock, DollarSign } from "lucide-react";
import { toast } from "sonner";

interface CalculatorResult {
  hoursRecovered: number;
  extraPatients: number;
  monthlyRevenue: number;
  yearlyRevenue: number;
}

const FinancialCalculator = () => {
  const [patientsPerDay, setPatientsPerDay] = useState<number>(10);
  const [paperworkHours, setPaperworkHours] = useState<number>(2);
  const [avgTicket, setAvgTicket] = useState<number>(300);
  const [result, setResult] = useState<CalculatorResult | null>(null);

  const calculateROI = () => {
    // Tempo de consulta médio: 30 minutos
    const consultationTime = 0.5; // horas

    // Tempo recuperado por dia (75% de redução em papelada)
    const hoursRecovered = paperworkHours * 0.75;

    // Número de consultas extras possíveis
    const extraPatients = Math.floor(hoursRecovered / consultationTime);

    // Receita mensal adicional (considerando 20 dias úteis)
    const monthlyRevenue = extraPatients * avgTicket * 20;

    // Receita anual adicional
    const yearlyRevenue = monthlyRevenue * 12;

    const calculatedResult: CalculatorResult = {
      hoursRecovered,
      extraPatients,
      monthlyRevenue,
      yearlyRevenue,
    };

    setResult(calculatedResult);

    // Salvar no localStorage
    localStorage.setItem("mindmanage_calculator", JSON.stringify({
      inputs: { patientsPerDay, paperworkHours, avgTicket },
      result: calculatedResult,
      timestamp: new Date().toISOString(),
    }));

    // Track event
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "calc_submit", {
        patients_per_day: patientsPerDay,
        paperwork_hours: paperworkHours,
        avg_ticket: avgTicket,
        monthly_revenue: monthlyRevenue,
      });
    }

    toast.success("Cálculo realizado com sucesso!");
  };

  useEffect(() => {
    // Carregar do localStorage ao montar
    const saved = localStorage.getItem("mindmanage_calculator");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setPatientsPerDay(data.inputs.patientsPerDay);
        setPaperworkHours(data.inputs.paperworkHours);
        setAvgTicket(data.inputs.avgTicket);
        setResult(data.result);
      } catch (e) {
        console.error("Error loading calculator data:", e);
      }
    }
  }, []);

  return (
    <div className="w-full max-w-5xl mx-auto">
      <Card className="card-premium border-2 border-secondary/20">
        <div className="p-6 md:p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-secondary/10 mb-4">
              <Calculator className="w-7 h-7 text-secondary" />
            </div>
            <h3 className="text-2xl md:text-3xl font-bold">
              Calcule Seu Potencial de Faturamento
            </h3>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Veja quanto você pode recuperar em faturamento ao eliminar tempo perdido
              com papelada
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="patients" className="text-sm font-medium">
                Pacientes por dia
              </Label>
              <Input
                id="patients"
                type="number"
                min="1"
                max="100"
                value={patientsPerDay}
                onChange={(e) => setPatientsPerDay(Number(e.target.value))}
                className="text-lg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="paperwork" className="text-sm font-medium">
                Horas em papelada/dia
              </Label>
              <Input
                id="paperwork"
                type="number"
                min="0"
                max="8"
                step="0.5"
                value={paperworkHours}
                onChange={(e) => setPaperworkHours(Number(e.target.value))}
                className="text-lg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ticket" className="text-sm font-medium">
                Ticket médio (R$)
              </Label>
              <Input
                id="ticket"
                type="number"
                min="0"
                step="10"
                value={avgTicket}
                onChange={(e) => setAvgTicket(Number(e.target.value))}
                className="text-lg"
              />
            </div>
          </div>

          <Button
            onClick={calculateROI}
            className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground shadow-glow hover:shadow-glow-intense transition-all text-lg py-6"
            size="lg"
          >
            <TrendingUp className="w-5 h-5 mr-2" />
            Calcular Meu ROI
          </Button>

          {result && (
            <div className="mt-8 pt-8 border-t border-border animate-fade-in-up">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-subtle rounded-lg p-6 text-center space-y-3 flex flex-col items-center justify-center min-h-[180px]">
                  <Clock className="w-8 h-8 text-secondary mx-auto flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">Tempo Recuperado</p>
                  <p className="stat-number">
                    {result.hoursRecovered.toFixed(1)}h
                  </p>
                  <p className="text-xs text-muted-foreground">por dia</p>
                </div>

                <div className="bg-gradient-subtle rounded-lg p-6 text-center space-y-3 flex flex-col items-center justify-center min-h-[180px]">
                  <TrendingUp className="w-8 h-8 text-secondary mx-auto flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">Consultas Extras</p>
                  <p className="stat-number">+{result.extraPatients}</p>
                  <p className="text-xs text-muted-foreground">por dia</p>
                </div>

                <div className="bg-gradient-subtle rounded-lg p-6 text-center space-y-3 flex flex-col items-center justify-center min-h-[180px]">
                  <DollarSign className="w-8 h-8 text-success mx-auto flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">Receita Extra/Mês</p>
                  <p className="stat-number text-success">
                    {result.monthlyRevenue.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </p>
                </div>

                <div className="bg-gradient-subtle rounded-lg p-6 text-center space-y-3 flex flex-col items-center justify-center min-h-[180px]">
                  <DollarSign className="w-8 h-8 text-success mx-auto flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">Receita Extra/Ano</p>
                  <p className="stat-number text-success">
                    {result.yearlyRevenue.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </p>
                </div>
              </div>
              <div className="mt-6 p-4 bg-secondary/10 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">
                  A MindMed custa{" "}
                  <strong className="text-foreground">R$ 149,00/mês</strong>. O retorno é imediato — ROI de{" "}
                  <strong className="text-success">
                    {((result.monthlyRevenue / 149 - 1) * 100).toFixed(0)}%
                  </strong>
                  .
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default FinancialCalculator;
