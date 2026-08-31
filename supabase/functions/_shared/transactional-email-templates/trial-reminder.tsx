/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { styles as s } from './_shared-styles.ts'
import { APP_URL } from './config.ts'

interface Props {
  firstName?: string
  doctorName?: string
  trialEndDate?: string
  planPrice?: string
  laudosCount?: number
}

const first = (p: Props) => {
  const raw = (p.firstName || p.doctorName || '').trim()
  return raw ? raw.split(/\s+/)[0] : ''
}

const Email = (props: Props) => {
  const n = first(props)
  const greet = n ? `Dr(a). ${n},` : 'Doutor(a),'
  const count = props.laudosCount ?? 0
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>O que acontece a partir de amanhã</Preview>
      <Body style={s.main}>
        <Container style={s.container}>
          <Section style={s.header}>
            <Heading style={s.logo}>MindMed</Heading>
            <Text style={s.logoSub}>Inteligência Artificial para Medicina</Text>
          </Section>
          <Section style={s.content}>
            <Heading style={s.h1}>Seu teste termina amanhã</Heading>
            <Text style={s.text}>{greet}</Text>
            <Text style={s.text}>
              Seu período de teste termina amanhã{props.trialEndDate ? `, ${props.trialEndDate}` : ''}.
            </Text>
            <Text style={s.text}>O que acontece:</Text>
            <ul style={s.list}>
              <li>Se você não fizer nada, a assinatura continua e a primeira cobrança{props.planPrice ? ` de ${props.planPrice}` : ''} acontece amanhã.</li>
              <li>Se quiser cancelar, são dois cliques dentro da plataforma. Nenhuma cobrança acontece.</li>
              <li>Se continuar e mudar de ideia depois, são 30 dias para pedir 100% de volta.</li>
            </ul>
            {count > 0 && (
              <Text style={s.text}>Nesta semana você gerou {count} {count === 1 ? 'documento' : 'documentos'} na plataforma.</Text>
            )}
            <Section style={s.ctaSection}>
              <Button style={s.ctaButton} href={`${APP_URL}/dashboard`}>Abrir a plataforma</Button>
            </Section>
            <Text style={s.text}>Se ficou faltando alguma coisa para você decidir, responda este e-mail. Eu leio todos.</Text>
            <Text style={s.signature}>Pedro Suassuna<br/>MindMed</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: 'Seu teste termina amanhã',
  displayName: 'Lembrete de trial — D+6',
  previewData: { firstName: 'Maria', trialEndDate: '15/06', planPrice: 'R$ 149,00', laudosCount: 4 },
} satisfies TemplateEntry
