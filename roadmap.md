# Modelos de documentação
- [x] Catálogo, modelos pessoais, preferência e regra por organização; nenhuma organização configurada.
- [x] Geração médica por modelo, sem inferência nos modelos documentais; auditoria por documento.
- [x] Seleção, construtor, revisão e formatação dos PDFs.
- [x] Remover assistente e arquivos/funções da frente retirada; farmacovigilância independente e preservada.
- [ ] Exclusão definitiva da estrutura antiga no banco: bloqueada pela permissão de migrações incompatíveis. Histórico SQL e tipos gerados mantêm referências; critério de zero ocorrências ainda não satisfeito.
- [x] Testes dos modelos e segurança; SOAP real, CRUD, revisão e PDF verificados; dados de teste removidos; geração CRP comparada byte a byte.
- [ ] Teste completo dos demais modelos, trava real de organização e timbrado/receituário: capacidade implementada, sem configuração de organizações; ainda não exercitados ponta a ponta.
- [ ] Teste P1 pré-existente tem expectativa de polling divergente do comportamento atual; não alterado por ser fora do escopo.
# Segurança — análise completa (35 itens)
- [x] Banco: funções administrativas, cota, fila de e-mail, contagem de membros, posse de clínica, vagas pagas, trial por metadado, pacientes de ex-membros
- [x] Funções: e-mail transacional, farmacovigilância, checkout/portal (origem e cliente), import-pdf/transcribe (links externos), lembretes de trial, agendamento, geração de laudo (assinatura), evolução (dono do paciente), convites
- [x] Remover dados pessoais dos registros internos (logs)
- [x] Marcar como resolvidos e rodar checagem (só resta o aviso do catálogo de especialidades, já ignorado de propósito)
