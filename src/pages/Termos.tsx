import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const Termos = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-20 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">Termos de Uso</h1>
        <p className="text-sm text-muted-foreground mb-8">Última atualização: 25 de março de 2026</p>

        <div className="prose prose-lg max-w-none space-y-6 text-muted-foreground">
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">1. Aceitação dos Termos</h2>
            <p>Ao acessar e utilizar a plataforma MindMed, você concorda integralmente com estes Termos de Uso. Se você não concorda com qualquer parte destes termos, não deve utilizar nossos serviços.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">2. Descrição do Serviço</h2>
            <p>A MindMed é uma plataforma de inteligência artificial voltada para profissionais de saúde que oferece:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Transcrição automatizada de consultas médicas</li>
              <li>Geração de laudos e relatórios clínicos estruturados</li>
              <li>Sugestões diagnósticas baseadas em IA</li>
              <li>Gestão de pacientes e prescrições</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">3. Responsabilidade Clínica</h2>
            <p><strong className="text-foreground">A MindMed é uma ferramenta de apoio à decisão clínica.</strong> Todas as informações geradas pela IA devem ser revisadas e validadas pelo profissional de saúde responsável antes de qualquer uso clínico. A responsabilidade final por diagnósticos, prescrições e condutas médicas é exclusivamente do profissional habilitado.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">4. Cadastro e Conta</h2>
            <p>Para utilizar a plataforma, você deve:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Ser profissional de saúde devidamente registrado no respectivo conselho de classe</li>
              <li>Fornecer informações verdadeiras e atualizadas (incluindo CRM e UF)</li>
              <li>Manter a confidencialidade de suas credenciais de acesso</li>
              <li>Notificar imediatamente sobre qualquer uso não autorizado</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">5. Planos e Pagamentos</h2>
            <p>Os planos são cobrados mensalmente conforme a modalidade escolhida. A MindMed reserva-se o direito de alterar preços com aviso prévio de 30 dias. Cancelamentos podem ser realizados a qualquer momento, com efeito ao final do período já pago.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">6. Propriedade Intelectual</h2>
            <p>Todo o conteúdo da plataforma, incluindo software, algoritmos, design e marca, é propriedade da MindMed. Os laudos e documentos gerados a partir dos dados do profissional são de propriedade do respectivo profissional.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">7. Limitação de Responsabilidade</h2>
            <p>A MindMed não se responsabiliza por danos diretos, indiretos, incidentais ou consequenciais decorrentes do uso da plataforma. O serviço é fornecido "como está", sem garantias expressas ou implícitas de precisão absoluta.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">8. Modificações dos Termos</h2>
            <p>A MindMed pode atualizar estes Termos a qualquer momento. Alterações significativas serão comunicadas por email. O uso continuado da plataforma após as alterações constitui aceitação dos novos termos.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">9. Foro e Legislação</h2>
            <p>Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca de São Paulo/SP para dirimir quaisquer questões.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">10. Contato</h2>
            <p>Para dúvidas sobre estes Termos, entre em contato pelo email: <a href="mailto:contato@mindmed.com.br" className="text-primary hover:underline">contato@mindmed.com.br</a></p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Termos;
