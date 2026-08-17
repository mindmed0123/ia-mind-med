import { Link } from "react-router-dom";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const NotFound = () => {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 gradient-subtle">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 text-2xl font-bold mb-8">
          <Activity className="w-8 h-8 text-primary" />
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            MindMed
          </span>
        </Link>

        <Card className="shadow-large">
          <CardContent className="pt-6 text-center space-y-5">
            <div>
              <h1 className="text-2xl font-bold">Não encontramos esta página.</h1>
              <p className="text-muted-foreground mt-2">
                O link pode ter mudado de endereço. Estas são as páginas mais procuradas:
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button asChild className="w-full gradient-primary">
                <Link to="/">Entrar na plataforma</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link to="/precos">Ver planos</Link>
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <Link to="/medicos/teste-gratis">Começar o teste</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NotFound;
