import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/hooks/useOrganization";
import {
  TriagemHantavirus,
  SintomasHantavirus,
  FatoresEpidemiologicos,
  SINTOMAS_DEFAULT,
  FATORES_DEFAULT,
} from "@/types/hantavirus";

export function useHantavirusTriagem() {
  const { user } = useAuth();
  const { organization } = useOrganization();

  const [sintomas, setSintomas] = useState<SintomasHantavirus>(SINTOMAS_DEFAULT);
  const [fatores, setFatores] = useState<FatoresEpidemiologicos>(FATORES_DEFAULT);
  const [descricaoSintomas, setDescricaoSintomas] = useState("");
  const [imagens, setImagens] = useState<File[]>([]);
  const [patientName, setPatientName] = useState("");
  const [patientId, setPatientId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [resultado, setResultado] = useState<TriagemHantavirus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleSintoma = useCallback((key: keyof SintomasHantavirus) => {
    setSintomas((p) => ({ ...p, [key]: !p[key] }));
  }, []);
  const toggleFator = useCallback((key: keyof FatoresEpidemiologicos) => {
    setFatores((p) => ({ ...p, [key]: !p[key] }));
  }, []);

  const uploadImagens = async (): Promise<string[]> => {
    if (!imagens.length || !organization?.id) return [];
    const urls: string[] = [];
    for (const file of imagens) {
      const safeName = file.name.replace(/[^\w.\-]/g, "_");
      const path = `${organization.id}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("hantavirus-imagens")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (!upErr) {
        const { data: signed } = await supabase.storage
          .from("hantavirus-imagens")
          .createSignedUrl(path, 3600);
        if (signed?.signedUrl) urls.push(signed.signedUrl);
      }
    }
    return urls;
  };

  const transcreverAudio = async (audioBlob: Blob): Promise<string> => {
    const fd = new FormData();
    fd.append("audio", audioBlob, "audio.webm");
    const { data, error: fnErr } = await supabase.functions.invoke(
      "transcrever-sintomas-hantavirus",
      { body: fd }
    );
    if (fnErr) throw new Error(fnErr.message);
    return (data as any)?.transcricao || "";
  };

  const analisar = async () => {
    if (!user || !organization) {
      setError("Usuário ou organização não encontrados.");
      return;
    }
    if (!patientName.trim()) {
      setError("Informe o nome do paciente.");
      return;
    }
    const sintomasCount = Object.values(sintomas).filter(Boolean).length;
    if (sintomasCount === 0 && !descricaoSintomas.trim()) {
      setError("Informe ao menos 1 sintoma ou descreva o quadro clínico.");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    try {
      const imageUrls = await uploadImagens();

      const { data, error: fnErr } = await supabase.functions.invoke(
        "analisar-hantavirus",
        {
          body: {
            sintomas,
            fatores_epidemiologicos: fatores,
            descricao_sintomas: descricaoSintomas,
            imagens_urls: imageUrls,
            patient_name: patientName,
          },
        }
      );
      if (fnErr) throw new Error(fnErr.message);
      const r = data as any;

      const { data: triagem, error: dbErr } = await supabase
        .from("triagens_hantavirus" as any)
        .insert({
          organization_id: organization.id,
          doctor_id: user.id,
          patient_id: patientId,
          patient_name: patientName,
          sintomas,
          fatores_epidemiologicos: fatores,
          descricao_sintomas: descricaoSintomas || null,
          imagens_manchas: imageUrls,
          probabilidade_hantavirus: r.probabilidade,
          classificacao_risco: r.classificacao,
          analise_ia: r.analise_ia,
          analise_imagem_ia: r.analise_imagem_ia,
          recomendacoes_ia: r.recomendacoes_ia,
          diferenciais_ia: r.diferenciais_ia,
          status: "concluido",
          created_by: user.id,
        })
        .select()
        .single();
      if (dbErr) throw dbErr;
      setResultado(triagem as unknown as TriagemHantavirus);
    } catch (err) {
      setError((err as Error).message || "Erro ao analisar.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const salvarProntuario = async () => {
    if (!resultado) return;
    await supabase
      .from("triagens_hantavirus" as any)
      .update({ status: "salvo_prontuario" })
      .eq("id", resultado.id);
    setResultado({ ...resultado, status: "salvo_prontuario" });
  };

  const resetar = () => {
    setSintomas(SINTOMAS_DEFAULT);
    setFatores(FATORES_DEFAULT);
    setDescricaoSintomas("");
    setImagens([]);
    setPatientName("");
    setPatientId(null);
    setResultado(null);
    setError(null);
  };

  return {
    sintomas, toggleSintoma,
    fatores, toggleFator,
    descricaoSintomas, setDescricaoSintomas,
    imagens, setImagens,
    patientName, setPatientName,
    patientId, setPatientId,
    isAnalyzing, isRecording, setIsRecording,
    resultado, error,
    analisar, resetar, salvarProntuario, transcreverAudio,
  };
}
