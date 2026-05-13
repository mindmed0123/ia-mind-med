import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HantavirusModal } from "./HantavirusModal";
import { ArrowRight } from "lucide-react";

interface Props {
  variant?: "compact" | "full" | "alert";
  className?: string;
}

export function HantavirusButton({ variant = "full", className = "" }: Props) {
  const [open, setOpen] = useState(false);

  if (variant === "alert") {
    return (
      <>
        <Card className={`border-2 border-red-300 bg-gradient-to-r from-red-50 to-orange-50 ${className}`}>
          <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
            <div className="flex items-start gap-3">
              <span className="text-3xl">🦠</span>
              <div>
                <p className="font-bold text-red-800">
                  Surto de Hantavírus — Alerta Ativo
                </p>
                <p className="text-sm text-red-700">
                  Vírus Andes confirmado em surto internacional. Realize a triagem de pacientes suspeitos.
                </p>
              </div>
            </div>
            <Button
              onClick={() => setOpen(true)}
              className="bg-gradient-to-r from-red-600 to-orange-500 hover:opacity-90 shrink-0"
            >
              Iniciar Triagem <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
        <HantavirusModal open={open} onOpenChange={setOpen} />
      </>
    );
  }

  if (variant === "compact") {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className={`border-red-300 text-red-700 hover:bg-red-50 ${className}`}
        >
          🦠 Hantavírus
        </Button>
        <HantavirusModal open={open} onOpenChange={setOpen} />
      </>
    );
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className={`h-auto py-3 bg-gradient-to-r from-red-600 to-orange-500 hover:opacity-90 ${className}`}
      >
        <span className="mr-2 text-lg">🦠</span>
        Triagem Hantavírus
        <span className="ml-2 text-xs bg-white/20 px-1.5 py-0.5 rounded animate-pulse">
          SURTO 2026
        </span>
      </Button>
      <HantavirusModal open={open} onOpenChange={setOpen} />
    </>
  );
}
