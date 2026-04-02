/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "MindMed"

interface UpgradeConfirmedProps {
  doctorName?: string
  planName?: string
}

const UpgradeConfirmedEmail = ({ doctorName, planName = 'Pro' }: UpgradeConfirmedProps) => {
  const greeting = doctorName ? `Dr(a). ${doctorName}` : 'Doutor(a)'

  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>Assinatura MindMed {planName} confirmada! Acesso ilimitado ativado 🚀</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={headerSection}>
            <Heading style={logo}>🧠 MindMed</Heading>
            <Text style={logoSubtext}>Inteligência Artificial para Medicina</Text>
          </Section>

          <Section style={contentSection}>
            <Section style={successBanner}>
              <Text style={successText}>
                ✅ Assinatura confirmada com sucesso!
              </Text>
            </Section>

            <Heading style={h1}>Bem-vindo(a) ao Plano {planName}! 🚀</Heading>

            <Text style={text}>
              Olá, {greeting}!
            </Text>

            <Text style={text}>
              Sua assinatura do Plano {planName} foi ativada com sucesso. A partir de agora, você tem acesso completo e ilimitado a todas as funcionalidades do MindMed.
            </Text>

            <Section style={featuresBox}>
              <Heading style={h2}>🎯 Agora você tem acesso a</Heading>
              <Text style={featureItem}>♾️ <strong>Laudos ilimitados</strong> — sem limite de geração por mês</Text>
              <Text style={featureItem}>🧠 <strong>IA avançada</strong> — modelos de última geração para laudos</Text>
              <Text style={featureItem}>💊 <strong>Prescrições inteligentes</strong> — receituários automáticos</Text>
              <Text style={featureItem}>📊 <strong>Relatórios de evolução</strong> — acompanhe seus pacientes</Text>
              <Text style={featureItem}>🛡️ <strong>PDF institucional</strong> — com assinatura e carimbo digital</Text>
              <Text style={featureItem}>✨ <strong>MindChat ilimitado</strong> — assistente médico 24h</Text>
            </Section>

            <Section style={ctaSection}>
              <Button style={ctaButton} href="https://ia-mind-med.lovable.app/dashboard">
                Começar a Usar
              </Button>
            </Section>

            <Section style={supportBox}>
              <Text style={supportText}>
                💬 Precisa de ajuda? Responda este e-mail ou acesse nosso suporte — estamos aqui para você.
              </Text>
            </Section>

            <Text style={footerText}>
              Obrigado por confiar no MindMed para transformar sua prática clínica.
            </Text>
          </Section>

          <Hr style={hr} />
          <Text style={disclaimer}>© {new Date().getFullYear()} MindMed — Todos os direitos reservados</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: UpgradeConfirmedEmail,
  subject: (data: Record<string, any>) =>
    `Assinatura MindMed ${data.planName || 'Pro'} confirmada! 🚀`,
  displayName: 'Upgrade confirmado',
  previewData: { doctorName: 'Maria Silva', planName: 'Pro' },
} satisfies TemplateEntry

const main = { backgroundColor: '#f8fafc', fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif" }
const container = { maxWidth: '580px', margin: '0 auto', padding: '20px 0', backgroundColor: '#ffffff', borderRadius: '16px', overflow: 'hidden' as const, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }
const headerSection = { background: 'linear-gradient(135deg, hsl(220, 85%, 38%) 0%, hsl(190, 85%, 45%) 100%)', padding: '32px 40px', textAlign: 'center' as const }
const logo = { color: '#ffffff', fontSize: '28px', fontWeight: 'bold' as const, margin: '0', letterSpacing: '-0.5px' }
const logoSubtext = { color: 'rgba(255,255,255,0.85)', fontSize: '13px', margin: '4px 0 0', fontWeight: '400' as const }
const contentSection = { padding: '40px 40px 32px' }
const successBanner = { backgroundColor: '#f0fdf4', borderRadius: '10px', padding: '12px 20px', margin: '0 0 24px', borderLeft: '4px solid #22c55e' }
const successText = { fontSize: '14px', fontWeight: '700' as const, color: '#166534', margin: '0' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: 'hsl(220, 20%, 15%)', margin: '0 0 20px', letterSpacing: '-0.3px' }
const h2 = { fontSize: '16px', fontWeight: '600' as const, color: 'hsl(220, 20%, 15%)', margin: '0 0 14px' }
const text = { fontSize: '15px', color: 'hsl(220, 15%, 40%)', lineHeight: '1.7', margin: '0 0 18px' }
const featuresBox = { backgroundColor: '#f0f7ff', borderRadius: '10px', padding: '24px 28px', margin: '28px 0', borderLeft: '4px solid hsl(220, 85%, 38%)' }
const featureItem = { fontSize: '14px', color: 'hsl(220, 20%, 15%)', margin: '0 0 12px', lineHeight: '1.6' }
const ctaSection = { textAlign: 'center' as const, margin: '28px 0' }
const ctaButton = { background: 'linear-gradient(135deg, hsl(220, 85%, 38%) 0%, hsl(190, 85%, 45%) 100%)', color: '#ffffff', padding: '18px 48px', borderRadius: '10px', fontSize: '17px', fontWeight: '700' as const, textDecoration: 'none', display: 'inline-block' as const, boxShadow: '0 4px 14px rgba(30, 64, 175, 0.25)' }
const supportBox = { backgroundColor: '#fffbeb', borderRadius: '10px', padding: '14px 20px', margin: '0 0 24px', borderLeft: '4px solid #f59e0b' }
const supportText = { fontSize: '13px', color: '#92400e', margin: '0', lineHeight: '1.6' }
const footerText = { fontSize: '13px', color: 'hsl(220, 15%, 55%)', margin: '0', lineHeight: '1.6' }
const hr = { borderColor: 'hsl(220, 15%, 92%)', margin: '0 40px' }
const disclaimer = { fontSize: '11px', color: 'hsl(220, 15%, 65%)', textAlign: 'center' as const, margin: '16px 40px', lineHeight: '1.5' }
