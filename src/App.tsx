import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SubscriptionGuard } from "@/components/guards/SubscriptionGuard";
import Index from "./pages/Index";
import Home from "./pages/Home";
import Produto from "./pages/Produto";
import Precos from "./pages/Precos";
import Integracoes from "./pages/Integracoes";
import Contato from "./pages/Contato";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import NovoLaudo from "./pages/NovoLaudo";
import Perfil from "./pages/Perfil";
import Receituarios from "./pages/Receituarios";
import Pacientes from "./pages/Pacientes";
import HistoricoPaciente from "./pages/HistoricoPaciente";
import EvolutionReport from "./pages/EvolutionReport";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
// Debug imports removed for production safety
import DavChat from "./pages/DavChat";
import MedicosTrial from "./pages/MedicosTrial";
import AssinaturaExpirada from "./pages/AssinaturaExpirada";
import TrialConvite from "./pages/TrialConvite";
import Unsubscribe from "./pages/Unsubscribe";
import Termos from "./pages/Termos";
import Privacidade from "./pages/Privacidade";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Auth />} />
            {/* /old route removed - consolidated to /home */}
            <Route path="/home" element={<Home />} />
            <Route path="/produto" element={<Produto />} />
            <Route path="/precos" element={<Precos />} />
            <Route path="/integracoes" element={<Integracoes />} />
            <Route path="/contato" element={<Contato />} />
            <Route path="/medicos/teste-gratis" element={<MedicosTrial />} />
            <Route path="/medicos/assinatura-expirada" element={<AssinaturaExpirada />} />
            <Route path="/convite/trial-vip-2024" element={<TrialConvite />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            
            {/* Protected routes - require active subscription */}
            <Route path="/dashboard" element={
              <SubscriptionGuard>
                <Dashboard />
              </SubscriptionGuard>
            } />
            <Route path="/novo-laudo" element={
              <SubscriptionGuard>
                <NovoLaudo />
              </SubscriptionGuard>
            } />
            <Route path="/perfil" element={
              <SubscriptionGuard>
                <Perfil />
              </SubscriptionGuard>
            } />
            <Route path="/receituarios" element={
              <SubscriptionGuard>
                <Receituarios />
              </SubscriptionGuard>
            } />
            <Route path="/pacientes" element={
              <SubscriptionGuard>
                <Pacientes />
              </SubscriptionGuard>
            } />
            <Route path="/historico-paciente/:patientId" element={
              <SubscriptionGuard>
                <HistoricoPaciente />
              </SubscriptionGuard>
            } />
            <Route path="/evolucao/:patientId" element={
              <SubscriptionGuard>
                <EvolutionReport />
              </SubscriptionGuard>
            } />
            <Route path="/admin" element={
              <SubscriptionGuard>
                <Admin />
              </SubscriptionGuard>
            } />
            <Route path="/dav-chat" element={
              <SubscriptionGuard>
                <DavChat />
              </SubscriptionGuard>
            } />
            
            {/* Debug routes removed - not accessible in production */}
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
