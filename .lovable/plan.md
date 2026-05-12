# Módulo de Telemedicina MindMed

Implementação completa de teleconsulta por vídeo, com conformidade CFM 2.314/2022 e LGPD, integrada ao fluxo atual (laudos, agendamentos, pacientes, assinaturas).

## Etapa 1 — Banco de dados (migration)

- **Enum** `teleconsulta_status`: agendada, sala_aberta, em_andamento, concluida, cancelada, nao_compareceu
- **Tabela `teleconsultas`**: organização, médico, paciente (snapshot + FK opcional), sala Daily.co (room_name, room_url, doctor_token, patient_token), status, timing, consentimentos médico/paciente (com IP), notas, transcript, vínculo a laudo
- **Tabela `teleconsulta_events`**: log de eventos (joined, left, muted, etc.)
- **Tabela `teleconsulta_messages`**: chat em tempo real (médico/paciente)
- **RLS**: membros da org gerenciam tudo; paciente acessa via token + status público (`sala_aberta`/`em_andamento`)
- **Trigger** `updated_at`
- Índices para org, médico, status, scheduled_at

## Etapa 2 — Edge Functions (Deno)

1. **`create-teleconsulta`** — cria sala no Daily.co (com fallback mock se sem API key), gera tokens médico/paciente, persiste registro, retorna link do paciente
2. **`send-teleconsulta-link`** — usa `send-transactional-email` existente para enviar e-mail premium ao paciente (template registrado)
3. **`finalize-teleconsulta`** — atualiza status, calcula duração, opcionalmente dispara `generate-laudo` com as notas

## Etapa 3 — Tipos + Hook

- `src/types/teleconsulta.ts` (interfaces, labels, cores de status)
- `src/hooks/useTeleconsultas.ts` (load + realtime por organização + updateStatus + cancelar)

## Etapa 4 — Componentes

- `NovaTeleconsultaModal` — wizard 2 passos (dados + consentimento) com link copiável + QR Code (lib `qrcode` já instalada)
- `TeleconsultaCard` — card por status com ações contextuais
- `ConsentTermoTelemedicina` — termo LGPD/CFM com scroll obrigatório
- `VideoRoom` — iframe Daily.co prebuilt + painel lateral (notas, chat, prescrição) + cronômetro + badge AO VIVO
- `WaitingRoom` (dentro de SalaPaciente) — sala de espera mobile-first
- `TelemedicinaDashboard` — métricas + tabs (Hoje/Próximas/Concluídas/Todas) + busca

## Etapa 5 — Páginas + Rotas

- `/telemedicina` (protegida + feature flag) → `Telemedicina.tsx`
- `/consulta/:id` (protegida) → `SalaTelemedicina.tsx` (médico)
- `/sala/:id` (PÚBLICA, sem SubscriptionGuard) → `SalaPaciente.tsx`

## Etapa 6 — Integrações

- `useFeatureAccess.ts` → adicionar `"telemedicina"` ao `FeatureKey`
- `Dashboard.tsx` → botão "Telemedicina" em Ações Rápidas com badge de consultas do dia
- `Navbar.tsx` → adicionar item após "Agendamentos" (porém Navbar atual é da landing — confirmar se deve ser no header do Dashboard, é o mais consistente)
- `AppointmentModal.tsx` → toggle "É teleconsulta?" + criação opcional da sala
- `DayView.tsx` / `WeekView.tsx` → ícone de vídeo nos eventos teleconsulta
- `Admin.tsx` (ou `AdminFeatureAccess`) → toggle de feature `telemedicina` por usuário

## Etapa 7 — Secrets

- Solicitar via `secrets--add_secret`: `DAILY_API_KEY` e `PUBLIC_APP_URL`
- Edge function tem fallback mock se `DAILY_API_KEY` ausente (modo dev)

## Conformidade CFM/LGPD

- Consentimento duplo (médico + paciente com IP) registrado no banco
- CPF + nome obrigatórios antes de iniciar
- Notas obrigatórias ao encerrar
- Badge "CFM 2.314/2022" visível
- Aviso de 180 dias para crônicos
- Sala privada Daily.co com expiração 24h, max 2 participantes, gravação cloud opcional

## Notas técnicas

- A migration cria FKs para `auth.users` (created_by) e `profiles`/`organizations`/`appointments`/`patients`/`laudos` (todos já existem)
- Realtime habilitado para `teleconsultas` via `ALTER PUBLICATION supabase_realtime ADD TABLE`
- Política pública do paciente é restrita a `status IN ('sala_aberta','em_andamento')` — token Daily.co garante acesso à sala em si
- A pasta `Navbar.tsx` é da landing (links /produto, /precos); a navegação real do app está no header do Dashboard — adicionarei lá

## Confirmações antes de executar

1. **Daily.co**: ok configurar `DAILY_API_KEY` agora (vou pedir via secret) ou começar em modo mock e configurar depois?
2. **Volume**: implemento tudo em um único turno (vai ser grande, 15-20 arquivos novos) ou prefere dividir em fases (Etapa 1+2+3 primeiro, depois 4+5+6)?
3. **Email do paciente**: usar template React Email registrado no sistema transacional (recomendado, padrão MindMed) em vez do HTML inline do prompt — ok?
