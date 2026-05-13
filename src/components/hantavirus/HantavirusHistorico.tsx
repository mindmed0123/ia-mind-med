import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RISCO_CONFIG, RiscoHantavirus, TriagemHantavirus } from "@/types/hantavirus";
import { Loader2, Search } from "lucide-react";

const FILTROS: (RiscoHantavirus | "todos")[] = ["todos", "baixo", "moderado", "alto", "critico"];

export function HantavirusHistorico() {
  const { organization } = useOrganization();
  const [items, setItems] = useState<TriagemHantavirus[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<RiscoHantavirus | "todos">("todos");
  const [busca, setBusca] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!organization?.id) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("triagens_hantavirus" as any)
        .select("*")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false })
        .limit(200);
      setItems((data as unknown as TriagemHantavirus[]) ?? []);
      setLoading(false);
    })();
  }, [organization?.id]);

  const filtered = items.filter((i) => {
    if (filtro !== "todos" && i.classificacao_risco !== filtro) return false;
    if (busca && !i.patient_name.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  });

  const pageSize = 10;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const slice = filtered.slice(page * pageSize, page * pageSize + pageSize);

  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
          <h3 className="font-semibold">Histórico de Triagens</h3>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-8 h-9 w-full sm:w-64"
              placeholder="Buscar paciente..."
              value={busca}
              onChange={(e) => { setBusca(e.target.value); setPage(0); }}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTROS.map((f) => (
            <button
              key={f}
              onClick={() => { setFiltro(f); setPage(0); }}
              className={`text-xs px-3 py-1 rounded-full border transition ${
                filtro === f
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-muted"
              }`}
            >
              {f === "todos" ? "Todos" : RISCO_CONFIG[f].label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : slice.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-10">
            Nenhuma triagem encontrada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2">Paciente</th>
                  <th className="py-2">Data</th>
                  <th className="py-2">Probabilidade</th>
                  <th className="py-2">Classificação</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {slice.map((t) => {
                  const cfg = t.classificacao_risco ? RISCO_CONFIG[t.classificacao_risco] : null;
                  return (
                    <tr key={t.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="py-3 font-medium">{t.patient_name}</td>
                      <td className="py-3 text-muted-foreground">
                        {new Date(t.created_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="py-3 font-semibold">{t.probabilidade_hantavirus ?? "—"}%</td>
                      <td className="py-3">
                        {cfg ? (
                          <Badge className={`${cfg.corFundo} ${cfg.cor} border`}>
                            {cfg.emoji} {cfg.label}
                          </Badge>
                        ) : "—"}
                      </td>
                      <td className="py-3 text-xs text-muted-foreground">
                        {t.status === "salvo_prontuario" ? "Salvo no prontuário" : "Concluído"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground">
              {page + 1} / {pages}
            </span>
            <Button variant="outline" size="sm"
              onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
              disabled={page >= pages - 1}>
              Próxima
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
