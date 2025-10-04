# MindMed - Sistema de Laudos Médicos com IA

## 📋 Visão Geral

Sistema completo de geração, edição e gerenciamento de laudos médicos com:
- ✅ Editor rich-text com autosave
- ✅ Exportação para PDF com verificação
- ✅ Importação de PDFs externos
- ✅ Conformidade com LGPD
- ✅ Auditoria completa

---

## 🚀 Como Usar

### 1. Novo Laudo

1. Faça login no sistema
2. No Dashboard, grave um áudio ou faça upload de um arquivo
3. O sistema transcreve automaticamente e gera o laudo
4. Edite as informações no painel lateral
5. O laudo é gerado automaticamente após transcrição

### 2. Editar Laudo

1. Acesse **Novo Laudo** > Aba "Editar"
2. Preencha as 7 seções obrigatórias:
   - Identificação do Paciente
   - Queixa Principal
   - HDA (História da Doença Atual)
   - Exame Físico
   - Hipóteses Diagnósticas (Principal* e Diferencial)
   - Conduta/Plano* (obrigatório)
   - CID-10 (opcional)

3. **Autosave:** Salva automaticamente a cada 5 segundos
4. **Validação:** Campos obrigatórios são destacados
5. **Finalizar:** Marque como "Concluído" quando terminar

### 3. Exportar PDF

**Requisitos:**
- Hipótese Principal preenchida
- Conduta/Plano preenchido
- Status: Finalizado

**Como exportar:**
1. Clique em "Exportar PDF"
2. O sistema gera PDF com:
   - Layout profissional A4
   - Hash SHA-256 de verificação
   - QR Code para autenticação
   - Assinatura do médico
3. PDF é baixado automaticamente
4. Ação registrada em auditoria

**Verificação:**
- Escaneie o QR Code no rodapé do PDF
- Ou acesse a URL de verificação manualmente
- Validação pública (sem dados sensíveis)

### 4. Importar PDF

1. Clique em "Importar PDF"
2. Selecione um arquivo PDF (máx 10MB)
3. O sistema extrai texto automaticamente
4. Seções são mapeadas por heurística
5. Revise e ajuste o conteúdo extraído

**Fallback:**
- Se extração falhar, cole manualmente
- OCR opcional para PDFs escaneados

### 5. Anonimizar Laudo

Para pesquisas ou estatísticas:
1. Abra o laudo finalizado
2. Clique em "Anonimizar"
3. Confirme a ação (irreversível)
4. Nome do paciente → Código anônimo (PAC-XXXXXXXX)
5. Registro em auditoria

---

## ⚙️ Variáveis de Ambiente

Crie um arquivo `.env.example` com:

```bash
# Supabase (já configurado via Lovable Cloud)
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua_chave_publica
VITE_SUPABASE_PROJECT_ID=seu_projeto_id

# PDF e Verificação
PDF_VERIFY_JWT_SECRET=sua_secret_key_segura
PDF_QR_BASE_URL=https://app.mindmed.com.br/api/reports

# Retenção de Dados (LGPD)
REPORT_RETENTION_DAYS=365

# Storage
STORAGE_BUCKET=mindmed-prod
STORAGE_REGION=sa-east-1

# OCR (Opcional)
ENABLE_OCR=true

# Monitoramento
SENTRY_DSN=seu_sentry_dsn
```

---

## 🔧 Troubleshooting

### Problema: PDF não gera

**Possíveis causas:**
- Campos obrigatórios não preenchidos
- Laudo não finalizado
- Erro no navegador (console logs)

**Solução:**
1. Verifique campos obrigatórios (marcados em vermelho)
2. Marque laudo como "Concluído"
3. Teste na página `/debug/pdf`

### Problema: Importação de PDF falha

**Possíveis causas:**
- Arquivo muito grande (>10MB)
- PDF corrompido ou protegido
- OCR desabilitado para PDFs escaneados

**Solução:**
1. Reduza tamanho do PDF
2. Habilite `ENABLE_OCR=true`
3. Use entrada manual como fallback
4. Teste na página `/debug/ocr`

### Problema: Storage não funciona

**Solução:**
1. Verifique configuração do bucket Supabase
2. Teste em `/debug/storage`
3. Verifique políticas RLS do bucket

### Problema: Erros de autenticação

**Solução:**
1. Limpe localStorage e cookies
2. Faça logout/login
3. Verifique token JWT não expirado
4. Consulte logs de auditoria

---

## 📊 Páginas de Diagnóstico

### `/debug/pdf` - Teste de Geração PDF
- Preview de HTML antes de converter
- Teste de renderização
- Verificação de layout A4

### `/debug/ocr` - Teste de Extração
- Upload de PDF de teste
- Simulação de extração de texto
- Verificação de mapeamento de seções

