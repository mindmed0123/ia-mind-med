import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_DURATION = 30 * 60; // 30 minutes in seconds

const ALLOWED_FORMATS = [
  'audio/webm',
  'audio/ogg',
  'audio/mpeg', // .mp3
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4', // .m4a / .mp4 audio
  'audio/flac',
];

interface UploadResult {
  url: string;
  path: string;
  size: number;
  mime: string;
}

export const useAudioUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const validateFile = (file: File): boolean => {
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "Arquivo muito grande",
        description: "O arquivo deve ter no máximo 100MB",
        variant: "destructive",
      });
      return false;
    }

    if (!ALLOWED_FORMATS.includes(file.type)) {
      toast({
        title: "Formato não suportado",
        description: "Formato de áudio não suportado. Use webm, ogg, mp3, wav, m4a, flac ou mp4.",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const uploadAudio = async (file: File): Promise<UploadResult | null> => {
    if (!validateFile(file)) {
      return null;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Não autenticado",
        description: "Você precisa estar logado para fazer upload",
        variant: "destructive",
      });
      return null;
    }

    setUploading(true);
    setProgress(0);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('audio-files')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('audio-files')
        .getPublicUrl(data.path);

      setProgress(100);
      
      toast({
        title: "Upload concluído",
        description: "Áudio enviado com sucesso!",
      });

      return {
        url: publicUrl,
        path: data.path,
        size: file.size,
        mime: file.type,
      };
    } catch (error: any) {
      toast({
        title: "Erro no upload",
        description: error.message || "Não foi possível fazer o upload do arquivo",
        variant: "destructive",
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  return {
    uploadAudio,
    uploading,
    progress,
  };
};
