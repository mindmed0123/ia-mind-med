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
      <Preview>Você pode retomar exatamente de onde parou.</Preview>
      <Body style={s.main}>
        <Container style={s.container}>
          <Section style={s.header}>
            <Heading style={s.logo}>🧠 MindMed</Heading>
            <Text style={s.logoSub}>Inteligência Artificial para Medicina</Text>
          </Section>
          <Section style={s.content}>
            <Heading style={s.h1}>{greet}, sua conta MindMed ainda existe</Heading>
            <Text style={s.text}>Seu trial gratuito encerrou há 3 dias, mas sua conta ainda está aqui — com tudo que você configurou.</Text>
            <Text style={s.text}>Muitos médicos voltam depois de sentir falta da produtividade. A burocracia do prontuário manual volta rápido, e a diferença fica evidente.</Text>
            <Text style={s.text}><strong>Para retomar, é só assinar o plano:</strong></Text>
            <ul style={s.list}>
              <li><strong>Starter — R$ 149/mês:</strong> ideal para quem faz até 30 consultas/mês</li>
              <li><strong>Pro — R$ 299/mês:</strong> consultas ilimitadas + prescrição automática</li>
            </ul>
            <Text style={s.text}>Sem nova configuração. Seus dados e templates continuam salvos.</Text>
            <Section style={s.ctaSection}>
              <Button style={s.ctaButton} href="https://acesso.mindmed.online/#planos">Reativar minha conta →</Button>
            </Section>
            <Text style={s.text}>Se preferir conversar antes de decidir, estou aqui — é só responder.</Text>
            <Text style={s.signature}>Abraço,<br/><strong>Equipe MindMed</strong></Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Dr(a). ${d.firstName || 'Doutor(a)'}, sua conta MindMed ainda existe`,
  displayName: 'Winback — D+3 pós-trial',
  previewData: { firstName: 'Maria' },
} satisfies TemplateEntry
