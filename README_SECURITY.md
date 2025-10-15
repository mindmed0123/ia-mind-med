# 🔒 Guia de Segurança - MindMed

## ✅ Implementações de Segurança

### 1. **Sanitização de Inputs (XSS Prevention)**
- ✅ DOMPurify integrado para sanitização de HTML
- ✅ Validação de todos os inputs de usuário
- ✅ Escape automático em JSX (React nativo)
- ✅ Sanitização de URLs para prevenir javascript: attacks

### 2. **Validações**
- ✅ CRM: 4-8 dígitos numéricos
- ✅ UF: 2 letras maiúsculas (lista de UFs válidas)
- ✅ Email: regex + limite de 255 caracteres
- ✅ Telefone: 10-11 dígitos
- ✅ Arquivos: tipo + tamanho (máx 5MB para imagens)
- ✅ Nomes de pacientes: 3-200 caracteres
- ✅ Medicamentos: 2-200 caracteres

### 3. **Rate Limiting**
- ✅ Client-side: 10 requisições/minuto por recurso
- ✅ Edge Functions: proteção contra spam
- ⚠️ **TODO**: Implementar Redis para rate limiting distribuído em produção

### 4. **Row-Level Security (RLS)**
- ✅ Todas as tabelas com RLS habilitado
- ✅ Políticas por operação (SELECT, INSERT, UPDATE, DELETE)
- ✅ Usuários só acessam seus próprios dados
- ✅ Audit logs imutáveis
- ✅ Consent logs imutáveis (LGPD)

### 5. **Autenticação**
- ✅ Supabase Auth com JWT
- ✅ Tokens auto-refresh
- ✅ Session persistence segura
- ⚠️ **AVISO**: Leaked Password Protection desabilitado (habilitar em produção)

### 6. **LGPD Compliance**
- ✅ Consentimento obrigatório para áudio
- ✅ Log de consentimentos com IP e user agent
- ✅ Dados criptografados em trânsito e repouso
- ✅ Direito ao esquecimento (delete cascade)
- ✅ Termos de Uso e Política de Privacidade versionados

### 7. **Armazenamento Seguro**
- ✅ Uploads para Supabase Storage privado
- ✅ URLs assinadas com expiração
- ✅ Validação de tipo e tamanho de arquivo
- ✅ Organização por user_id

### 8. **Edge Functions**
- ✅ JWT verification habilitado (exceto webhooks públicos)
- ✅ Validação de user_id em todas as operações
- ✅ CORS configurado
- ✅ Error handling sem exposição de dados sensíveis
- ✅ Logs estruturados para auditoria

### 9. **Testes**
- ✅ Vitest configurado
- ✅ Testes de validação
- ✅ Testes de sanitização
- ✅ Coverage reports habilitados

## 🚨 Avisos de Segurança

### CRÍTICO - Antes de Produção:

1. **Habilitar Leaked Password Protection**
   ```sql
   -- Via Supabase Dashboard > Authentication > Policies
   -- Ou configurar via API
   ```

2. **Configurar CSP Headers no servidor**
   - Use `src/lib/security-headers.ts` como referência
   - Configure no Vercel/Netlify/servidor

3. **Rate Limiting Distribuído**
   - Implementar Redis para rate limiting
   - Configurar Supabase Edge Functions rate limits

4. **Monitoramento**
   - Configurar alertas para tentativas de ataque
   - Monitorar audit_logs e consent_logs
   - Configurar Sentry/LogRocket para erros

5. **Backup e Recuperação**
   - Configurar backups automáticos do Supabase
   - Testar procedimento de recuperação

## 🧪 Executar Testes

```bash
# Rodar todos os testes
npm run test

# Com coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## 📋 Checklist de Deploy

- [ ] Habilitar Leaked Password Protection
- [ ] Configurar CSP headers
- [ ] Revisar todas as políticas RLS
- [ ] Configurar rate limiting em produção
- [ ] Configurar monitoramento e alertas
- [ ] Testar fluxo completo em staging
- [ ] Backup configurado
- [ ] Documentar credenciais de emergência

## 📚 Recursos

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/platform/going-into-prod)
- [React Security Checklist](https://docs.lovable.dev/features/security)
