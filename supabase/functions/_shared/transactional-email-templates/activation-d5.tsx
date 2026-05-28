/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { styles as s } from './_shared-styles.ts'

interface Props { firstName?: string; daysRemaining?: number }

const Email = ({ firstName, daysRemaining = 9 }: Props) => {
  const greet = firstName ? `Dr(a). ${firstName}` : 'Doutor(a)'
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>Muitos médicos travam no mesmo ponto. Veja como superar.</Preview>
      <Body style={s.main}>
        <Container style={s.container}>
          <Section style={s.header}>
            <Heading style={s.logo}>🧠 MindMed</Heading>
            <Text style={s.logoSub}>Inteligência Artificial para Medicina</Text>
          </Section>
          <Section style={s.content}>
            <Heading style={s.h1}>{greet}, posso te ajudar a começar</Heading>
            <Text style={s.text}>Você está no 5º dia do seu trial e ainda não gerou o primeiro laudo. Isso acontece com mais médicos do que você imagina — normalmente por um desses motivos:</Text>
            <ul style={s.list}>
              <li>A agenda não abriu espaço ainda</li>
              <li>Ficou com dúvida sobre como funciona na prática</li>
              <li>Não quis testar com um paciente real sem ter certeza do resultado</li>
            </ul>
            <Text style={s.text}>Tudo faz sentido. Então deixa eu te mostrar o caminho mais rápido:</Text>
            <Text style={s.text}><strong>Opção 1 — Teste com um caso fictício agora:</strong><br/>Abra a MindMed, fale como se estivesse atendendo (pode inventar um caso clínico qualquer) e veja o laudo gerado. Zero risco, zero pressão.</Text>
            <Text style={s.text}><strong>Opção 2 — Fale comigo pelo WhatsApp:</strong><br/>Se quiser, posso fazer um onboarding de 5 minutos com você ao vivo. <Link href="https://wa.me/5511958890212">Clique aqui para conversar agora →</Link></Text>
            <Section style={s.ctaSection}>
              <Button style={s.ctaButton} href="https://acesso.mindmed.online">Entrar na MindMed →</Button>
            </Section>
            <Text style={s.text}>Você tem {daysRemaining} dias ainda. Dá tempo de sobra.</Text>
            <Text style={s.signature}>Abraço,<br/><strong>Equipe MindMed</strong></Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Dr(a). ${d.firstName || 'Doutor(a)'}, você ainda tem ${d.daysRemaining || 9} dias — posso te ajudar a começar`,
  displayName: 'Ativação — D+5 sem laudo',
  previewData: { firstName: 'Maria', daysRemaining: 9 },
} satisfies TemplateEntry
