/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu código de verificação MindMed</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={logo}>🧠 MindMed</Heading>
          <Text style={logoSubtext}>Inteligência Artificial para Medicina</Text>
        </Section>

        <Section style={contentSection}>
          <Heading style={h1}>Código de verificação</Heading>
          <Text style={text}>Use o código abaixo para confirmar sua identidade:</Text>

          <Section style={codeBox}>
            <Text style={codeStyle}>{token}</Text>
          </Section>

          <Section style={warningBox}>
            <Text style={warningText}>
              ⏱️ Este código expira em poucos minutos. Se você não solicitou este código,
              pode ignorar este email com segurança.
            </Text>
          </Section>
        </Section>

        <Hr style={hr} />
        <Text style={disclaimer}>© {new Date().getFullYear()} MindMed — Todos os direitos reservados</Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#f8fafc', fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif" }
const container = { maxWidth: '580px', margin: '0 auto', padding: '20px 0', backgroundColor: '#ffffff', borderRadius: '16px', overflow: 'hidden' as const, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }
const headerSection = { background: 'linear-gradient(135deg, hsl(220, 85%, 38%) 0%, hsl(190, 85%, 45%) 100%)', padding: '32px 40px', textAlign: 'center' as const }
const logo = { color: '#ffffff', fontSize: '28px', fontWeight: 'bold' as const, margin: '0', letterSpacing: '-0.5px' }
const logoSubtext = { color: 'rgba(255,255,255,0.85)', fontSize: '13px', margin: '4px 0 0', fontWeight: '400' as const }
const contentSection = { padding: '40px 40px 32px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: 'hsl(220, 20%, 15%)', margin: '0 0 20px', letterSpacing: '-0.3px' }
const text = { fontSize: '15px', color: 'hsl(220, 15%, 40%)', lineHeight: '1.7', margin: '0 0 18px' }
const codeBox = { backgroundColor: '#f0f7ff', borderRadius: '12px', padding: '24px', margin: '24px 0', textAlign: 'center' as const, border: '2px dashed hsl(220, 85%, 38%)' }
const codeStyle = { fontFamily: "'SF Mono', 'Fira Code', Courier, monospace", fontSize: '36px', fontWeight: 'bold' as const, color: 'hsl(220, 85%, 38%)', margin: '0', letterSpacing: '8px' }
const warningBox = { backgroundColor: '#fef3c7', borderRadius: '10px', padding: '16px 20px', borderLeft: '4px solid #f59e0b', margin: '24px 0 0' }
const warningText = { fontSize: '13px', color: '#92400e', margin: '0', lineHeight: '1.6' }
const hr = { borderColor: 'hsl(220, 15%, 92%)', margin: '0 40px' }
const disclaimer = { fontSize: '11px', color: 'hsl(220, 15%, 65%)', textAlign: 'center' as const, margin: '16px 40px', lineHeight: '1.5' }
