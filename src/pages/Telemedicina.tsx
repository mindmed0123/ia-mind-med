import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Video, Loader2 } from "lucide-react";
import { TelemedicinaDashboard } from "@/components/telemedicina/TelemedicinaDashboard";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { ProFeatureGate } from "@/components/pro/ProFeatureGate";

export default function Telemedicina() {
  const navigate = useNavigate();
  const { hasAccess, loading } = useFeatureAccess("telemedicina");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-30">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            <div className="flex items-center gap-2">
              <Video className="w-5 h-5 text-primary" />
              <h1 className="text-lg font-semibold">Telemedicina</h1>
            </div>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !hasAccess ? (
          <ProFeatureGate feature="Telemedicina">
            <TelemedicinaDashboard />
          </ProFeatureGate>
        ) : (
          <TelemedicinaDashboard />
        )}
      </main>
    </div>
  );
}
