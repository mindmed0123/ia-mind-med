/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface OrgInviteProps {
  organizationName?: string
  inviterName?: string
  inviteUrl?: string
  recipientName?: string
}

const OrgInviteEmail = ({ organizationName, inviterName, inviteUrl, recipientName }: OrgInviteProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{`${inviterName ?? 'Alguém'} convidou você para a clínica ${organizationName ?? ''} no MindMed`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={logo}>🧠 MindMed</Heading>
          <Text style={logoSubtext}>Inteligência Artificial para Medicina</Text>
        </Section>

        <Section style={contentSection}>
          <Heading style={h1}>Você foi convidado(a) 🎉</Heading>

          <Text style={text}>
            Olá{recipientName ? `, ${recipientName}` : ''}!
          </Text>

          <Text style={text}>
            <strong>{inviterName}</strong> convidou você para integrar a equipe de{' '}
            <strong>{organizationName}</strong> no MindMed.
          </Text>

          <Section style={featureBox}>
            <Text style={featureTitle}>✨ Acesso PRO completo, por nossa conta:</Text>
            <Text style={featureItem}>📅 Agenda médica profissional</Text>
            <Text style={featureItem}>🤖 Geração de laudos com IA</Text>
            <Text style={featureItem}>💊 Receituário inteligente</Text>
            <Text style={featureItem}>👥 Gestão de pacientes e prontuário</Text>
          </Section>

          <Section style={ctaSection}>
            <Button style={ctaButton} href={inviteUrl}>
              Aceitar convite
            </Button>
          </Section>

          <Text style={tipText}>
            Este convite expira em 7 dias. Caso o link expire, peça ao administrador para enviar novamente.
          </Text>
        </Section>

        <Hr style={hr} />
        <Text style={disclaimer}>© {new Date().getFullYear()} MindMed — Todos os direitos reservados</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OrgInviteEmail,
  subject: (data: Record<string, any>) => `${data.inviterName || 'Você'} te convidou para ${data.organizationName || 'uma clínica'} no MindMed`,
  displayName: 'Convite para clínica',
  previewData: {
    organizationName: 'Clínica Exemplo',
    inviterName: 'Dr. João Silva',
    recipientName: 'Maria',
    inviteUrl: 'https://acesso.mindmed.online/aceitar-convite?token=demo',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#f8fafc', fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif" }
const container = { maxWidth: '580px', margin: '0 auto', padding: '20px 0', backgroundColor: '#ffffff', borderRadius: '16px', overflow: 'hidden' as const, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }
const headerSection = { background: 'linear-gradient(135deg, hsl(220, 85%, 38%) 0%, hsl(190, 85%, 45%) 100%)', padding: '32px 40px', textAlign: 'center' as const }
const logo = { color: '#ffffff', fontSize: '28px', fontWeight: '700', margin: '0' }
const logoSubtext = { color: 'rgba(255,255,255,0.85)', fontSize: '13px', margin: '4px 0 0' }
const contentSection = { padding: '40px' }
const h1 = { color: '#0f172a', fontSize: '24px', fontWeight: '700', margin: '0 0 16px' }
const text = { color: '#334155', fontSize: '15px', lineHeight: '24px', margin: '0 0 16px' }
const featureBox = { backgroundColor: '#f1f5f9', borderRadius: '12px', padding: '20px', margin: '24px 0' }
const featureTitle = { color: '#0f172a', fontSize: '14px', fontWeight: '700', margin: '0 0 12px' }
const featureItem = { color: '#334155', fontSize: '14px', margin: '6px 0' }
const ctaSection = { textAlign: 'center' as const, margin: '28px 0' }
const ctaButton = { background: 'linear-gradient(135deg, hsl(220, 85%, 38%) 0%, hsl(190, 85%, 45%) 100%)', color: '#ffffff', padding: '14px 32px', borderRadius: '10px', fontSize: '15px', fontWeight: '600', textDecoration: 'none', display: 'inline-block' }
const tipText = { color: '#64748b', fontSize: '13px', textAlign: 'center' as const, margin: '12px 0 0' }
const hr = { border: 'none', borderTop: '1px solid #e2e8f0', margin: '24px 40px' }
const disclaimer = { color: '#94a3b8', fontSize: '12px', textAlign: 'center' as const, margin: '0 40px 20px' }
