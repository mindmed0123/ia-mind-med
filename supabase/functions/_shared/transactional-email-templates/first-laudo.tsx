/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "MindMed"

interface FirstLaudoProps {
  doctorName?: string
  laudoTitle?: string
}

const FirstLaudoEmail = ({ doctorName, laudoTitle }: FirstLaudoProps) => {
  const greeting = doctorName ? `Dr(a). ${doctorName}` : 'Doutor(a)'

  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>Parabéns! Seu primeiro laudo foi gerado com IA no MindMed 🎉</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={headerSection}>
            <Heading style={logo}>🧠 MindMed</Heading>
            <Text style={logoSubtext}>Inteligência Artificial para Medicina</Text>
          </Section>

          <Section style={contentSection}>
            <Heading style={h1}>Primeiro laudo gerado! 🎉</Heading>

            <Text style={text}>
              Parabéns, {greeting}!
            </Text>

            <Text style={text}>
              Você acabou de gerar seu primeiro laudo médico com inteligência artificial no MindMed.
              {laudoTitle ? ` O laudo "${laudoTitle}" já está disponível no seu dashboard.` : ''}
            </Text>

            <Section style={achievementBox}>
              <Text style={achievementText}>
                🏆 <strong>Conquista desbloqueada:</strong> Primeiro laudo com IA gerado!
              </Text>
            </Section>

            <Section style={stepsBox}>
              <Heading style={h2}>📋 O que mais você pode fazer</Heading>
              <Text style={stepItem}>📄 <strong>Exporte como PDF</strong> — com cabeçalho profissional e CRM</Text>
              <Text style={stepItem}>🔗 <strong>Vincule pacientes</strong> — organize prontuários automaticamente</Text>
              <Text style={stepItem}>💊 <strong>Gere prescrições</strong> — receituários inteligentes integrados</Text>
              <Text style={stepItem}>📊 <strong>Relatório de evolução</strong> — acompanhe a evolução clínica</Text>
            </Section>

            <Section style={ctaSection}>
              <Button style={ctaButton} href="https://ia-mind-med.lovable.app/dashboard">
                Ver Meu Dashboard
              </Button>
            </Section>

            <Text style={footerText}>
              Continue explorando — cada laudo fica mais preciso com o uso.
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
  component: FirstLaudoEmail,
  subject: 'Parabéns! Seu primeiro laudo com IA foi gerado 🎉',
  displayName: 'Primeiro laudo gerado',
  previewData: { doctorName: 'Maria Silva', laudoTitle: 'Consulta Clínica Geral' },
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
const achievementBox = { backgroundColor: '#f0fdf4', borderRadius: '10px', padding: '16px 20px', margin: '0 0 24px', borderLeft: '4px solid #22c55e' }
const achievementText = { fontSize: '14px', color: '#166534', margin: '0', lineHeight: '1.6' }
const stepsBox = { backgroundColor: '#f0f7ff', borderRadius: '10px', padding: '24px 28px', margin: '28px 0', borderLeft: '4px solid hsl(220, 85%, 38%)' }
const stepItem = { fontSize: '14px', color: 'hsl(220, 20%, 15%)', margin: '0 0 12px', lineHeight: '1.6' }
const ctaSection = { textAlign: 'center' as const, margin: '28px 0' }
const ctaButton = { background: 'linear-gradient(135deg, hsl(220, 85%, 38%) 0%, hsl(190, 85%, 45%) 100%)', color: '#ffffff', padding: '18px 48px', borderRadius: '10px', fontSize: '17px', fontWeight: '700' as const, textDecoration: 'none', display: 'inline-block' as const, boxShadow: '0 4px 14px rgba(30, 64, 175, 0.25)' }
const footerText = { fontSize: '13px', color: 'hsl(220, 15%, 55%)', margin: '0', lineHeight: '1.6' }
const hr = { borderColor: 'hsl(220, 15%, 92%)', margin: '0 40px' }
const disclaimer = { fontSize: '11px', color: 'hsl(220, 15%, 65%)', textAlign: 'center' as const, margin: '16px 40px', lineHeight: '1.5' }
