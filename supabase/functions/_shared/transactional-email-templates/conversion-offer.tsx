/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { styles as s } from './_shared-styles.ts'

interface Props { firstName?: string; daysRemaining?: number; trialEndDate?: string }

const Email = ({ firstName, daysRemaining = 3, trialEndDate }: Props) => {
  const greet = firstName ? `Dr(a). ${firstName}` : 'Doutor(a)'
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>R$ 149/mês. Menos que uma consulta. Sem fidelidade.</Preview>
      <Body style={s.main}>
        <Container style={s.container}>
          <Section style={s.header}>
            <Heading style={s.logo}>🧠 MindMed</Heading>
            <Text style={s.logoSub}>Inteligência Artificial para Medicina</Text>
          </Section>
          <Section style={s.content}>
            <Heading style={s.h1}>{greet}, seu trial acaba em {daysRemaining} dias — aqui está sua oferta</Heading>
            <Text style={s.text}>Faltam <strong>{daysRemaining} dias</strong> para o fim do seu trial gratuito.</Text>
            <Text style={s.text}>Aqui está o que você ganha ao continuar com a MindMed:</Text>
            <table style={{ width: '100%', borderCollapse: 'collapse', margin: '24px 0' }}>
              <thead>
                <tr style={{ background: '#f3f4f6' }}>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Plano</th>
                  <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Preço</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Para quem</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}><strong>Starter</strong></td>
                  <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}><strong>R$ 149/mês</strong></td>
                  <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>Até 30 consultas/mês · Transcrição · Laudo · CID</td>
                </tr>
                <tr style={{ background: '#f0f7ff' }}>
                  <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}><strong>Pro ⭐</strong></td>
                  <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}><strong>R$ 299/mês</strong></td>
                  <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>Consultas ilimitadas · Prescrição automática · Relatórios expandidos</td>
                </tr>
              </tbody>
            </table>
            <Text style={s.text}>Sem fidelidade. Sem multa de cancelamento. Você pode cancelar com um clique quando quiser.</Text>
            <Section style={s.ctaSection}>
              <Button style={s.ctaButton} href="https://acesso.mindmed.online/#planos">Escolher meu plano →</Button>
            </Section>
            <Text style={s.text}>Se ainda tiver dúvidas sobre qual plano faz mais sentido para a sua realidade, responda este email com o número de consultas que você faz por mês. Eu te ajudo a escolher.</Text>
            <Text style={s.signature}>Abraço,<br/><strong>Equipe MindMed</strong></Text>
            {trialEndDate && <Text style={s.small}>Sua conta continua ativa até {trialEndDate}. Nenhuma cobrança antes disso.</Text>}
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Dr(a). ${d.firstName || 'Doutor(a)'}, seu trial acaba em ${d.daysRemaining || 3} dias — aqui está sua oferta`,
  displayName: 'Oferta conversão — D+11',
  previewData: { firstName: 'Maria', daysRemaining: 3, trialEndDate: '15/06/2026' },
} satisfies TemplateEntry
