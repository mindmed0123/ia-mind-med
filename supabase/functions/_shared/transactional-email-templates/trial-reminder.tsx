/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "MindMed"

interface TrialReminderProps {
  doctorName?: string
  daysLeft?: number
}

const benefits = [
  "🧠 Laudos ilimitados com IA avançada",
  "📋 Prescrições automáticas",
  "⚡ Embasamento teórico completo",
  "🛡️ Assinatura digital e carimbo",
  "✨ MindChat — assistente médico IA",
]

const TrialReminderEmail = ({ doctorName, daysLeft = 5 }: TrialReminderProps) => {
  const isUrgent = daysLeft <= 3
  const greeting = doctorName ? `Dr(a). ${doctorName}` : 'Doutor(a)'

  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>
        {daysLeft === 1
          ? `${greeting}, seu trial MindMed acaba hoje!`
          : `${greeting}, faltam ${daysLeft} dias para o fim do seu trial MindMed`}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={headerSection}>
            <Heading style={logo}>🧠 MindMed</Heading>
          </Section>

          <Section style={contentSection}>
            <Heading style={h1}>
              {daysLeft === 1
                ? "Último dia do seu trial!"
                : `Faltam ${daysLeft} dias para o fim do seu trial`}
            </Heading>

            <Text style={text}>
              Olá, {greeting}!
            </Text>

            <Text style={text}>
              {isUrgent
                ? "Seu período de avaliação está acabando. Não perca acesso às ferramentas que estão transformando sua prática clínica."
                : "Esperamos que esteja aproveitando o MindMed! Queremos garantir que você não perca acesso a todas as funcionalidades."}
            </Text>

            <Section style={benefitsBox}>
              <Heading style={h2}>✅ Benefícios do Plano Pro</Heading>
              {benefits.map((benefit) => (
                <Text key={benefit} style={benefitItem}>{benefit}</Text>
              ))}
            </Section>

            <Section style={priceBox}>
              <Text style={priceText}>R$ 299,00</Text>
              <Text style={priceSubtext}>por mês — cancele quando quiser</Text>
            </Section>

            <Section style={ctaSection}>
              <Button style={ctaButton} href="https://ia-mind-med.lovable.app/precos">
                Assinar o Plano Pro
              </Button>
            </Section>

            <Text style={footerText}>
              Se tiver dúvidas, responda este e-mail ou entre em contato pelo nosso suporte.
            </Text>
          </Section>

          <Hr style={hr} />

          <Text style={disclaimer}>
            © {new Date().getFullYear()} MindMed — Todos os direitos reservados
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: TrialReminderEmail,
  subject: (data: Record<string, any>) => {
    const days = data.daysLeft || 5
    return days === 1
      ? '⚠️ Último dia do seu trial MindMed!'
      : `Faltam ${days} dias para o fim do seu trial MindMed`
  },
  displayName: 'Lembrete de trial',
  previewData: { doctorName: 'Maria Silva', daysLeft: 3 },
} satisfies TemplateEntry

// Styles
const main = { backgroundColor: '#ffffff', fontFamily: "'Segoe UI', Arial, sans-serif" }
const container = { maxWidth: '580px', margin: '0 auto', padding: '0' }
const headerSection = {
  backgroundColor: 'hsl(220, 85%, 38%)',
  padding: '24px 32px',
  borderRadius: '12px 12px 0 0',
}
const logo = { color: '#ffffff', fontSize: '24px', fontWeight: 'bold' as const, margin: '0' }
const contentSection = { padding: '32px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: 'hsl(220, 20%, 15%)', margin: '0 0 20px' }
const h2 = { fontSize: '16px', fontWeight: '600' as const, color: 'hsl(220, 20%, 15%)', margin: '0 0 12px' }
const text = { fontSize: '15px', color: 'hsl(220, 15%, 45%)', lineHeight: '1.6', margin: '0 0 16px' }
const benefitsBox = {
  backgroundColor: '#f0f7ff',
  borderRadius: '8px',
  padding: '20px 24px',
  margin: '24px 0',
  borderLeft: '4px solid hsl(220, 85%, 38%)',
}
const benefitItem = { fontSize: '14px', color: 'hsl(220, 20%, 15%)', margin: '0 0 8px', lineHeight: '1.5' }
const priceBox = { textAlign: 'center' as const, margin: '24px 0' }
const priceText = { fontSize: '32px', fontWeight: 'bold' as const, color: 'hsl(220, 85%, 38%)', margin: '0' }
const priceSubtext = { fontSize: '13px', color: 'hsl(220, 15%, 45%)', margin: '4px 0 0' }
const ctaSection = { textAlign: 'center' as const, margin: '24px 0' }
const ctaButton = {
  backgroundColor: 'hsl(220, 85%, 38%)',
  color: '#ffffff',
  padding: '14px 32px',
  borderRadius: '8px',
  fontSize: '16px',
  fontWeight: '600' as const,
  textDecoration: 'none',
  display: 'inline-block' as const,
}
const footerText = { fontSize: '13px', color: 'hsl(220, 15%, 55%)', margin: '24px 0 0', lineHeight: '1.5' }
const hr = { borderColor: 'hsl(220, 15%, 88%)', margin: '24px 0' }
const disclaimer = { fontSize: '11px', color: 'hsl(220, 15%, 65%)', textAlign: 'center' as const, margin: '0' }
