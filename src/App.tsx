import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
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
import PdfTest from "./pages/debug/PdfTest";
import OcrTest from "./pages/debug/OcrTest";
import StorageTest from "./pages/debug/StorageTest";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Auth />} />
            <Route path="/old" element={<Index />} />
            <Route path="/home" element={<Home />} />
            <Route path="/produto" element={<Produto />} />
            <Route path="/precos" element={<Precos />} />
            <Route path="/integracoes" element={<Integracoes />} />
          <Route path="/contato" element={<Contato />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/novo-laudo" element={<NovoLaudo />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/receituarios" element={<Receituarios />} />
          <Route path="/pacientes" element={<Pacientes />} />
          <Route path="/historico-paciente/:patientId" element={<HistoricoPaciente />} />
          <Route path="/evolucao/:patientId" element={<EvolutionReport />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/debug/pdf" element={<PdfTest />} />
          <Route path="/debug/ocr" element={<OcrTest />} />
          <Route path="/debug/storage" element={<StorageTest />} />
          <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
