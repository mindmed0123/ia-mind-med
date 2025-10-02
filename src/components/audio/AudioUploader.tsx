import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Upload, FileAudio, X } from "lucide-react";
import { useAudioUpload } from "@/hooks/useAudioUpload";

interface AudioUploaderProps {
  onUploadComplete?: (url: string, path: string) => void;
}

export const AudioUploader = ({ onUploadComplete }: AudioUploaderProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadAudio, uploading, progress } = useAudioUpload();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setAudioUrl(URL.createObjectURL(file));
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    const result = await uploadAudio(selectedFile);
    if (result) {
      onUploadComplete?.(result.url, result.path);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setAudioUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Card className="shadow-soft">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".webm,.ogg,.mp3,.wav,.m4a,.flac,.mp4"
              onChange={handleFileSelect}
              className="hidden"
              id="audio-upload"
            />
            <label htmlFor="audio-upload" className="flex-1">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                Selecionar arquivo de áudio
              </Button>
            </label>
          </div>

          {selectedFile && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-accent/10 rounded-md">
                <FileAudio className="w-5 h-5 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClear}
                  disabled={uploading}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {audioUrl && (
                <audio
                  controls
                  src={audioUrl}
                  className="w-full"
                  preload="metadata"
                />
              )}

              {uploading && (
                <div className="space-y-2">
                  <Progress value={progress} />
                  <p className="text-sm text-center text-muted-foreground">
                    Enviando... {progress}%
                  </p>
                </div>
              )}

              {!uploading && (
                <Button
                  onClick={handleUpload}
                  className="w-full gradient-primary"
                >
                  Enviar para transcrição
                </Button>
              )}
            </div>
          )}

          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Formatos aceitos: webm, ogg, mp3, wav, m4a, flac, mp4</p>
            <p>• Tamanho máximo: 100 MB</p>
            <p>• Duração máxima: 30 minutos</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
