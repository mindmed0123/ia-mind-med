import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";

export type PeriodPreset = "7d" | "30d" | "90d" | "mtd" | "all";

export interface PeriodRange {
  preset: PeriodPreset;
  from: Date;
  to: Date;
}

const PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
  { value: "mtd", label: "Mês atual" },
  { value: "all", label: "Tudo" },
];

export function computeRange(preset: PeriodPreset): PeriodRange {
  const to = new Date();
  let from = new Date();
  switch (preset) {
    case "7d":  from.setDate(to.getDate() - 7); break;
    case "30d": from.setDate(to.getDate() - 30); break;
    case "90d": from.setDate(to.getDate() - 90); break;
    case "mtd": from = new Date(to.getFullYear(), to.getMonth(), 1); break;
    case "all": from = new Date(2020, 0, 1); break;
  }
  return { preset, from, to };
}

export const PeriodSelector = ({
  value,
  onChange,
}: {
  value: PeriodPreset;
  onChange: (p: PeriodPreset) => void;
}) => (
  <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg p-1">
    <Calendar className="w-4 h-4 ml-2 text-muted-foreground" />
    {PRESETS.map(p => (
      <Button
        key={p.value}
        size="sm"
        variant={value === p.value ? "default" : "ghost"}
        className="h-7 text-xs"
        onClick={() => onChange(p.value)}
      >
        {p.label}
      </Button>
    ))}
  </div>
);
