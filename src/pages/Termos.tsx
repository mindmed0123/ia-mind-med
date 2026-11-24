import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { TERMO_SECOES, TERMO_VERSAO } from "@/lib/termo-adesao";

const EXTRAS: { titulo: string; texto: string[] }[] = [
  {
    titulo: "7. Propriedade intelectual",
    texto: [
      "O software, a marca e o design do MindMed pertencem à MindMed. Os documentos gerados a partir dos seus dados são seus.",
    ],
  },
  {
    titulo: "8. Limitação de responsabilidade",
    texto: [
      "O MindMed é fornecido como ferramenta de apoio à documentação. A MindMed não responde por decisões clínicas, diagnósticos, prescrições ou condutas, que são de responsabilidade exclusiva do profissional, nem por documentos usados sem a revisão do profissional.",
    ],
  },
  {
    titulo: "9. Mudanças neste termo",
    texto: [
      "Quando este termo mudar, você será avisado e precisará assiná-lo de novo no próximo acesso para continuar usando o MindMed.",
    ],
  },
  {
    titulo: "10. Foro e legislação",
    texto: [
      "Este termo segue as leis do Brasil. Fica eleito o foro da comarca de São Paulo/SP.",
    ],
  },
];

const Termos = () => {
  const [ano, mes, dia] = TERMO_VERSAO.split("-");
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-20 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">Termos de Uso e Responsabilidade Profissional</h1>
        <p className="text-sm text-muted-foreground mb-8">Versão de {dia}/{mes}/{ano}</p>

        <div className="prose prose-lg max-w-none space-y-6 text-muted-foreground">
          {[...TERMO_SECOES, ...EXTRAS].map((s) => (
            <section key={s.titulo}>
              <h2 className="text-2xl font-semibold text-foreground mb-3">{s.titulo}</h2>
              {s.texto.map((t, i) => (
                <p key={i} className="mt-2">{t}</p>
              ))}
            </section>
          ))}
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">11. Contato</h2>
            <p>
              Dúvidas sobre este termo ou sobre seus dados:{" "}
              <a href="mailto:contato@mindmed.com.br" className="text-primary hover:underline">contato@mindmed.com.br</a>
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Termos;
