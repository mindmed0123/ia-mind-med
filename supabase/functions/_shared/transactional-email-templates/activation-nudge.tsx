/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { styles as s } from './_shared-styles.ts'
import { APP_URL } from './config.ts'

interface Props { firstName?: string; daysRemaining?: number }

const Email = ({ firstName, daysRemaining = 12 }: Props) => {
  const greet = firstName ? `Dr(a). ${firstName}` : 'Doutor(a)'
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>Leva 40 segundos com o exemplo pronto. A maioria dos médicos fica surpresa com o resultado.</Preview>
      <Body style={s.main}>
        <Container style={s.container}>
          <Section style={s.header}>
            <Heading style={s.logo}>🧠 MindMed</Heading>
            <Text style={s.logoSub}>Inteligência Artificial para Medicina</Text>
          </Section>
          <Section style={s.content}>
            <Heading style={s.h1}>Seu primeiro laudo está esperando, {greet}</Heading>
            <Text style={s.text}>Você criou a conta mas ainda não gerou nenhum laudo. Leva 40 segundos com o exemplo que já deixamos pronto — não precisa de paciente nem de gravação.</Text>
            <Text style={s.text}>É só abrir a MindMed: o caso de exemplo já está preenchido e a IA monta o laudo completo na hora.</Text>
            <Text style={s.text}><strong>É simples assim:</strong></Text>
            <ol style={s.list}>
              <li>Abra a MindMed e clique em "Fazer agora" no bloco "Comece por aqui"</li>
              <li>O caso de exemplo já vem pronto — ou cole o resumo de uma consulta sua</li>
              <li>A IA estrutura o laudo automaticamente</li>
              <li>Você revisa e assina</li>
            </ol>
            <Text style={s.text}>Sem configurar nada. Sem curva de aprendizado.</Text>
            <Section style={s.ctaSection}>
              <Button style={s.ctaButton} href={`${APP_URL}`}>Gerar o laudo de exemplo →</Button>
            </Section>
            <Text style={s.text}>Se tiver qualquer dúvida, responda este email. Estou aqui.</Text>
            <Text style={s.signature}>Abraço,<br/><strong>Equipe MindMed</strong></Text>
            <Text style={s.small}>Você tem {daysRemaining} dias de trial gratuito restantes.</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Seu primeiro laudo está esperando, Dr(a). ${d.firstName || 'Doutor(a)'}`,
  displayName: 'Ativação — D+2 sem laudo',
  previewData: { firstName: 'Maria', daysRemaining: 12 },
} satisfies TemplateEntry
