import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Video, Plus, Calendar, Activity, CheckCircle2, Search, ShieldCheck } from "lucide-react";
import { useTeleconsultas } from "@/hooks/useTeleconsultas";
import { TeleconsultaCard } from "./TeleconsultaCard";
import { NovaTeleconsultaModal } from "./NovaTeleconsultaModal";

export function TelemedicinaDashboard() {
  const { teleconsultas, loading, cancelar } = useTeleconsultas();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const today = new Date().toDateString();
  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return teleconsultas.filter((t) => t.patient_name.toLowerCase().includes(term));
  }, [teleconsultas, search]);

  const hoje = filtered.filter((t) => {
    const d = t.scheduled_at ? new Date(t.scheduled_at).toDateString() : new Date(t.created_at).toDateString();
    return d === today && t.status !== "concluida" && t.status !== "cancelada";
  });
  const proximas = filtered.filter((t) => {
    if (!t.scheduled_at) return false;
    return new Date(t.scheduled_at) > new Date() && new Date(t.scheduled_at).toDateString() !== today && t.status === "agendada";
  });
  const concluidas = filtered.filter((t) => t.status === "concluida");
  const aguardando = teleconsultas.filter((t) => t.status === "sala_aberta").length;
  const emAndamento = teleconsultas.filter((t) => t.status === "em_andamento").length;
  const mesCount = teleconsultas.filter((t) => {
    const d = new Date(t.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && t.status === "concluida";
  }).length;

  const Empty = ({ msg }: { msg: string }) => (
    <div className="text-center py-12 text-muted-foreground">
      <Video className="w-12 h-12 mx-auto mb-3 opacity-30" />
      <p>{msg}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Video className="w-7 h-7 text-cyan-600" /> Telemedicina
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Consultas por vídeo com conformidade CFM 2.314/2022</p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-gradient-to-r from-cyan-500 to-blue-600">
          <Plus className="w-4 h-4 mr-2" /> Nova Teleconsulta
        </Button>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Calendar className="w-3 h-3" /> Hoje</div>
          <div className="text-2xl font-bold mt-1">{hoje.length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Activity className="w-3 h-3" /> Aguardando</div>
          <div className="text-2xl font-bold mt-1 text-amber-600">{aguardando}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Video className="w-3 h-3" /> Em andamento</div>
          <div className="text-2xl font-bold mt-1 text-green-600">{emAndamento}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="w-3 h-3" /> Mês</div>
          <div className="text-2xl font-bold mt-1">{mesCount}</div>
        </CardContent></Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por paciente..." className="pl-9" />
      </div>

      <Tabs defaultValue="hoje">
        <TabsList>
          <TabsTrigger value="hoje">Hoje ({hoje.length})</TabsTrigger>
          <TabsTrigger value="proximas">Próximas ({proximas.length})</TabsTrigger>
          <TabsTrigger value="concluidas">Concluídas ({concluidas.length})</TabsTrigger>
          <TabsTrigger value="todas">Todas ({filtered.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="hoje" className="space-y-3 mt-4">
          {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> :
            hoje.length === 0 ? <Empty msg="Nenhuma teleconsulta para hoje" /> :
            hoje.map((t) => <TeleconsultaCard key={t.id} teleconsulta={t} onCancel={cancelar} />)}
        </TabsContent>
        <TabsContent value="proximas" className="space-y-3 mt-4">
          {proximas.length === 0 ? <Empty msg="Nenhuma teleconsulta futura" /> :
            proximas.map((t) => <TeleconsultaCard key={t.id} teleconsulta={t} onCancel={cancelar} />)}
        </TabsContent>
        <TabsContent value="concluidas" className="space-y-3 mt-4">
          {concluidas.length === 0 ? <Empty msg="Nenhuma teleconsulta concluída" /> :
            concluidas.map((t) => <TeleconsultaCard key={t.id} teleconsulta={t} />)}
        </TabsContent>
        <TabsContent value="todas" className="space-y-3 mt-4">
          {filtered.length === 0 ? <Empty msg="Você ainda não realizou teleconsultas" /> :
            filtered.map((t) => <TeleconsultaCard key={t.id} teleconsulta={t} onCancel={cancelar} />)}
        </TabsContent>
      </Tabs>

      <div className="text-xs text-muted-foreground border-t pt-4 flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
        <p>Atendimento conforme Resolução CFM nº 2.314/2022 e Lei 14.510/2022. Pacientes crônicos necessitam de consulta presencial a cada 180 dias.</p>
      </div>

      <NovaTeleconsultaModal open={open} onOpenChange={setOpen} />
    </div>
  );
}
