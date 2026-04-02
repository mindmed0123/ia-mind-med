/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "MindMed"

interface WelcomeProps {
  doctorName?: string
}

const WelcomeEmail = ({ doctorName }: WelcomeProps) => {
  const greeting = doctorName ? `Dr(a). ${doctorName}` : 'Doutor(a)'

  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>Bem-vindo(a) ao MindMed — sua jornada com IA médica começa agora!</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={headerSection}>
            <Heading style={logo}>🧠 MindMed</Heading>
            <Text style={logoSubtext}>Inteligência Artificial para Medicina</Text>
          </Section>

          <Section style={contentSection}>
            <Heading style={h1}>Bem-vindo(a) ao MindMed! 🎉</Heading>

            <Text style={text}>
              Olá, {greeting}!
            </Text>

            <Text style={text}>
              Sua conta foi criada com sucesso. A partir de agora, você tem acesso a uma plataforma de IA médica que vai transformar a sua prática clínica.
            </Text>

            <Section style={stepsBox}>
              <Heading style={h2}>🚀 Primeiros passos</Heading>
              <Text style={stepItem}>1️⃣ <strong>Configure seu perfil</strong> — Adicione CRM, especialidade e assinatura digital</Text>
              <Text style={stepItem}>2️⃣ <strong>Crie seu primeiro laudo</strong> — Grave ou digite e a IA estrutura tudo</Text>
              <Text style={stepItem}>3️⃣ <strong>Explore o MindChat</strong> — Seu assistente médico com IA 24h</Text>
            </Section>

            <Section style={ctaSection}>
              <Button style={ctaButton} href="https://ia-mind-med.lovable.app/dashboard">
                Acessar Meu Dashboard
              </Button>
            </Section>

            <Section style={tipBox}>
              <Text style={tipText}>
                💡 <strong>Dica:</strong> Seu trial de 15 dias inclui acesso completo a todas as funcionalidades Pro. Aproveite ao máximo!
              </Text>
            </Section>

            <Text style={footerText}>
              Se tiver dúvidas, responda este e-mail — estamos aqui para ajudar.
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
  component: WelcomeEmail,
  subject: 'Bem-vindo(a) ao MindMed! 🧠',
  displayName: 'Boas-vindas',
  previewData: { doctorName: 'Maria Silva' },
} satisfies TemplateEntry

const main = { backgroundColor: '#f8fafc', fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif" }
const container = { maxWidth: '580px', margin: '0 auto', padding: '20px 0', backgroundColor: '#ffffff', borderRadius: '16px', overflow: 'hidden' as const, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }
const headerSection = { background: 'linear-gradient(135deg, hsl(220, 85%, 38%) 0%, hsl(190, 85%, 45%) 100%)', padding: '32px 40px', textAlign: 'center' as const }
const logo = { color: '#ffffff', fontSize: '28px', fontWeight: 'bold' as const, margin: '0', letterSpacing: '-0.5px' }
const logoSubtext = { color: 'rgba(255,255,255,0.85)', fontSize: '13px', margin: '4px 0 0', fontWeight: '400' as const }
const contentSection = { padding: '40px 40px 32px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: 'hsl(220, 20%, 15%)', margin: '0 0 20px', letterSpacing: '-0.3px' }
const h2 = { fontSize: '16px', fontWeight: '600' as const, color: 'hsl(220, 20%, 15%)', margin: '0 0 14px' }
const text = { fontSize: '15px', color: 'hsl(220, 15%, 40%)', lineHeight: '1.7', margin: '0 0 18px' }
const stepsBox = { backgroundColor: '#f0f7ff', borderRadius: '10px', padding: '24px 28px', margin: '28px 0', borderLeft: '4px solid hsl(220, 85%, 38%)' }
const stepItem = { fontSize: '14px', color: 'hsl(220, 20%, 15%)', margin: '0 0 12px', lineHeight: '1.6' }
const ctaSection = { textAlign: 'center' as const, margin: '28px 0' }
const ctaButton = { background: 'linear-gradient(135deg, hsl(220, 85%, 38%) 0%, hsl(190, 85%, 45%) 100%)', color: '#ffffff', padding: '18px 48px', borderRadius: '10px', fontSize: '17px', fontWeight: '700' as const, textDecoration: 'none', display: 'inline-block' as const, boxShadow: '0 4px 14px rgba(30, 64, 175, 0.25)' }
const tipBox = { backgroundColor: '#fffbeb', borderRadius: '10px', padding: '14px 20px', margin: '0 0 24px', borderLeft: '4px solid #f59e0b' }
const tipText = { fontSize: '13px', color: '#92400e', margin: '0', lineHeight: '1.6' }
const footerText = { fontSize: '13px', color: 'hsl(220, 15%, 55%)', margin: '0', lineHeight: '1.6' }
const hr = { borderColor: 'hsl(220, 15%, 92%)', margin: '0 40px' }
const disclaimer = { fontSize: '11px', color: 'hsl(220, 15%, 65%)', textAlign: 'center' as const, margin: '16px 40px', lineHeight: '1.5' }
