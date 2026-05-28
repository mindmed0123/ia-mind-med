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
      <Preview>Era para ser diferente.</Preview>
      <Body style={s.main}>
        <Container style={s.container}>
          <Section style={s.header}>
            <Heading style={s.logo}>🧠 MindMed</Heading>
            <Text style={s.logoSub}>Inteligência Artificial para Medicina</Text>
          </Section>
          <Section style={s.content}>
            <Heading style={s.h1}>Quanto tempo você gastou documentando essa semana?</Heading>
            <Text style={s.text}>Olá, {greet}.</Text>
            <Text style={s.text}>Faz duas semanas desde que seu trial MindMed encerrou.</Text>
            <Text style={s.text}>Nesse tempo, você provavelmente voltou a preencher prontuário manualmente — digitando, anotando, revisando. São, em média, 30 a 60 minutos por dia que poderiam estar com o paciente. Ou com você.</Text>
            <Text style={s.text}>A MindMed ainda está aqui, quando você quiser voltar.</Text>
            <Text style={s.text}>Starter: <strong>R$ 149/mês</strong> · Pro: <strong>R$ 299/mês</strong> · Cancele quando quiser.</Text>
            <Section style={s.ctaSection}>
              <Button style={s.ctaButton} href="https://acesso.mindmed.online/#planos">Quero voltar a economizar tempo →</Button>
            </Section>
            <Text style={s.signature}>Abraço,<br/><strong>Equipe MindMed</strong></Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: () => 'Quanto tempo você gastou documentando essa semana?',
  displayName: 'Winback — D+15 pós-trial',
  previewData: { firstName: 'Maria' },
} satisfies TemplateEntry
