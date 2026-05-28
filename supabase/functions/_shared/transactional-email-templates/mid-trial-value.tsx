/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { styles as s } from './_shared-styles.ts'

interface Props { firstName?: string; daysRemaining?: number }

const Email = ({ firstName, daysRemaining = 7 }: Props) => {
  const greet = firstName ? `Dr(a). ${firstName}` : 'Doutor(a)'
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>A metade do seu trial passou. O que acontece nos próximos 7 dias define tudo.</Preview>
      <Body style={s.main}>
        <Container style={s.container}>
          <Section style={s.header}>
            <Heading style={s.logo}>🧠 MindMed</Heading>
            <Text style={s.logoSub}>Inteligência Artificial para Medicina</Text>
          </Section>
          <Section style={s.content}>
            <Heading style={s.h1}>7 dias de trial, {greet} — veja o que você já tem</Heading>
            <Text style={s.text}>Você está na metade do seu trial de 14 dias.</Text>
            <Text style={s.text}>Médicos que chegam até aqui e continuam usando a MindMed relatam, em média:</Text>
            <ul style={s.list}>
              <li>⏱ <strong>40 a 90 minutos salvos por dia</strong> em documentação</li>
              <li>📋 <strong>Laudos mais completos</strong> com CID, conduta e anamnese estruturada</li>
              <li>🧠 <strong>Mais presença na consulta</strong> — sem anotar enquanto o paciente fala</li>
            </ul>
            <Text style={s.text}>Nos próximos 7 dias, você ainda tem tempo de:</Text>
            <ol style={s.list}>
              <li>Testar em diferentes tipos de consulta (retorno, urgência, especialidade)</li>
              <li>Personalizar o template do laudo para o seu estilo</li>
              <li>Decidir se quer continuar — sem pressa</li>
            </ol>
            <Text style={s.text}>O plano Starter custa <strong>R$ 149/mês</strong>. Se você faz 30 consultas por mês, isso é menos de R$ 5 por consulta — e você economiza em média 1 hora por dia.</Text>
            <Section style={s.ctaSection}>
              <Button style={s.ctaButton} href="https://acesso.mindmed.online">Continuar usando a MindMed →</Button>
            </Section>
            <Text style={s.text}>Se tiver alguma dúvida antes de decidir, é só responder este email.</Text>
            <Text style={s.signature}>Abraço,<br/><strong>Equipe MindMed</strong></Text>
            <Text style={s.small}>Seu trial encerra em {daysRemaining} dias. Nenhuma cobrança antes disso.</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `7 dias de trial, Dr(a). ${d.firstName || 'Doutor(a)'} — veja o que você já tem`,
  displayName: 'Meio do trial — D+7',
  previewData: { firstName: 'Maria', daysRemaining: 7 },
} satisfies TemplateEntry
