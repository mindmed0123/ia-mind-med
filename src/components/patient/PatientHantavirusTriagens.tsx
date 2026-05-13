import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Download, Loader2, Microscope } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { TriagemHantavirus, RISCO_CONFIG } from "@/types/hantavirus";
import { gerarLaudoHantavirusPdf } from "@/lib/gerarLaudoHantavirusPdf";

interface Props {
  patientId: string;
}

export function PatientHantavirusTriagens({ patientId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<TriagemHantavirus[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("triagens_hantavirus")
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });
      setItems((data || []) as TriagemHantavirus[]);
      setLoading(false);
    })();
  }, [patientId]);

  const baixarPdf = async (t: TriagemHantavirus) => {
    if (!user) return;
    setDownloadingId(t.id);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, crm, crm_uf, specialty, clinic_name")
        .eq("id", user.id)
        .maybeSingle();
      await gerarLaudoHantavirusPdf(t as any, (profile || {}) as any);
    } catch (err) {
      toast({ title: "Erro", description: (err as Error).message, variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!items.length) {
    return (
      <Card>
        <CardContent className="pt-6 text-center py-8">
          <Microscope className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhuma triagem de Hantavírus para este paciente.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((t) => {
        const r = RISCO_CONFIG[t.classificacao_risco ?? "baixo"];
        return (
          <Card key={t.id} className="hover:shadow-medium transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Badge className={r.corFundo + " " + r.cor + " border"}>
                      {r.emoji} {r.label}
                    </Badge>
                    <span className="text-2xl font-bold">{t.probabilidade_hantavirus}%</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    {new Date(t.created_at).toLocaleString("pt-BR")}
                  </div>
                  {t.imagens_manchas?.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      📷 {t.imagens_manchas.length} imagem(ns) de lesão
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => baixarPdf(t)}
                  disabled={downloadingId === t.id}
                >
                  {downloadingId === t.id ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-1" />
                  )}
                  Laudo PDF
                </Button>
              </div>
              {t.analise_ia && (
                <p className="mt-3 text-sm text-foreground/80 line-clamp-3 whitespace-pre-wrap">
                  {t.analise_ia}
                </p>
              )}
              {t.imagens_manchas?.length > 0 && (
                <div className="flex gap-2 flex-wrap mt-3">
                  {t.imagens_manchas.slice(0, 4).map((url, i) => (
                    <img key={i} src={url} alt="" className="w-16 h-16 object-cover rounded border" />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
