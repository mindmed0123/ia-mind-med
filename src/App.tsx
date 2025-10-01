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
import AoVivo from "./pages/AoVivo";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/home" element={<Home />} />
            <Route path="/produto" element={<Produto />} />
            <Route path="/precos" element={<Precos />} />
            <Route path="/integracoes" element={<Integracoes />} />
            <Route path="/contato" element={<Contato />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/novo-laudo" element={<NovoLaudo />} />
          <Route path="/ao-vivo" element={<AoVivo />} />
          <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
