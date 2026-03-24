/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Confirme seu email para o MindMed</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={logo}>🧠 MindMed</Heading>
          <Text style={logoSubtext}>Inteligência Artificial para Medicina</Text>
        </Section>

        <Section style={contentSection}>
          <Heading style={h1}>Confirme seu email</Heading>
          <Text style={text}>
            Obrigado por se cadastrar no{' '}
            <Link href={siteUrl} style={link}><strong>MindMed</strong></Link>!
          </Text>
          <Text style={text}>
            Confirme seu endereço de email (
            <Link href={`mailto:${recipient}`} style={link}>{recipient}</Link>
            ) clicando no botão abaixo:
          </Text>

          <Section style={ctaSection}>
            <Button style={ctaButton} href={confirmationUrl}>
              Confirmar Meu Email
            </Button>
          </Section>

          <Text style={footerText}>
            Se você não criou uma conta no MindMed, pode ignorar este email com segurança.
          </Text>
        </Section>

        <Hr style={hr} />
        <Text style={disclaimer}>© {new Date().getFullYear()} MindMed — Todos os direitos reservados</Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#f8fafc', fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif" }
const container = { maxWidth: '580px', margin: '0 auto', padding: '20px 0', backgroundColor: '#ffffff', borderRadius: '16px', overflow: 'hidden' as const, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }
const headerSection = { background: 'linear-gradient(135deg, hsl(220, 85%, 38%) 0%, hsl(190, 85%, 45%) 100%)', padding: '32px 40px', textAlign: 'center' as const }
const logo = { color: '#ffffff', fontSize: '28px', fontWeight: 'bold' as const, margin: '0', letterSpacing: '-0.5px' }
const logoSubtext = { color: 'rgba(255,255,255,0.85)', fontSize: '13px', margin: '4px 0 0', fontWeight: '400' as const }
const contentSection = { padding: '40px 40px 32px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: 'hsl(220, 20%, 15%)', margin: '0 0 20px', letterSpacing: '-0.3px' }
const text = { fontSize: '15px', color: 'hsl(220, 15%, 40%)', lineHeight: '1.7', margin: '0 0 18px' }
const link = { color: 'hsl(220, 85%, 38%)', textDecoration: 'underline' }
const ctaSection = { textAlign: 'center' as const, margin: '32px 0' }
const ctaButton = { background: 'linear-gradient(135deg, hsl(220, 85%, 38%) 0%, hsl(190, 85%, 45%) 100%)', color: '#ffffff', padding: '16px 40px', borderRadius: '10px', fontSize: '16px', fontWeight: '600' as const, textDecoration: 'none', display: 'inline-block' as const, boxShadow: '0 4px 14px rgba(30, 64, 175, 0.25)' }
const footerText = { fontSize: '13px', color: 'hsl(220, 15%, 55%)', margin: '24px 0 0', lineHeight: '1.6' }
const hr = { borderColor: 'hsl(220, 15%, 92%)', margin: '0 40px' }
const disclaimer = { fontSize: '11px', color: 'hsl(220, 15%, 65%)', textAlign: 'center' as const, margin: '16px 40px', lineHeight: '1.5' }
