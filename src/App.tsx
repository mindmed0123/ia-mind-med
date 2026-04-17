import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SubscriptionGuard } from "@/components/guards/SubscriptionGuard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { lazy, Suspense } from "react";
import { Activity } from "lucide-react";

// Eager load: auth page (entry point)
import Auth from "./pages/Auth";

// Lazy load all other pages
const Home = lazy(() => import("./pages/Home"));
const Produto = lazy(() => import("./pages/Produto"));
const Precos = lazy(() => import("./pages/Precos"));
const Integracoes = lazy(() => import("./pages/Integracoes"));
const Contato = lazy(() => import("./pages/Contato"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const NovoLaudo = lazy(() => import("./pages/NovoLaudo"));
const Perfil = lazy(() => import("./pages/Perfil"));
const Receituarios = lazy(() => import("./pages/Receituarios"));
const Pacientes = lazy(() => import("./pages/Pacientes"));
const HistoricoPaciente = lazy(() => import("./pages/HistoricoPaciente"));
const EvolutionReport = lazy(() => import("./pages/EvolutionReport"));
const Admin = lazy(() => import("./pages/Admin"));
const NotFound = lazy(() => import("./pages/NotFound"));
const DavChat = lazy(() => import("./pages/DavChat"));
const MedicosTrial = lazy(() => import("./pages/MedicosTrial"));
const AssinaturaExpirada = lazy(() => import("./pages/AssinaturaExpirada"));
const TrialConvite = lazy(() => import("./pages/TrialConvite"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const Termos = lazy(() => import("./pages/Termos"));
const Privacidade = lazy(() => import("./pages/Privacidade"));
const Agendamentos = lazy(() => import("./pages/Agendamentos"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <Activity className="w-10 h-10 text-primary mx-auto mb-3 animate-spin" />
      <p className="text-sm text-muted-foreground">Carregando...</p>
    </div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<Auth />} />
                <Route path="/home" element={<Home />} />
                <Route path="/produto" element={<Produto />} />
                <Route path="/precos" element={<Precos />} />
                <Route path="/integracoes" element={<Integracoes />} />
                <Route path="/contato" element={<Contato />} />
                <Route path="/medicos/teste-gratis" element={<MedicosTrial />} />
                <Route path="/medicos/assinatura-expirada" element={<AssinaturaExpirada />} />
                <Route path="/convite/trial-vip-2024" element={<TrialConvite />} />
                <Route path="/unsubscribe" element={<Unsubscribe />} />
                <Route path="/termos" element={<Termos />} />
                <Route path="/privacidade" element={<Privacidade />} />
                
                {/* Protected routes */}
                <Route path="/dashboard" element={<SubscriptionGuard><Dashboard /></SubscriptionGuard>} />
                <Route path="/novo-laudo" element={<SubscriptionGuard allowEmbedded><NovoLaudo /></SubscriptionGuard>} />
                <Route path="/perfil" element={<SubscriptionGuard><Perfil /></SubscriptionGuard>} />
                <Route path="/receituarios" element={<SubscriptionGuard><Receituarios /></SubscriptionGuard>} />
                <Route path="/pacientes" element={<SubscriptionGuard><Pacientes /></SubscriptionGuard>} />
                <Route path="/historico-paciente/:patientId" element={<SubscriptionGuard><HistoricoPaciente /></SubscriptionGuard>} />
                <Route path="/evolucao/:patientId" element={<SubscriptionGuard><EvolutionReport /></SubscriptionGuard>} />
                <Route path="/admin" element={<SubscriptionGuard><Admin /></SubscriptionGuard>} />
                <Route path="/dav-chat" element={<SubscriptionGuard><DavChat /></SubscriptionGuard>} />
                <Route path="/agendamentos" element={<SubscriptionGuard><Agendamentos /></SubscriptionGuard>} />
                
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
