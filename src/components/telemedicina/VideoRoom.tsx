import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { PhoneOff, MessageSquare, FileText, User, StickyNote, Send, Loader2 } from "lucide-react";
import type { Teleconsulta, TeleconsultaMessage } from "@/types/teleconsulta";

interface Props {
  teleconsulta: Teleconsulta;
  role: "doctor" | "patient";
  onCallEnd?: () => void;
}

export function VideoRoom({ teleconsulta: tc, role, onCallEnd }: Props) {
  const { toast } = useToast();
  const [elapsed, setElapsed] = useState(0);
  const [notes, setNotes] = useState(tc.notes_during_call ?? "");
  const [messages, setMessages] = useState<TeleconsultaMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [endOpen, setEndOpen] = useState(false);
  const [endNotes, setEndNotes] = useState("");
  const [endDiag, setEndDiag] = useState("");
  const [genLaudo, setGenLaudo] = useState(true);
  const [ending, setEnding] = useState(false);
  const noteTimer = useRef<ReturnType<typeof setTimeout>>();
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Cronômetro
  useEffect(() => {
    const start = tc.started_at ? new Date(tc.started_at).getTime() : Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [tc.started_at]);

  // Marca como em_andamento ao montar (só médico)
  useEffect(() => {
    if (role === "doctor" && tc.status !== "em_andamento") {
      supabase
        .from("teleconsultas" as any)
        .update({ status: "em_andamento", started_at: tc.started_at ?? new Date().toISOString() })
        .eq("id", tc.id);
    }
  }, [role, tc.id, tc.status, tc.started_at]);

  // Auto-save notas (debounce 1.5s) — só médico
  const saveNotes = (val: string) => {
    setNotes(val);
    if (role !== "doctor") return;
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => {
      supabase.from("teleconsultas" as any).update({ notes_during_call: val }).eq("id", tc.id);
    }, 1500);
  };

  // Carrega + realtime mensagens
  useEffect(() => {
    let mounted = true;
    supabase
      .from("teleconsulta_messages" as any)
      .select("*")
      .eq("teleconsulta_id", tc.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (mounted && data) setMessages(data as unknown as TeleconsultaMessage[]);
      });

    const ch = supabase
      .channel(`tc-msgs-${tc.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "teleconsulta_messages", filter: `teleconsulta_id=eq.${tc.id}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as unknown as TeleconsultaMessage]);
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, [tc.id]);

  // Auto-scroll chat
  useEffect(() => {
    const el = chatScrollRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLElement | null;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const sendMessage = async () => {
    if (!chatInput.trim()) return;
    const content = chatInput.trim();
    setChatInput("");
    await supabase.from("teleconsulta_messages" as any).insert({
      teleconsulta_id: tc.id,
      sender_role: role,
      sender_name: role === "doctor" ? "Médico" : tc.patient_name,
      content,
    });
  };

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return [h, m, sec].map((n) => n.toString().padStart(2, "0")).join(":");
  };

  const handleEnd = async () => {
    if (role !== "doctor") {
      onCallEnd?.();
      return;
    }
    if (!endNotes.trim() && !notes.trim()) {
      toast({ title: "Notas obrigatórias", description: "Registre observações da consulta.", variant: "destructive" });
      return;
    }
    setEnding(true);
    try {
      const { error } = await supabase.functions.invoke("finalize-teleconsulta", {
        body: {
          teleconsulta_id: tc.id,
          notes: endNotes || notes,
          diagnosis_summary: endDiag || null,
          generate_laudo: genLaudo,
        },
      });
      if (error) throw error;
      toast({ title: "Consulta finalizada", description: "Notas registradas com sucesso" });
      onCallEnd?.();
    } catch (err) {
      toast({ title: "Erro ao finalizar", description: (err as Error).message, variant: "destructive" });
    } finally {
      setEnding(false);
      setEndOpen(false);
    }
  };

  const token = role === "doctor" ? tc.doctor_token : tc.patient_token;
  const iframeSrc = `${tc.room_url}${token ? `?t=${token}` : ""}`;

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-white">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/20 rounded-full">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs font-semibold text-red-200">AO VIVO</span>
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{tc.patient_name}</p>
            <p className="text-xs text-slate-400 font-mono">{formatTime(elapsed)}</p>
          </div>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => (role === "doctor" ? setEndOpen(true) : onCallEnd?.())}
        >
          <PhoneOff className="w-4 h-4 mr-1" /> Encerrar
        </Button>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <div className="flex-1 bg-black min-h-[50vh] lg:min-h-0">
          <iframe
            src={iframeSrc}
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            className="w-full h-full border-0"
            title="Sala de Vídeo"
          />
        </div>

        {role === "doctor" && (
          <div className="w-full lg:w-96 bg-white text-foreground border-l flex flex-col max-h-[50vh] lg:max-h-none">
            <Tabs defaultValue="notes" className="flex-1 flex flex-col">
              <TabsList className="grid grid-cols-3 m-2">
                <TabsTrigger value="notes"><StickyNote className="w-4 h-4 mr-1" />Notas</TabsTrigger>
                <TabsTrigger value="chat"><MessageSquare className="w-4 h-4 mr-1" />Chat</TabsTrigger>
                <TabsTrigger value="patient"><User className="w-4 h-4 mr-1" />Paciente</TabsTrigger>
              </TabsList>

              <TabsContent value="notes" className="flex-1 px-3 pb-3 m-0">
                <Textarea
                  value={notes}
                  onChange={(e) => saveNotes(e.target.value)}
                  placeholder="Anote observações, sintomas, conduta..."
                  className="h-full min-h-[200px] resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">Salvamento automático</p>
              </TabsContent>

              <TabsContent value="chat" className="flex-1 flex flex-col px-3 pb-3 m-0">
                <ScrollArea ref={chatScrollRef} className="flex-1 border rounded-lg p-3 mb-2 min-h-[150px]">
                  <div className="space-y-2">
                    {messages.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-8">Sem mensagens ainda</p>
                    )}
                    {messages.map((m) => (
                      <div key={m.id} className={`text-sm ${m.sender_role === "doctor" ? "text-right" : "text-left"}`}>
                        <div className={`inline-block px-3 py-1.5 rounded-2xl max-w-[85%] ${m.sender_role === "doctor" ? "bg-blue-500 text-white" : "bg-slate-100"}`}>
                          {m.content}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="flex gap-2">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
                    placeholder="Mensagem..."
                  />
                  <Button onClick={sendMessage} size="icon"><Send className="w-4 h-4" /></Button>
                </div>
              </TabsContent>

              <TabsContent value="patient" className="px-3 pb-3 m-0 space-y-2 text-sm">
                <div><strong>Nome:</strong> {tc.patient_name}</div>
                {tc.patient_cpf && <div><strong>CPF:</strong> {tc.patient_cpf}</div>}
                {tc.patient_email && <div><strong>E-mail:</strong> {tc.patient_email}</div>}
                {tc.patient_phone && <div><strong>Telefone:</strong> {tc.patient_phone}</div>}
                {tc.chief_complaint && (
                  <div className="pt-2 border-t">
                    <strong>Queixa principal:</strong>
                    <p className="text-muted-foreground mt-1">{tc.chief_complaint}</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      {/* Modal de encerramento */}
      <Dialog open={endOpen} onOpenChange={setEndOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Encerrar Teleconsulta</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="end-notes">Notas e observações *</Label>
              <Textarea
                id="end-notes"
                value={endNotes || notes}
                onChange={(e) => setEndNotes(e.target.value)}
                rows={5}
                placeholder="Resumo clínico..."
              />
            </div>
            <div>
              <Label htmlFor="end-diag">Resumo diagnóstico</Label>
              <Textarea
                id="end-diag"
                value={endDiag}
                onChange={(e) => setEndDiag(e.target.value)}
                rows={2}
                placeholder="Hipóteses..."
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <Checkbox checked={genLaudo} onCheckedChange={(v) => setGenLaudo(!!v)} />
              <FileText className="w-4 h-4" /> Gerar laudo automaticamente
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEndOpen(false)} disabled={ending}>Cancelar</Button>
            <Button onClick={handleEnd} disabled={ending} variant="destructive">
              {ending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PhoneOff className="w-4 h-4 mr-2" />}
              Concluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
