/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface PdfExportedProps {
  doctorName?: string
  laudoTitle?: string
  patientName?: string
}

const PdfExportedEmail = ({ doctorName, laudoTitle, patientName }: PdfExportedProps) => {
  const greeting = doctorName ? `Dr(a). ${doctorName}` : 'Doutor(a)'

  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>Seu laudo foi exportado como PDF com sucesso</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={headerSection}>
            <Heading style={logo}>🧠 MindMed</Heading>
            <Text style={logoSubtext}>Inteligência Artificial para Medicina</Text>
          </Section>

          <Section style={contentSection}>
            <Heading style={h1}>PDF gerado com sucesso ✅</Heading>

            <Text style={text}>
              Olá, {greeting}!
            </Text>

            <Text style={text}>
              Seu laudo{laudoTitle ? ` "${laudoTitle}"` : ''}{patientName ? ` do paciente ${patientName}` : ''} foi exportado como PDF com sucesso.
            </Text>

            <Section style={infoBox}>
              <Text style={infoText}>
                📄 O documento inclui cabeçalho institucional, assinatura digital, hash de verificação SHA-256 e conformidade LGPD.
              </Text>
            </Section>

            <Section style={securityBox}>
              <Text style={securityText}>
                🔒 <strong>Segurança:</strong> O PDF possui hash criptográfico para garantir autenticidade e integridade do documento.
              </Text>
            </Section>

            <Text style={footerText}>
              O PDF está disponível no seu dashboard para download a qualquer momento.
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
  component: PdfExportedEmail,
  subject: 'Laudo exportado como PDF ✅',
  displayName: 'PDF exportado',
  previewData: { doctorName: 'Maria Silva', laudoTitle: 'Consulta Dermatológica', patientName: 'J.S.' },
} satisfies TemplateEntry

const main = { backgroundColor: '#f8fafc', fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif" }
const container = { maxWidth: '580px', margin: '0 auto', padding: '20px 0', backgroundColor: '#ffffff', borderRadius: '16px', overflow: 'hidden' as const, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }
const headerSection = { background: 'linear-gradient(135deg, hsl(220, 85%, 38%) 0%, hsl(190, 85%, 45%) 100%)', padding: '32px 40px', textAlign: 'center' as const }
const logo = { color: '#ffffff', fontSize: '28px', fontWeight: 'bold' as const, margin: '0', letterSpacing: '-0.5px' }
const logoSubtext = { color: 'rgba(255,255,255,0.85)', fontSize: '13px', margin: '4px 0 0', fontWeight: '400' as const }
const contentSection = { padding: '40px 40px 32px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: 'hsl(220, 20%, 15%)', margin: '0 0 20px', letterSpacing: '-0.3px' }
const text = { fontSize: '15px', color: 'hsl(220, 15%, 40%)', lineHeight: '1.7', margin: '0 0 18px' }
const infoBox = { backgroundColor: '#f0f7ff', borderRadius: '10px', padding: '16px 20px', margin: '0 0 16px', borderLeft: '4px solid hsl(220, 85%, 38%)' }
const infoText = { fontSize: '13px', color: 'hsl(220, 20%, 25%)', margin: '0', lineHeight: '1.6' }
const securityBox = { backgroundColor: '#f0fdf4', borderRadius: '10px', padding: '14px 20px', margin: '0 0 24px', borderLeft: '4px solid #22c55e' }
const securityText = { fontSize: '13px', color: '#166534', margin: '0', lineHeight: '1.6' }
const footerText = { fontSize: '13px', color: 'hsl(220, 15%, 55%)', margin: '0', lineHeight: '1.6' }
const hr = { borderColor: 'hsl(220, 15%, 92%)', margin: '0 40px' }
const disclaimer = { fontSize: '11px', color: 'hsl(220, 15%, 65%)', textAlign: 'center' as const, margin: '16px 40px', lineHeight: '1.5' }
