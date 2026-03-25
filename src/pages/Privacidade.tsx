import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const Privacidade = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-20 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">Política de Privacidade</h1>
        <p className="text-sm text-muted-foreground mb-8">Última atualização: 25 de março de 2026</p>

        <div className="prose prose-lg max-w-none space-y-6 text-muted-foreground">
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">1. Introdução</h2>
            <p>A MindMed está comprometida com a proteção dos dados pessoais e sensíveis dos seus usuários e de seus pacientes, em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">2. Dados Coletados</h2>
            <p>Coletamos os seguintes tipos de dados:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li><strong className="text-foreground">Dados do profissional:</strong> nome, email, CRM, UF, especialidade, telefone</li>
              <li><strong className="text-foreground">Dados clínicos dos pacientes:</strong> nome, dados demográficos, histórico clínico, transcrições de consultas (processados mediante consentimento expresso)</li>
              <li><strong className="text-foreground">Dados de uso:</strong> logs de acesso, interações com a plataforma, métricas de produtividade</li>
              <li><strong className="text-foreground">Dados de áudio:</strong> gravações de consultas para transcrição (armazenadas temporariamente e excluídas após processamento)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">3. Finalidade do Tratamento</h2>
            <p>Os dados são tratados exclusivamente para:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Prestação dos serviços contratados (transcrição, geração de laudos)</li>
              <li>Melhoria contínua dos algoritmos de IA</li>
              <li>Comunicações relacionadas ao serviço</li>
              <li>Cumprimento de obrigações legais e regulatórias</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">4. Base Legal</h2>
            <p>O tratamento de dados pessoais é realizado com base em:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li><strong className="text-foreground">Consentimento:</strong> obtido expressamente do profissional e, por intermédio dele, dos pacientes</li>
              <li><strong className="text-foreground">Execução de contrato:</strong> necessário para a prestação dos serviços</li>
              <li><strong className="text-foreground">Tutela da saúde:</strong> para dados sensíveis de saúde, conforme Art. 11, II, f da LGPD</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">5. Segurança dos Dados</h2>
            <p>Implementamos medidas técnicas e organizacionais rigorosas:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Criptografia AES-256 em trânsito (TLS 1.3) e em repouso</li>
              <li>Isolamento de dados por usuário (Row-Level Security)</li>
              <li>Logs de auditoria imutáveis para todas as operações</li>
              <li>Backups automáticos com retenção configurável</li>
              <li>Controle de acesso baseado em funções (RBAC)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">6. Compartilhamento de Dados</h2>
            <p>Não vendemos, alugamos ou compartilhamos dados pessoais com terceiros para fins comerciais. Dados podem ser compartilhados apenas com:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Provedores de infraestrutura (hosting, banco de dados) sob contratos de confidencialidade</li>
              <li>Autoridades públicas quando exigido por lei</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">7. Direitos do Titular</h2>
            <p>Conforme a LGPD, você tem direito a:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Confirmação e acesso aos seus dados</li>
              <li>Correção de dados incompletos ou desatualizados</li>
              <li>Anonimização, bloqueio ou eliminação de dados desnecessários</li>
              <li>Portabilidade dos dados a outro fornecedor</li>
              <li>Revogação do consentimento a qualquer momento</li>
              <li>Eliminação dos dados pessoais tratados com base no consentimento</li>
            </ul>
            <p className="mt-2">Para exercer qualquer desses direitos, entre em contato pelo email: <a href="mailto:privacidade@mindmed.com.br" className="text-primary hover:underline">privacidade@mindmed.com.br</a></p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">8. Retenção de Dados</h2>
            <p>Os dados são mantidos pelo tempo necessário para a prestação dos serviços e cumprimento de obrigações legais. Após o encerramento da conta, os dados são eliminados em até 30 dias, exceto quando a retenção for exigida por lei.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">9. Cookies e Tecnologias</h2>
            <p>Utilizamos cookies essenciais para o funcionamento da plataforma (autenticação e sessão). Não utilizamos cookies de rastreamento ou publicidade.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">10. Encarregado de Dados (DPO)</h2>
            <p>Para questões relacionadas à proteção de dados, entre em contato com nosso Encarregado de Dados pelo email: <a href="mailto:dpo@mindmed.com.br" className="text-primary hover:underline">dpo@mindmed.com.br</a></p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">11. Alterações nesta Política</h2>
            <p>Esta Política de Privacidade pode ser atualizada periodicamente. Alterações significativas serão comunicadas por email e pela plataforma.</p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Privacidade;
