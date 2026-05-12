/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "MindMed"

interface TeleconsultaLinkProps {
  patientName?: string
  doctorName?: string
  patientLink?: string
  scheduledAt?: string | null
}

const formatDate = (iso?: string | null) => {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return null
  }
}

const TeleconsultaLinkEmail = ({
  patientName,
  doctorName,
  patientLink = '#',
  scheduledAt,
}: TeleconsultaLinkProps) => {
  const greeting = patientName ? patientName : 'Paciente'
  const doctorLabel = doctorName ? `Dr(a). ${doctorName}` : 'seu médico'
  const when = formatDate(scheduledAt)

  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>Sua sala de teleconsulta está pronta — {SITE_NAME}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={headerSection}>
            <Heading style={logo}>🧠 {SITE_NAME}</Heading>
            <Text style={logoSubtext}>Telemedicina segura e em conformidade com o CFM</Text>
          </Section>

          <Section style={contentSection}>
            <Heading style={h1}>Olá, {greeting} 👋</Heading>

            <Text style={text}>
              {doctorLabel} agendou uma <strong>teleconsulta</strong> com você pelo {SITE_NAME}.
              Para entrar na sala, clique no botão abaixo no horário marcado.
            </Text>

            {when && (
              <Section style={infoBox}>
                <Text style={infoLabel}>📅 Data e hora</Text>
                <Text style={infoValue}>{when}</Text>
              </Section>
            )}

            <Section style={ctaSection}>
              <Button style={ctaButton} href={patientLink}>
                Entrar na Sala de Consulta
              </Button>
              <Text style={linkFallback}>
                Ou copie este link: <br />
                <span style={linkUrl}>{patientLink}</span>
              </Text>
            </Section>

            <Section style={tipBox}>
              <Text style={tipText}>
                ✅ <strong>Antes de entrar:</strong> teste sua câmera e microfone, e prefira uma rede Wi-Fi estável.
                Você precisará aceitar o termo de consentimento ao entrar na sala.
              </Text>
            </Section>

            <Text style={footerText}>
              Em caso de dúvidas, responda este e-mail ou entre em contato com {doctorLabel}.
            </Text>
          </Section>

          <Hr style={hr} />
          <Text style={disclaimer}>© {new Date().getFullYear()} {SITE_NAME} — Todos os direitos reservados</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: TeleconsultaLinkEmail,
  subject: 'Sua sala de teleconsulta está pronta — MindMed',
  displayName: 'Link de teleconsulta',
  previewData: {
    patientName: 'Maria Silva',
    doctorName: 'João Santos',
    patientLink: 'https://acesso.mindmed.online/sala/abc-123?t=token',
    scheduledAt: new Date().toISOString(),
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif" }
const container = { maxWidth: '580px', margin: '0 auto', padding: '20px 0', backgroundColor: '#ffffff', borderRadius: '16px', overflow: 'hidden' as const, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }
const headerSection = { background: 'linear-gradient(135deg, hsl(220, 85%, 38%) 0%, hsl(190, 85%, 45%) 100%)', padding: '32px 40px', textAlign: 'center' as const }
const logo = { color: '#ffffff', fontSize: '28px', fontWeight: 'bold' as const, margin: '0', letterSpacing: '-0.5px' }
const logoSubtext = { color: 'rgba(255,255,255,0.85)', fontSize: '13px', margin: '4px 0 0' }
const contentSection = { padding: '40px 40px 32px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: 'hsl(220, 20%, 15%)', margin: '0 0 18px' }
const text = { fontSize: '15px', color: 'hsl(220, 15%, 40%)', lineHeight: '1.7', margin: '0 0 18px' }
const infoBox = { backgroundColor: '#f0f7ff', borderRadius: '10px', padding: '16px 20px', margin: '20px 0', borderLeft: '4px solid hsl(220, 85%, 38%)' }
const infoLabel = { fontSize: '12px', color: 'hsl(220, 15%, 50%)', margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }
const infoValue = { fontSize: '16px', color: 'hsl(220, 20%, 15%)', margin: '0', fontWeight: '600' as const }
const ctaSection = { textAlign: 'center' as const, margin: '28px 0' }
const ctaButton = { background: 'linear-gradient(135deg, hsl(220, 85%, 38%) 0%, hsl(190, 85%, 45%) 100%)', color: '#ffffff', padding: '18px 48px', borderRadius: '10px', fontSize: '17px', fontWeight: '700' as const, textDecoration: 'none', display: 'inline-block' as const, boxShadow: '0 4px 14px rgba(30, 64, 175, 0.25)' }
const linkFallback = { fontSize: '12px', color: 'hsl(220, 15%, 55%)', margin: '16px 0 0', lineHeight: '1.5' }
const linkUrl = { color: 'hsl(220, 85%, 38%)', wordBreak: 'break-all' as const }
const tipBox = { backgroundColor: '#fffbeb', borderRadius: '10px', padding: '14px 20px', margin: '0 0 24px', borderLeft: '4px solid #f59e0b' }
const tipText = { fontSize: '13px', color: '#92400e', margin: '0', lineHeight: '1.6' }
const footerText = { fontSize: '13px', color: 'hsl(220, 15%, 55%)', margin: '0', lineHeight: '1.6' }
const hr = { borderColor: 'hsl(220, 15%, 92%)', margin: '0 40px' }
const disclaimer = { fontSize: '11px', color: 'hsl(220, 15%, 65%)', textAlign: 'center' as const, margin: '16px 40px', lineHeight: '1.5' }
