# Modelos de documentação
- [x] Catálogo, modelos pessoais, preferência e regra por organização; nenhuma organização configurada.
- [x] Geração médica por modelo, sem inferência nos modelos documentais; auditoria por documento.
- [x] Seleção, construtor, revisão e formatação dos PDFs.
- [x] Remover assistente e arquivos/funções da frente retirada; farmacovigilância independente e preservada.
- [ ] Exclusão definitiva da estrutura antiga no banco: bloqueada pela permissão de migrações incompatíveis. Histórico SQL e tipos gerados mantêm referências; critério de zero ocorrências ainda não satisfeito.
- [x] Testes dos modelos e segurança; SOAP real, CRUD, revisão e PDF verificados; dados de teste removidos; geração CRP comparada byte a byte.
- [ ] Teste completo dos demais modelos, trava real de organização e timbrado/receituário: capacidade implementada, sem configuração de organizações; ainda não exercitados ponta a ponta.
- [x] Teste P1 de polling alinhado ao comportamento atual.
# Segurança — análise completa (35 itens)
- [x] Banco: funções administrativas, cota, fila de e-mail, contagem de membros, posse de clínica, vagas pagas, trial por metadado, pacientes de ex-membros
- [x] Funções: e-mail transacional, farmacovigilância, checkout/portal (origem e cliente), import-pdf/transcribe (links externos), lembretes de trial, agendamento, geração de laudo (assinatura), evolução (dono do paciente), convites
- [x] Remover dados pessoais dos registros internos (logs)
- [x] Marcar como resolvidos e rodar checagem (só resta o aviso do catálogo de especialidades, já ignorado de propósito)
# Teste geral antes dos anúncios
- [x] Páginas públicas, cadastro no celular, onboarding, rastreamento, planos
- [x] Erro de transcrição deixava a tela girando para sempre
- [x] Laudo por texto, vínculo de paciente, PDF, receita, páginas internas (computador e celular)
- [x] Consulta por áudio trocada para a IA do Lovable e testada; chave da OpenAI apagada
- [x] Apagar conta e dados de teste ao final
# Compra / Stripe
- [x] App confirma a assinatura direto no Stripe (volta do pagamento e antes de bloquear)
- [x] Aviso de pagamento do Stripe apontando para este app; código ajustado à versão atual do Stripe
- [x] Chave do destino novo confirmada com avisos reais (teste e cancelamento chegaram)
- [x] Teste de compra no celular até a página do Stripe e liberação do acesso
- [x] Aviso do plano Fundador corrigido (cobra na hora, sem teste grátis)
- [ ] Pagamento com cartão real: não feito para não cobrar; testado com assinatura de teste sem cartão
- [ ] Destino antigo "Lovable mind med" no Stripe aponta para o site: dono deve desativar
# Receituário, assinatura e responsabilidade (nov/2026)
- [x] Lista de remédios aparece ao clicar (CID vira prioridade, não filtro); dados conferidos com a base oficial da ANVISA; seleção preenche tudo e continua editável
- [x] Assinatura com certificado A1 (.pfx) no computador do médico em todo PDF baixado (laudo e receita); validação oficial no validar.iti.gov.br depende de um certificado ICP-Brasil real
- [x] Registro de cópias, downloads e assinaturas em nome do médico (trilha imutável)
- [x] Termo de adesão revisado: aceite assinado com nome completo, versão nova, registro com IP; página de Termos atualizada
# Laudo em PDF novo (nov/2026)
- [x] Layout novo com marca MindMed, cartão do paciente, sinais vitais, alergias, seções numeradas, assinatura e QR
- [x] PDF passa a trazer tudo que o laudo tem (antes faltavam exame físico, antecedentes, sinais vitais)
- [x] QR leva a uma página pública de verificação (antes dava página inexistente)
- [x] Abrir um laudo salvo não apaga mais os dados do paciente