### `/debug/storage` - Teste de Storage
- Teste de escrita S3
- Teste de leitura S3
- Limpeza de arquivos temporários
- Verificação de URLs assinadas

---

## 🔒 LGPD e Segurança

### Consentimento
- Modal automático no primeiro acesso
- 3 consentimentos obrigatórios:
  1. Processamento de dados médicos
  2. Exportação e verificação pública
  3. Armazenamento com retenção

### Auditoria
Todas as ações são registradas em `audit_logs`:
- CREATE, UPDATE, EXPORT, IMPORT, ANONYMIZE
- Timestamp, user_id, diff de mudanças
- Acessível apenas ao próprio usuário

### Anonimização
- Irreversível
- Gera código único PAC-XXXXXXXX
- Mantém estrutura clínica
- Adequado para pesquisas

### Retenção de Dados
- Padrão: 365 dias (configurável)
- Exclusão automática ou manual
- Políticas RLS garantem isolamento por usuário

---

## 🛠️ Desenvolvimento

### Estrutura de Arquivos

```
src/
├── components/
│   ├── laudos/
│   │   ├── LaudoEditor.tsx       # Editor principal
│   │   ├── LaudoViewer.tsx       # Visualização
│   │   ├── AnonymizeDialog.tsx   # Anonimização
│   │   └── PatientDataForm.tsx   # Formulário paciente
│   └── consent/
│       └── LgpdConsent.tsx        # Modal LGPD
├── lib/
│   └── pdf-generator.ts           # Geração de PDF
├── pages/
│   ├── Dashboard.tsx
│   ├── NovoLaudo.tsx
│   └── debug/                     # Páginas de diagnóstico
│       ├── PdfTest.tsx
│       ├── OcrTest.tsx
│       └── StorageTest.tsx
└── supabase/
    └── functions/
        ├── export-pdf/            # Gera dados do PDF
        ├── import-pdf/            # Importa e extrai texto
        └── verify-pdf/            # Verificação pública
```

### Banco de Dados

**Tabelas:**
- `laudos` - Armazena laudos e seções
- `audit_logs` - Registros de auditoria
- `profiles` - Perfis de usuários/médicos

**Campos importantes em `laudos`:**
- `sections` (JSONB) - Seções estruturadas do laudo
- `diagnosis_main/diff` - Hipóteses principais/diferenciais
- `pdf_hash` - Hash SHA-256 para verificação
- `pdf_verify_token` - Token JWT (90 dias)
- `status` - draft | completed

### Edge Functions

**export-pdf:**
- Valida campos obrigatórios
- Gera hash SHA-256
- Cria token JWT
- Retorna HTML formatado
- Registra auditoria

**import-pdf:**
- Faz download do PDF
- Extrai texto (com OCR opcional)
- Mapeia seções por heurística
- Atualiza banco
- Registra auditoria

**verify-pdf:**
- Endpoint público (sem auth)
- Valida token e hash
- Retorna HTML de verificação
- Exibe dados do médico (não sensíveis)

---

## 📝 Testes E2E

### Editor
- [ ] Autosave funciona (5s)
- [ ] Campos obrigatórios validados
- [ ] Finalização bloqueia edição
- [ ] Contagem de palavras atualiza

### Exportar PDF
- [ ] Bloqueio sem campos obrigatórios
- [ ] PDF gerado com QR code
- [ ] Verificação pública funciona
- [ ] Download automático
- [ ] Log EXPORT criado

### Importar PDF
- [ ] Upload PDF nativo → seções corretas
- [ ] OCR extrai texto de scans
- [ ] Confirmação antes de sobrescrever
- [ ] Log IMPORT criado

### LGPD
- [ ] Modal aparece no primeiro acesso
- [ ] Não permite exportar sem consentimento
- [ ] Anonimização irreversível
- [ ] Audit trail visível

### Resiliência
- [ ] Timeout OCR com fallback
- [ ] Erro PDF mostra mensagem clara
- [ ] Storage retry automático

---

## 📦 Deploy

O sistema é implantado automaticamente via Lovable Cloud.

**Edge Functions são deployadas automaticamente** quando você faz alterações.

**Verificar deploy:**
1. Acesse o Dashboard Supabase
2. Verifique Functions ativas
3. Teste endpoints manualmente
4. Monitore logs de erros

---

## 📞 Suporte

- **Email:** contato@mindmed.com.br
- **Documentação:** https://docs.mindmed.com.br
- **Status:** https://status.mindmed.com.br

---

## 📄 Licença

© 2025 MindMed - Todos os direitos reservados

Sistema em conformidade com:
- LGPD (Lei 13.709/2018)
- Resolução CFM nº 1.821/2007 (Prontuário Médico)
- Marco Civil da Internet