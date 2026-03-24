/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "MindMed"

interface TrialReminderProps {
  doctorName?: string
  daysLeft?: number
}

const benefits = [
  "🧠 Laudos ilimitados com IA avançada",
  "📋 Prescrições automáticas inteligentes",
  "⚡ Embasamento teórico completo e CID-10",
  "🛡️ Assinatura digital e carimbo no PDF",
  "✨ MindChat — assistente médico com IA",
  "📊 Relatórios de evolução do paciente",
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
            <Text style={logoSubtext}>Inteligência Artificial para Medicina</Text>
          </Section>

          <Section style={contentSection}>
            {isUrgent && (
              <Section style={urgentBanner}>
                <Text style={urgentText}>
                  ⚠️ {daysLeft === 1 ? 'ÚLTIMO DIA' : `FALTAM ${daysLeft} DIAS`} — Seu acesso expira em breve
                </Text>
              </Section>
            )}

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
              <Text style={priceLabel}>Plano Pro</Text>
              <Text style={priceText}>R$ 299,00</Text>
              <Text style={priceSubtext}>por mês — cancele quando quiser</Text>
            </Section>

            <Section style={ctaSection}>
              <Button style={ctaButton} href="https://ia-mind-med.lovable.app/precos">
                Assinar o Plano Pro
              </Button>
            </Section>

            <Section style={guaranteeBox}>
              <Text style={guaranteeText}>
                🛡️ Garantia de satisfação: cancele a qualquer momento, sem burocracia.
              </Text>
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
const main = { backgroundColor: '#f8fafc', fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif" }
const container = { maxWidth: '580px', margin: '0 auto', padding: '20px 0', backgroundColor: '#ffffff', borderRadius: '16px', overflow: 'hidden' as const, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }
const headerSection = {
  background: 'linear-gradient(135deg, hsl(220, 85%, 38%) 0%, hsl(190, 85%, 45%) 100%)',
  padding: '32px 40px',
  textAlign: 'center' as const,
}
const logo = { color: '#ffffff', fontSize: '28px', fontWeight: 'bold' as const, margin: '0', letterSpacing: '-0.5px' }
const logoSubtext = { color: 'rgba(255,255,255,0.85)', fontSize: '13px', margin: '4px 0 0', fontWeight: '400' as const }
const contentSection = { padding: '40px 40px 32px' }
const urgentBanner = {
  backgroundColor: '#fef2f2',
  borderRadius: '10px',
  padding: '12px 20px',
  margin: '0 0 24px',
  borderLeft: '4px solid #ef4444',
}
const urgentText = { fontSize: '14px', fontWeight: '700' as const, color: '#dc2626', margin: '0' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: 'hsl(220, 20%, 15%)', margin: '0 0 20px', letterSpacing: '-0.3px' }
const h2 = { fontSize: '16px', fontWeight: '600' as const, color: 'hsl(220, 20%, 15%)', margin: '0 0 14px' }
const text = { fontSize: '15px', color: 'hsl(220, 15%, 40%)', lineHeight: '1.7', margin: '0 0 18px' }
const benefitsBox = {
  backgroundColor: '#f0f7ff',
  borderRadius: '10px',
  padding: '24px 28px',
  margin: '28px 0',
  borderLeft: '4px solid hsl(220, 85%, 38%)',
}
const benefitItem = { fontSize: '14px', color: 'hsl(220, 20%, 15%)', margin: '0 0 10px', lineHeight: '1.5' }
const priceBox = { textAlign: 'center' as const, margin: '28px 0', padding: '24px', backgroundColor: '#f8fafc', borderRadius: '12px' }
const priceLabel = { fontSize: '13px', fontWeight: '600' as const, color: 'hsl(220, 15%, 45%)', margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '1px' }
const priceText = { fontSize: '40px', fontWeight: 'bold' as const, color: 'hsl(220, 85%, 38%)', margin: '0', lineHeight: '1.1' }
const priceSubtext = { fontSize: '13px', color: 'hsl(220, 15%, 45%)', margin: '6px 0 0' }
const ctaSection = { textAlign: 'center' as const, margin: '28px 0' }
const ctaButton = {
  background: 'linear-gradient(135deg, hsl(220, 85%, 38%) 0%, hsl(190, 85%, 45%) 100%)',
  color: '#ffffff',
  padding: '18px 48px',
  borderRadius: '10px',
  fontSize: '17px',
  fontWeight: '700' as const,
  textDecoration: 'none',
  display: 'inline-block' as const,
  boxShadow: '0 4px 14px rgba(30, 64, 175, 0.25)',
}
const guaranteeBox = {
  backgroundColor: '#f0fdf4',
  borderRadius: '10px',
  padding: '14px 20px',
  margin: '0 0 24px',
  borderLeft: '4px solid #22c55e',
}
const guaranteeText = { fontSize: '13px', color: '#166534', margin: '0', lineHeight: '1.6' }
const footerText = { fontSize: '13px', color: 'hsl(220, 15%, 55%)', margin: '0', lineHeight: '1.6' }
const hr = { borderColor: 'hsl(220, 15%, 92%)', margin: '0 40px' }
const disclaimer = { fontSize: '11px', color: 'hsl(220, 15%, 65%)', textAlign: 'center' as const, margin: '16px 40px', lineHeight: '1.5' }
