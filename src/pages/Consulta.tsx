import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { VideoRoom } from "@/components/telemedicina/VideoRoom";
import { Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Teleconsulta } from "@/types/teleconsulta";

export default function Consulta() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tc, setTc] = useState<Teleconsulta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase
        .from("teleconsultas" as any)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) {
        toast({ title: "Teleconsulta não encontrada", variant: "destructive" });
        navigate("/telemedicina");
        return;
      }
      setTc(data as unknown as Teleconsulta);
      setLoading(false);
    })();
  }, [id, navigate, toast]);

  if (loading || !tc) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Activity className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <VideoRoom teleconsulta={tc} role="doctor" onCallEnd={() => navigate("/telemedicina")} />
    </div>
  );
}
