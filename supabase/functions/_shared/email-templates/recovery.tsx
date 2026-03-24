/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Redefinir sua senha no MindMed</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={logo}>🧠 MindMed</Heading>
          <Text style={logoSubtext}>Inteligência Artificial para Medicina</Text>
        </Section>

        <Section style={contentSection}>
          <Heading style={h1}>Redefinir sua senha</Heading>
          <Text style={text}>
            Recebemos uma solicitação para redefinir a senha da sua conta no MindMed.
            Clique no botão abaixo para escolher uma nova senha.
          </Text>

          <Section style={ctaSection}>
            <Button style={ctaButton} href={confirmationUrl}>
              Redefinir Senha
            </Button>
          </Section>

          <Section style={warningBox}>
            <Text style={warningText}>
              🔒 Este link expira em poucos minutos. Se você não solicitou a redefinição,
              ignore este email — sua senha permanecerá inalterada.
            </Text>
          </Section>
        </Section>

        <Hr style={hr} />
        <Text style={disclaimer}>© {new Date().getFullYear()} MindMed — Todos os direitos reservados</Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#f8fafc', fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif" }
const container = { maxWidth: '580px', margin: '0 auto', padding: '20px 0', backgroundColor: '#ffffff', borderRadius: '16px', overflow: 'hidden' as const, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }
const headerSection = { background: 'linear-gradient(135deg, hsl(220, 85%, 38%) 0%, hsl(190, 85%, 45%) 100%)', padding: '32px 40px', textAlign: 'center' as const }
const logo = { color: '#ffffff', fontSize: '28px', fontWeight: 'bold' as const, margin: '0', letterSpacing: '-0.5px' }
const logoSubtext = { color: 'rgba(255,255,255,0.85)', fontSize: '13px', margin: '4px 0 0', fontWeight: '400' as const }
const contentSection = { padding: '40px 40px 32px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: 'hsl(220, 20%, 15%)', margin: '0 0 20px', letterSpacing: '-0.3px' }
const text = { fontSize: '15px', color: 'hsl(220, 15%, 40%)', lineHeight: '1.7', margin: '0 0 18px' }
const ctaSection = { textAlign: 'center' as const, margin: '32px 0' }
const ctaButton = { background: 'linear-gradient(135deg, hsl(220, 85%, 38%) 0%, hsl(190, 85%, 45%) 100%)', color: '#ffffff', padding: '16px 40px', borderRadius: '10px', fontSize: '16px', fontWeight: '600' as const, textDecoration: 'none', display: 'inline-block' as const, boxShadow: '0 4px 14px rgba(30, 64, 175, 0.25)' }
const warningBox = { backgroundColor: '#fef3c7', borderRadius: '10px', padding: '16px 20px', borderLeft: '4px solid #f59e0b', margin: '24px 0 0' }
const warningText = { fontSize: '13px', color: '#92400e', margin: '0', lineHeight: '1.6' }
const hr = { borderColor: 'hsl(220, 15%, 92%)', margin: '0 40px' }
const disclaimer = { fontSize: '11px', color: 'hsl(220, 15%, 65%)', textAlign: 'center' as const, margin: '16px 40px', lineHeight: '1.5' }
