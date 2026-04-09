import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { FileText, Calendar, Eye, Pencil, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

interface Laudo {
  id: string;
  title: string;
  created_at: string;
  status: string;
  patient_data: any;
  specialty: string | null;
}

const PAGE_SIZE = 10;

export const LaudoHistory = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [laudos, setLaudos] = useState<Laudo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounce(searchInput, 400);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (user) loadLaudos();
  }, [user, page, search]);

  const loadLaudos = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("laudos")
        .select("id, title, created_at, status, patient_data, specialty", { count: "exact" })
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (search.trim().length >= 2) {
        query = query.ilike("title", `%${search.trim()}%`);
      }

      query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      const { data, count, error } = await query;
      if (error) throw error;
      setLaudos(data || []);
      setTotal(count || 0);
    } catch (error) {
      // Error loading laudos silently
    } finally {
      setLoading(false);
    }
  };

  const filteredLaudos = search
    ? laudos.filter((l) => {
        const pd = l.patient_data as any;
        const patientName = pd?.nome_completo || pd?.iniciais || pd?.nome || "";
        const searchLower = search.toLowerCase();
        return (
          l.title.toLowerCase().includes(searchLower) ||
          patientName.toLowerCase().includes(searchLower)
        );
      })
    : laudos;

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const getStatusBadge = (status: string) => {
    if (status === "completed") {
      return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Finalizado</span>;
    }
    return <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Rascunho</span>;
  };

  const getPatientName = (patientData: any) => {
    if (!patientData) return "—";
    return patientData?.nome_completo || patientData?.iniciais || patientData?.nome || "—";
  };

  if (loading && page === 0) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por título ou paciente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filteredLaudos.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>Nenhum laudo encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredLaudos.map((laudo) => (
            <Card
              key={laudo.id}
              className="shadow-soft hover:shadow-medium transition-smooth cursor-pointer"
              onClick={() => navigate(`/novo-laudo?id=${laudo.id}`)}
            >
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{laudo.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{getPatientName(laudo.patient_data)}</span>
                        {laudo.specialty && (
                          <>
                            <span>•</span>
                            <span>{laudo.specialty}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {getStatusBadge(laudo.status || "draft")}
                    <span className="text-xs text-muted-foreground flex items-center gap-1 hidden sm:flex">
                      <Calendar className="w-3 h-3" />
                      {new Date(laudo.created_at).toLocaleDateString("pt-BR")}
                    </span>
                    <div className="flex gap-1 ml-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => navigate(`/novo-laudo?id=${laudo.id}`)}
                        title="Visualizar"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => navigate(`/novo-laudo?id=${laudo.id}&tab=editor`)}
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            {total} laudo{total !== 1 ? "s" : ""} no total
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {page + 1} / {totalPages}
            </span>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
