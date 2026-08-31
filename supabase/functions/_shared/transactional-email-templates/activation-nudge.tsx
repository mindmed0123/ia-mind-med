/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { styles as s } from './_shared-styles.ts'
import { APP_URL } from './config.ts'

interface Props { firstName?: string; doctorName?: string; daysRemaining?: number }

const first = (p: Props) => {
  const raw = (p.firstName || p.doctorName || '').trim()
  return raw ? raw.split(/\s+/)[0] : ''
}

const Email = (props: Props) => {
  const n = first(props)
  const greet = n ? `Dr(a). ${n},` : 'Doutor(a),'
  const days = props.daysRemaining
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>O exemplo já está pronto — é só clicar</Preview>
      <Body style={s.main}>
        <Container style={s.container}>
          <Section style={s.header}>
            <Heading style={s.logo}>MindMed</Heading>
            <Text style={s.logoSub}>Inteligência Artificial para Medicina</Text>
          </Section>
          <Section style={s.content}>
            <Heading style={s.h1}>{n ? `Sobra um minuto hoje, Dr(a). ${n}?` : 'Sobra um minuto hoje?'}</Heading>
            <Text style={s.text}>{greet}</Text>
            <Text style={s.text}>Você criou a conta ontem mas ainda não gerou nenhum laudo. Imagino que o dia tenha sido cheio.</Text>
            <Text style={s.text}>Se sobrar um minuto: deixamos um resumo de consulta já preenchido na plataforma. Você clica e vê o laudo sendo montado, com queixa, história, exame físico, hipótese e conduta.</Text>
            <Text style={s.text}>Não precisa de gravação. Não precisa de paciente. Não precisa preparar nada.</Text>
            <Section style={s.ctaSection}>
              <Button style={s.ctaButton} href={`${APP_URL}/dashboard?onboarding=laudo-demo`}>Gerar meu primeiro laudo</Button>
            </Section>
            <Text style={s.text}>Se preferir testar com um caso seu, tem um campo para colar o resumo de uma consulta que você já atendeu. O resultado costuma impressionar mais.</Text>
            {typeof days === 'number' && <Text style={s.text}>Faltam {days} dias de teste.</Text>}
            <Text style={s.signature}>Pedro Suassuna<br/>MindMed</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => {
    const n = first(d as Props)
    return n ? `Sobra um minuto hoje, Dr(a). ${n}?` : 'Sobra um minuto hoje?'
  },
  displayName: 'Ativação — D+1 sem laudo',
  previewData: { firstName: 'Maria', daysRemaining: 6 },
} satisfies TemplateEntry
