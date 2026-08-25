import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, Circle } from "lucide-react";
import { StepGuidedLaudo } from "./steps/StepGuidedLaudo";

interface ChecklistAtivacaoProps {
  hasPatients?: boolean;
  onLaudoCreated: (laudoId: string) => void;
}

export const ChecklistAtivacao = ({ hasPatients = false, onLaudoCreated }: ChecklistAtivacaoProps) => {
  const [open, setOpen] = useState(false);

  const items = [
    { label: "Conta criada", done: true, action: null as null | (() => void) },
    { label: "Gerar seu primeiro laudo", done: false, action: () => setOpen(true) },
    { label: "Cadastrar seu primeiro paciente", done: hasPatients, action: null },
  ];
  const doneCount = items.filter((i) => i.done).length;

  return (
    <>
      <Card className="border-border shadow-soft mb-6">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Comece por aqui
            </h2>
            <span className="text-xs text-muted-foreground">
              {doneCount} de {items.length}
            </span>
          </div>

          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.label} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {item.done ? (
                    <Check className="w-4 h-4 text-primary shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <span
                    className={
                      item.done
                        ? "text-sm text-muted-foreground truncate"
                        : "text-sm text-foreground truncate"
                    }
                  >
                    {item.label}
                  </span>
                </div>
                {item.action && (
                  <Button size="sm" onClick={item.action} className="shrink-0">
                    Fazer agora
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Laudo de demonstração</DialogTitle>
          </DialogHeader>
          <StepGuidedLaudo
            onLaudoCreated={(id) => {
              setOpen(false);
              onLaudoCreated(id);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};
