/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  protocolo: string;
  dataEnvio: string;
  farmaceuticaNome: string;
  relato: any;
  isCopiaMedico?: boolean;
}

const line = (label: string, value: any) => {
  if (value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) return null;
  const shown = Array.isArray(value) ? value.join(', ') : String(value);
  return (
    <Text style={row} key={label}>
      <span style={rowLabel}>{label}: </span><span style={rowValue}>{shown}</span>
    </Text>
  );
};

const Email = ({ protocolo, dataEnvio, farmaceuticaNome, relato, isCopiaMedico }: Props) => {
  const r = relato?.relator ?? {};
  const p = relato?.paciente ?? {};
  const prod = relato?.produto ?? {};
  const hist = relato?.historico ?? {};
  const ev = relato?.evento ?? {};

  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>Notificação de Farmacovigilância — Protocolo {protocolo}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={h1}>Notificação de Farmacovigilância</Heading>
            <Text style={subtitle}>via MindMed — Plataforma Médica</Text>
          </Section>

          <Section style={content}>
            {isCopiaMedico && (
              <Section style={infoBox}>
                <Text style={infoText}>Esta é uma <b>cópia</b> da notificação enviada à farmacêutica <b>{farmaceuticaNome}</b>. Guarde o protocolo para referência.</Text>
              </Section>
            )}

            <Section style={metaBox}>
              {line('Protocolo', protocolo)}
              {line('Farmacêutica destinatária', farmaceuticaNome)}
              {line('Data/hora do envio', dataEnvio)}
            </Section>

            <Heading style={h2}>1. Relator</Heading>
            {line('Nome', r.nome)}
            {line('E-mail', r.email)}
            {line('Telefone', r.telefone)}
            {line('Profissão', r.profissao)}
            {line('CRM / UF', [r.crm, r.uf].filter(Boolean).join(' / '))}
            {line('Instituição', r.vinculo_instituicao === 'Sim' ? r.instituicao_nome : 'Não vinculado')}
            <Hr style={hr} />

            <Heading style={h2}>2. Paciente</Heading>
            {line('Identificação', p.identificacao)}
            {line('Sexo', p.sexo)}
            {line('Gestante', p.gestante)}
            {line('DUM', p.dum)}
            {line('Semanas gestacionais', p.semanas_gestacionais)}
            {line('Data de nascimento', p.data_nascimento)}
            {line('Peso (kg)', p.peso)}
            {line('Altura (cm)', p.altura)}
            <Hr style={hr} />

            <Heading style={h2}>3. Produto</Heading>
            {line('Produto', prod.produto)}
            {line('Lote', [prod.lote_numero, prod.lote_validade && `val. ${prod.lote_validade}`].filter(Boolean).join(' / '))}
            {line('Indicação', prod.indicacao)}
            {line('Via de administração', prod.via)}
            {line('Posologia', prod.posologia)}
            {line('Início', prod.data_inicio)}
            {line('Término', prod.em_uso ? 'Em uso' : prod.data_termino)}
            <Hr style={hr} />

            <Heading style={h2}>4. Histórico clínico</Heading>
            {line('Possui doenças', hist.tem_doencas)}
            {(hist.doencas ?? []).map((d: any, i: number) => line(`  Doença ${i + 1}`, `${d.nome}${d.data_diagnostico ? ` (${d.data_diagnostico})` : ''}`))}
            {line('Usa outros medicamentos', hist.usa_outros_meds)}
            {(hist.outros_meds ?? []).map((m: any, i: number) =>
              line(`  Medicamento ${i + 1}`,
                [m.nome, m.indicacao && `indic.: ${m.indicacao}`, m.dose_diaria && `dose: ${m.dose_diaria}`, m.data_inicio && `início: ${m.data_inicio}`, m.data_termino && `término: ${m.data_termino}`].filter(Boolean).join(' — ')
              )
            )}
            <Hr style={hr} />

            <Heading style={h2}>5. Evento Adverso</Heading>
            {line('Descrição', ev.descricao)}
            {line('Eventos', ev.eventos)}
            {line('Tipo de notificação', ev.tipo_notificacao)}
            {line('Possível causa', ev.causa)}
            {line('Início do evento', ev.data_inicio)}
            {line('Recuperou', ev.recuperou)}
            {line('Data da recuperação', ev.data_recuperacao)}
            {line('Tratado', ev.tratado === 'Sim' ? `Sim — ${ev.tratamento_desc || ''}` : ev.tratado)}
            {line('Outros eventos', ev.outros_eventos_tem)}
            {(ev.outros_eventos ?? []).map((o: any, i: number) =>
              line(`  Evento ${i + 1}`,
                [o.evento, o.data_inicio && `início: ${o.data_inicio}`, o.continua && `continua: ${o.continua}`, o.data_termino && `término: ${o.data_termino}`].filter(Boolean).join(' — ')
              )
            )}
            {line('Suspendeu uso', ev.suspendeu)}
            {line('Gravidade', ev.gravidade === 'Grave' ? `Grave — ${(ev.criterios_gravidade ?? []).join(', ')}` : ev.gravidade)}

            <Hr style={hr} />
            <Text style={consent}>
              O relator autorizou que a equipe de farmacovigilância entre em contato para acompanhamento deste caso, conforme a LGPD.
            </Text>
          </Section>

          <Hr style={hr} />
          <Text style={disclaimer}>
            Este relato foi gerado e enviado pela plataforma MindMed a pedido do profissional de saúde relator. Este e-mail não substitui a notificação obrigatória à ANVISA via VigiMed.
          </Text>
          <Text style={footer}>© {new Date().getFullYear()} MindMed</Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: Email,
  subject: (d: any) => `[Farmacovigilância] Notificação de Evento Adverso — ${d?.relato?.produto?.produto || 'Medicamento'} — Protocolo ${d?.protocolo}`,
  displayName: 'Farmacovigilância — Notificação',
  previewData: {
    protocolo: 'FV-20260715-A1B2',
    dataEnvio: '15/07/2026 14:30',
    farmaceuticaNome: 'Eurofarma',
    relato: {
      relator: { nome: 'Dr. João Silva', email: 'joao@exemplo.com', crm: '123456', uf: 'SP', profissao: 'Médico(a)', vinculo_instituicao: 'Não' },
      paciente: { identificacao: 'M.S.', sexo: 'Feminino', data_nascimento: '1980-05-10' },
      produto: { produto: 'Losartana 50mg', via: 'Oral', posologia: '1 comp. ao dia', data_inicio: '2026-06-01', em_uso: true },
      historico: { tem_doencas: 'Sim', doencas: [{ nome: 'Hipertensão', data_diagnostico: '2020-01-01' }], usa_outros_meds: 'Não' },
      evento: { descricao: 'Paciente apresentou tosse seca persistente após início do tratamento.', eventos: 'tosse seca', tipo_notificacao: 'Suspeita de reação adversa', causa: 'Uso do medicamento', data_inicio: '2026-06-15', recuperou: 'Em recuperação', tratado: 'Não', outros_eventos_tem: 'Não', suspendeu: 'Sim', gravidade: 'Não grave' },
    },
  },
} satisfies TemplateEntry;

