import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export interface FarmacovigilanciaPrefill {
  paciente?: {
    nome?: string;
    sexo?: 'M' | 'F' | 'Outro' | string;
    dataNascimento?: string;
  };
  produto?: {
    nome?: string;
    apresentacao?: string;
    dose?: string;
    posologia?: string;
  };
}

interface Props {
  prefill?: FarmacovigilanciaPrefill;
  size?: 'sm' | 'default';
  label?: string;
  className?: string;
}

export function FarmacovigilanciaButton({
  prefill,
  size = 'sm',
  label = 'Alertar Farmacovigilância',
  className,
}: Props) {
  const navigate = useNavigate();
  return (
    <Button
      variant="outline"
      size={size}
      onClick={() => navigate('/farmacovigilancia/novo', { state: { prefill } })}
      className={`border-amber-400/50 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/30 ${className ?? ''}`}
    >
      <ShieldAlert className="w-4 h-4 mr-2" />
      {label}
    </Button>
  );
}
