import { Link } from "react-router-dom";
import { Activity, Mail, Phone } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-muted/30 border-t border-border mt-20">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2 text-xl font-bold">
              <Activity className="w-6 h-6 text-primary" />
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                MindMed
              </span>
            </Link>
            <p className="text-sm text-muted-foreground">
              O maior inimigo do burnout médico. Reduzimos até 40% do tempo de
              burocracia clínica.
            </p>
          </div>

          {/* Produto */}
          <div>
            <h4 className="font-semibold mb-4">Produto</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/medicos/teste-gratis" className="hover:text-primary transition-colors">
                  Teste grátis de 7 dias
                </Link>
              </li>
              <li>
                <Link to="/precos" className="hover:text-primary transition-colors">
                  Preços
                </Link>
              </li>
            </ul>
          </div>

          {/* Empresa */}
          <div>
            <h4 className="font-semibold mb-4">Empresa</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/privacidade" className="hover:text-primary transition-colors">
                  Privacidade (LGPD)
                </Link>
              </li>
              <li>
                <Link to="/termos" className="hover:text-primary transition-colors">
                  Termos de Uso
                </Link>
              </li>
            </ul>
          </div>

          {/* Contato */}
          <div>
            <h4 className="font-semibold mb-4">Fale conosco</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                contato@mindmed.online
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                <a href="https://wa.me/5511958890212" target="_blank" rel="noreferrer" className="hover:text-primary transition-colors">
                  (11) 95889-0212
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-8 pt-8 text-center text-sm text-muted-foreground">
          <p>© 2025 MindMed. Todos os direitos reservados.</p>
          <p className="mt-2">Conformidade LGPD by design</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
