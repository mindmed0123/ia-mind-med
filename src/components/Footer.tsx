import { Link } from "react-router-dom";
import { Mail, Phone, MapPin, Linkedin, Instagram, Youtube } from "lucide-react";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container-custom px-4 py-8 sm:py-12 md:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 md:gap-12">
          {/* Brand */}
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-secondary flex items-center justify-center shadow-glow">
                <span className="text-lg sm:text-2xl font-bold text-secondary-foreground">M</span>
              </div>
              <span className="text-base sm:text-xl font-bold">MindManage</span>
            </div>
            <p className="text-xs sm:text-sm text-primary-foreground/80">
              Transforme papelada em faturamento. IA médica que automatiza laudos e
              transcrições para você focar no que realmente importa.
            </p>
            <div className="flex gap-3 sm:gap-4">
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary-light flex items-center justify-center hover:bg-secondary transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-5 h-5" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary-light flex items-center justify-center hover:bg-secondary transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary-light flex items-center justify-center hover:bg-secondary transition-colors"
                aria-label="YouTube"
              >
                <Youtube className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Produto */}
          <div>
            <h3 className="font-semibold text-base sm:text-lg mb-3 sm:mb-4">Produto</h3>
            <ul className="space-y-2 sm:space-y-3">
              <li>
                <Link
                  to="/produto"
                  className="text-xs sm:text-sm text-primary-foreground/80 hover:text-secondary transition-colors"
                >
                  Recursos
                </Link>
              </li>
              <li>
                <Link
                  to="/produto#transcricao"
                  className="text-xs sm:text-sm text-primary-foreground/80 hover:text-secondary transition-colors"
                >
                  Transcrição Médica
                </Link>
              </li>
              <li>
                <Link
                  to="/produto#laudos"
                  className="text-xs sm:text-sm text-primary-foreground/80 hover:text-secondary transition-colors"
                >
                  Geração de Laudos
                </Link>
              </li>
              <li>
                <Link
                  to="/produto#integracao"
                  className="text-xs sm:text-sm text-primary-foreground/80 hover:text-secondary transition-colors"
                >
                  Integrações
                </Link>
              </li>
            </ul>
          </div>

          {/* Soluções */}
          <div>
            <h3 className="font-semibold text-base sm:text-lg mb-3 sm:mb-4">Informações</h3>
            <ul className="space-y-2 sm:space-y-3">
              <li>
                <Link
                  to="/precos"
                  className="text-xs sm:text-sm text-primary-foreground/80 hover:text-secondary transition-colors"
                >
                  Preços
                </Link>
              </li>
              <li>
                <Link
                  to="/contato"
                  className="text-xs sm:text-sm text-primary-foreground/80 hover:text-secondary transition-colors"
                >
                  Contato
                </Link>
              </li>
              <li>
                <Link
                  to="/dashboard"
                  className="text-xs sm:text-sm text-primary-foreground/80 hover:text-secondary transition-colors"
                >
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Contato */}
          <div>
            <h3 className="font-semibold text-base sm:text-lg mb-3 sm:mb-4">Contato</h3>
            <ul className="space-y-2 sm:space-y-3">
              <li className="flex items-start gap-2">
                <Mail className="w-4 h-4 sm:w-5 sm:h-5 mt-0.5 text-secondary flex-shrink-0" />
                <a
                  href="mailto:contato@mindmanage.com.br"
                  className="text-xs sm:text-sm text-primary-foreground/80 hover:text-secondary transition-colors break-all"
                >
                  contato@mindmanage.com.br
                </a>
              </li>
              <li className="flex items-start gap-2">
                <Phone className="w-4 h-4 sm:w-5 sm:h-5 mt-0.5 text-secondary flex-shrink-0" />
                <a
                  href="tel:+5511999999999"
                  className="text-xs sm:text-sm text-primary-foreground/80 hover:text-secondary transition-colors"
                >
                  (11) 99999-9999
                </a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 sm:w-5 sm:h-5 mt-0.5 text-secondary flex-shrink-0" />
                <span className="text-xs sm:text-sm text-primary-foreground/80">
                  São Paulo, SP - Brasil
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-primary-light">
          <div className="flex flex-col md:flex-row justify-between items-center gap-3 sm:gap-4 text-center md:text-left">
            <p className="text-xs sm:text-sm text-primary-foreground/60">
              © {currentYear} MindManage. Todos os direitos reservados.
            </p>
            <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
              <Link
                to="/termos"
                className="text-xs sm:text-sm text-primary-foreground/60 hover:text-secondary transition-colors"
              >
                Termos de Uso
              </Link>
              <Link
                to="/privacidade"
                className="text-xs sm:text-sm text-primary-foreground/60 hover:text-secondary transition-colors"
              >
                Política de Privacidade
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
