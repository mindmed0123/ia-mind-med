# Sistema de Farmacovigilância — MindMed

Fluxo: médico clica em **"Alertar Farmacovigilância"** (ficha do paciente ou receituário) → wizard multi-etapas → Edge Function envia email para a farmacêutica com cópia para o médico. **Nenhum relato é salvo** — apenas a tabela `farmaceuticas` fica no banco.

## 1. Banco de dados

**Migration:**
- Tabela `public.farmaceuticas` (`id`, `nome`, `email_farmacovigilancia`, `telefone`, `ativo`, `created_at`) + GRANTs + RLS.
  - SELECT: `authenticated` (apenas `ativo = true`, via policy).
  - INSERT/UPDATE/DELETE: apenas `has_role(auth.uid(), 'admin')`.
- Seed: Eurofarma, EMS, Aché, Hypera, Medley, Neo Química, Cimed, Sandoz, Cristália, União Química (emails placeholder editáveis pelo admin, ex.: `farmacovigilancia@eurofarma.com.br`).

## 2. Botão "Alertar Farmacovigilância"

Novo componente `FarmacovigilanciaButton.tsx` (ShieldAlert âmbar, `variant="outline"`), integrado em:
- **Ficha do paciente** (`src/pages/HistoricoPaciente.tsx` / `PatientClinicalProfile.tsx`) — pré-preenche paciente.
- **Receituário** (`src/pages/Receituarios.tsx` e/ou `PrescriptionTab.tsx`) — pré-preenche medicamento (nome/apresentação/dose) + paciente se vinculado.

Navega para `/farmacovigilancia/novo` passando dados via `location.state`.

## 3. Wizard multi-etapas (`/farmacovigilancia/novo`)

Página nova `src/pages/FarmacovigilanciaNovo.tsx` + componentes em `src/components/farmacovigilancia/`:
- `Stepper.tsx` (visual das 6 etapas)
- `Step1Relator.tsx` — pré-preenche do perfil do médico (nome, email, CRM, UF)
- `Step2Paciente.tsx` — iniciais/nome, sexo, gestação condicional, DN, peso, altura
- `Step3Produto.tsx` — Select de farmacêutica (busca via `farmaceuticas`), produto, lote/validade, via, posologia, datas
- `Step4Historico.tsx` — doenças (lista dinâmica) + outros medicamentos (lista dinâmica)
- `Step5Evento.tsx` — descrição, tipo (categorias ANVISA), causa, datas, recuperação, tratamento, outros eventos, gravidade
- `Step6Revisao.tsx` — resumo + consentimento LGPD + aviso VigiMed + botão enviar

Stack: `react-hook-form` + `zod` (schema por etapa), shadcn/ui.
Guard de saída: `beforeunload` + confirm no `navigate` interceptado.

Registro da rota em `src/App.tsx` sob `SubscriptionGuard`.

## 4. Edge Function `send-farmacovigilancia`

`supabase/functions/send-farmacovigilancia/index.ts` (`verify_jwt = true`):
1. Valida JWT, obtém `user`.
2. Zod valida payload completo.
3. Rate limit: 10 envios/h por `user.id` (in-memory map na função, best-effort).
4. Busca `farmaceuticas.email_farmacovigilancia` pelo `farmaceutica_id` (via service role).
5. Gera protocolo `FV-YYYYMMDD-XXXX` (não persiste).
6. Renderiza HTML profissional com todas as seções.
7. Envia via infra de email existente (`enqueue_email` RPC → fila `transactional_emails`) — cria template novo `farmacovigilancia-notificacao` em `_shared/transactional-email-templates/` e registra em `registry.ts`. `To` = farmacêutica, `Cc` = médico, subject `[Farmacovigilância] Notificação de Evento Adverso — {produto} — Protocolo {protocolo}`.
8. Retorna `{ success, protocolo }`.

`supabase/config.toml`: adiciona bloco `[functions.send-farmacovigilancia] verify_jwt = true`.

## 5. Pós-envio + Admin

- Tela de sucesso com protocolo destacado, botões "Nova notificação" / "Voltar".
- Toast de erro mantém dados no form.
- **CRUD Admin** em `src/pages/Admin.tsx` — nova aba "Farmacêuticas" (`AdminFarmaceuticasTab.tsx`) com listar/criar/editar/inativar. Acesso via `useAdminRole`.

## Detalhes técnicos

- Cc no template: o template `enqueue_email` atual não suporta `cc` nativamente. Solução: enviar 2 emails separados (um para farmacêutica, um para médico) com mesmo `idempotencyKey`-base + sufixo, garantindo a cópia. Alternativa mais limpa: adicionar suporte `cc` ao `send-transactional-email` — porém isso mexe em infra compartilhada. **Vou pelo caminho de 2 envios** (menor blast radius).
- Categorias ANVISA e opções via constantes em `src/lib/farmacovigilancia-constants.ts`.
- i18n: tudo em pt-BR. Design tokens existentes (âmbar via `text-amber-*` já usado no projeto).

## Arquivos novos (resumo)
- Migration `farmaceuticas` + seed
- `supabase/functions/send-farmacovigilancia/index.ts`
- `supabase/functions/_shared/transactional-email-templates/farmacovigilancia-notificacao.tsx` (+ registro)
- `src/pages/FarmacovigilanciaNovo.tsx`
- `src/pages/FarmacovigilanciaSucesso.tsx` (ou state interno)
- `src/components/farmacovigilancia/*` (Stepper + 6 steps + Button)
- `src/components/admin/AdminFarmaceuticasTab.tsx`
- `src/lib/farmacovigilancia-constants.ts`
- Edits: `App.tsx`, `Admin.tsx`, `HistoricoPaciente.tsx`, `PatientClinicalProfile.tsx`, `Receituarios.tsx`, `PrescriptionTab.tsx`, `config.toml`

Confirma que posso seguir?
