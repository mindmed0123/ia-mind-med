import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/hooks/useOrganization";
import { unmaskCpf, isValidCpf } from "@/lib/cpf";
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
  const [patientCpf, setPatientCpf] = useState("");
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
          .createSignedUrl(path, 60 * 60 * 24 * 7);
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

  /**
   * Localiza paciente existente pelo CPF do médico ou cria novo registro.
   * Garante que toda triagem fica vinculada à seção Pacientes.
   */
  const upsertPaciente = async (cpfDigits: string): Promise<string> => {
    if (!user) throw new Error("Usuário não autenticado");

    const { data: existente } = await supabase
      .from("patients")
      .select("id, name")
      .eq("user_id", user.id)
      .eq("cpf" as any, cpfDigits)
      .maybeSingle();

    if (existente?.id) {
      // atualiza nome se mudou
      if (existente.name !== patientName.trim()) {
        await supabase
          .from("patients")
          .update({ name: patientName.trim() })
          .eq("id", existente.id);
      }
      return existente.id;
    }

    const { data: novo, error: insErr } = await supabase
      .from("patients")
      .insert({
        user_id: user.id,
        organization_id: organization?.id ?? null,
        name: patientName.trim(),
        cpf: cpfDigits,
        clinical_notes: "Cadastrado via Triagem Hantavírus",
      } as any)
      .select("id")
      .single();
    if (insErr) throw insErr;
    return novo!.id;
  };

  const analisar = async () => {
    setError(null);
    if (!user || !organization) {
      setError("Usuário ou organização não encontrados.");
      return;
    }
    const nomeOk = patientName.trim().split(/\s+/).length >= 2;
    if (!nomeOk) {
      setError("Informe o nome completo do paciente (nome e sobrenome).");
      return;
    }
    const cpfDigits = unmaskCpf(patientCpf);
    if (!isValidCpf(cpfDigits)) {
      setError("CPF inválido. Verifique os 11 dígitos.");
      return;
    }
    const sintomasCount = Object.values(sintomas).filter(Boolean).length;
    if (sintomasCount === 0 && !descricaoSintomas.trim()) {
      setError("Informe ao menos 1 sintoma ou descreva o quadro clínico.");
      return;
    }

    setIsAnalyzing(true);
    try {
      // 1) Vincula/cria paciente
      const pid = await upsertPaciente(cpfDigits);
      setPatientId(pid);

      // 2) Upload de imagens
      const imageUrls = await uploadImagens();

      // 3) Análise IA
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

      // 4) Persiste triagem
      const { data: triagem, error: dbErr } = await supabase
        .from("triagens_hantavirus" as any)
        .insert({
          organization_id: organization.id,
          doctor_id: user.id,
          patient_id: pid,
          patient_name: patientName.trim(),
          patient_cpf: cpfDigits,
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
    setPatientCpf("");
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
    patientCpf, setPatientCpf,
    patientId, setPatientId,
    isAnalyzing, isRecording, setIsRecording,
    resultado, error,
    analisar, resetar, salvarProntuario, transcreverAudio,
  };
}
