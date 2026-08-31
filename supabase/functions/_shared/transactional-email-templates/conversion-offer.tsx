/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { styles as s } from './_shared-styles.ts'
import { APP_URL } from './config.ts'

const FUNDADOR_URL = `${APP_URL}/medicos/teste-gratis?plan=mindmed_fundador`

interface Props { firstName?: string; doctorName?: string; daysRemaining?: number; trialEndDate?: string }

const first = (p: Props) => {
  const raw = (p.firstName || p.doctorName || '').trim()
  return raw ? raw.split(/\s+/)[0] : ''
}

const Email = (props: Props) => {
  const n = first(props)
  const greet = n ? `Dr(a). ${n},` : 'Doutor(a),'
  const days = props.daysRemaining
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>Preço travado enquanto a assinatura durar</Preview>
      <Body style={s.main}>
        <Container style={s.container}>
          <Section style={s.header}>
            <Heading style={s.logo}>MindMed</Heading>
            <Text style={s.logoSub}>Inteligência Artificial para Medicina</Text>
          </Section>
          <Section style={s.content}>
            <Heading style={s.h1}>{n ? `Dr(a). ${n}, sobre as vagas de fundador` : 'Sobre as vagas de fundador'}</Heading>
            <Text style={s.text}>{greet}</Text>
            <Text style={s.text}>
              {typeof days === 'number'
                ? `Seu teste termina em ${days} ${days === 1 ? 'dia' : 'dias'}.`
                : 'Seu teste está terminando.'}{' '}
              Se você quiser continuar, não precisa fazer nada — a assinatura segue sozinha no plano que você escolheu.
            </Text>
            <Text style={s.text}>Mas antes vale saber de uma coisa.</Text>
            <Text style={s.text}>Estamos abrindo 100 vagas de fundador da MindMed. Quem entrar agora paga R$ 1.990 pelo ano — em vez de R$ 2.990 — e mantém esse preço enquanto a assinatura durar. Quando as 100 vagas acabarem, o valor volta para a tabela.</Text>
            <Section style={offerBox}>
              <Text style={offerTitle}>MindMed Pro Anual — Fundador</Text>
              <Text style={offerPrice}>R$ 1.990/ano</Text>
              <Text style={offerLine}>equivale a R$ 166/mês</Text>
              <Text style={offerLine}>Preço travado · Kit de Adequação CFM 2.454/2026 incluído</Text>
            </Section>
            <Section style={s.ctaSection}>
              <Button style={s.ctaButton} href={FUNDADOR_URL}>Garantir minha vaga de fundador</Button>
            </Section>
            <Text style={s.text}>A garantia continua a mesma: 30 dias para pedir 100% de volta, sem formulário e sem pergunta. Basta responder o e-mail da cobrança.</Text>
            <Text style={s.text}>Se preferir o mensal, não precisa fazer nada — ele continua normalmente.</Text>
            <Text style={s.signature}>Pedro Suassuna<br/>MindMed</Text>
            <Text style={s.small}>
              Parceira oficial da SBACV — Sociedade Brasileira de Angiologia e de Cirurgia Vascular.
              {props.trialEndDate ? ` Sua conta segue ativa até ${props.trialEndDate}.` : ''}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => {
    const n = first(d as Props)
    return n ? `Dr(a). ${n}, sobre as vagas de fundador` : 'Sobre as vagas de fundador'
  },
  displayName: 'Oferta conversão — D+5',
  previewData: { firstName: 'Maria', daysRemaining: 2, trialEndDate: '15/06/2026' },
} satisfies TemplateEntry

const offerBox = { backgroundColor: '#f0f7ff', borderRadius: '10px', padding: '24px 28px', margin: '28px 0', borderLeft: '4px solid hsl(220, 85%, 38%)', textAlign: 'center' as const }
const offerTitle = { fontSize: '15px', fontWeight: '700' as const, color: 'hsl(220, 20%, 15%)', margin: '0 0 8px' }
const offerPrice = { fontSize: '34px', fontWeight: 'bold' as const, color: 'hsl(220, 85%, 38%)', margin: '0', lineHeight: '1.1' }
const offerLine = { fontSize: '13px', color: 'hsl(220, 15%, 40%)', margin: '8px 0 0', lineHeight: '1.5' }
