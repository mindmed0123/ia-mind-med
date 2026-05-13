import { useEffect, useRef, useState } from "react";
import { RiscoHantavirus, RISCO_CONFIG } from "@/types/hantavirus";

interface Props {
  value: number; // 0-100
  risco: RiscoHantavirus;
  size?: number;
}

export function ProbabilityGauge({ value, risco, size = 180 }: Props) {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number>();

  useEffect(() => {
    const start = performance.now();
    const dur = 1500;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(value * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => raf.current && cancelAnimationFrame(raf.current);
  }, [value]);

  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (display / 100) * circ;

  const colorMap: Record<RiscoHantavirus, string> = {
    baixo: "#10b981",
    moderado: "#f59e0b",
    alto: "#ef4444",
    critico: "#b91c1c",
  };

  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colorMap[risco]}
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke 400ms" }}
        />
      </svg>
      <div className="-mt-[60%] flex flex-col items-center pointer-events-none" style={{ height: size / 2 }}>
        <span className="text-4xl font-bold" style={{ color: colorMap[risco] }}>{display}%</span>
        <span className="text-[11px] text-muted-foreground uppercase tracking-wide mt-1">
          Probabilidade
        </span>
      </div>
      <div className={`mt-3 px-4 py-1.5 rounded-full border text-sm font-semibold ${RISCO_CONFIG[risco].corFundo} ${RISCO_CONFIG[risco].cor}`}>
        {RISCO_CONFIG[risco].emoji} {RISCO_CONFIG[risco].label}
      </div>
    </div>
  );
}
