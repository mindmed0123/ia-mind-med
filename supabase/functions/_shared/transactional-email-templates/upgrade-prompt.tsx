/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { styles as s } from './_shared-styles.ts'

interface Props { firstName?: string }

const Email = ({ firstName }: Props) => {
  const greet = firstName ? `Dr(a). ${firstName}` : 'Doutor(a)'
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>Prescrição automática, relatórios expandidos e consultas ilimitadas.</Preview>
      <Body style={s.main}>
        <Container style={s.container}>
          <Section style={s.header}>
            <Heading style={s.logo}>🧠 MindMed</Heading>
            <Text style={s.logoSub}>Inteligência Artificial para Medicina</Text>
          </Section>
          <Section style={s.content}>
            <Heading style={s.h1}>{greet}, você está usando bem a MindMed — mas tem mais</Heading>
            <Text style={s.text}>Você está há 30 dias usando a MindMed e gerando laudos com consistência. Isso é ótimo.</Text>
            <Text style={s.text}><strong>Mas tem recursos no plano Pro que você ainda não está aproveitando:</strong></Text>
            <ul style={s.list}>
              <li>📝 <strong>Prescrição e receituário automatizados</strong> — gerado junto com o laudo, sem digitar</li>
              <li>📊 <strong>Relatórios evolutivos expandidos</strong> — histórico do paciente com mais profundidade</li>
              <li>♾️ <strong>Consultas ilimitadas</strong> — sem limite mensal</li>
              <li>⚡ <strong>Fluxo premium para múltiplos atendimentos</strong> — para dias de agenda cheia</li>
            </ul>
            <Text style={s.text}>O Pro custa <strong>R$ 299/mês</strong> — R$ 150 a mais que seu plano atual. Se você usa a MindMed em 30 consultas por mês, são R$ 5 extras por consulta para ter prescrição automática junto com o laudo.</Text>
            <Section style={s.ctaSection}>
              <Button style={s.ctaButton} href="https://acesso.mindmed.online/precos">Fazer upgrade para o Pro →</Button>
            </Section>
            <Text style={s.text}>Se quiser, responda este email e te explico em detalhe como a prescrição automática funciona na prática.</Text>
            <Text style={s.signature}>Abraço,<br/><strong>Equipe MindMed</strong></Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Dr(a). ${d.firstName || 'Doutor(a)'}, você está usando bem a MindMed — mas tem mais`,
  displayName: 'Upgrade Starter → Pro',
  previewData: { firstName: 'Maria' },
} satisfies TemplateEntry