const main = { backgroundColor: '#ffffff', fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif" };
const container = { maxWidth: '640px', margin: '0 auto', padding: '20px 0' };
const header = { background: 'linear-gradient(135deg, hsl(30, 90%, 45%) 0%, hsl(0, 75%, 50%) 100%)', padding: '28px 32px', borderRadius: '12px 12px 0 0', textAlign: 'center' as const };
const h1 = { color: '#ffffff', fontSize: '22px', margin: '0', fontWeight: 700 as const };
const subtitle = { color: 'rgba(255,255,255,0.9)', fontSize: '13px', margin: '4px 0 0' };
const content = { padding: '28px 32px', backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderTop: 'none', borderRadius: '0 0 12px 12px' };
const infoBox = { backgroundColor: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '12px 16px', borderRadius: '6px', margin: '0 0 20px' };
const infoText = { fontSize: '13px', color: '#1e3a8a', margin: 0, lineHeight: 1.5 };
const metaBox = { backgroundColor: '#f8fafc', padding: '14px 18px', borderRadius: '8px', margin: '0 0 20px', border: '1px solid #e5e7eb' };
const h2 = { fontSize: '15px', fontWeight: 700 as const, color: 'hsl(220, 20%, 15%)', margin: '18px 0 8px', letterSpacing: '-0.2px' };
const row = { fontSize: '13px', color: '#111827', margin: '2px 0', lineHeight: 1.55 };
const rowLabel = { color: '#6b7280', marginRight: '4px' };
const rowValue = { color: '#111827', fontWeight: 500 as const };
const hr = { borderColor: '#e5e7eb', margin: '14px 0' };
const consent = { fontSize: '12px', color: '#4b5563', fontStyle: 'italic' as const, margin: '10px 0 0' };
const disclaimer = { fontSize: '11px', color: '#6b7280', textAlign: 'center' as const, padding: '0 32px', margin: '10px 0' };
const footer = { fontSize: '11px', color: '#9ca3af', textAlign: 'center' as const, margin: '4px 0 12px' };
