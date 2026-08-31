/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { styles as s } from './_shared-styles.ts'
import { APP_URL } from './config.ts'

const FUNDADOR_URL = `${APP_URL}/medicos/teste-gratis?plan=mindmed_fundador`

interface Props { firstName?: string; doctorName?: string }

const first = (p: Props) => {
  const raw = (p.firstName || p.doctorName || '').trim()
  return raw ? raw.split(/\s+/)[0] : ''
}

const Email = (props: Props) => {
  const n = first(props)
  const greet = n ? `Dr(a). ${n},` : 'Doutor(a),'
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>A conta fica guardada se você quiser voltar</Preview>
      <Body style={s.main}>
        <Container style={s.container}>
          <Section style={s.header}>
            <Heading style={s.logo}>MindMed</Heading>
            <Text style={s.logoSub}>Inteligência Artificial para Medicina</Text>
          </Section>
          <Section style={s.content}>
            <Heading style={s.h1}>Seus documentos continuam salvos</Heading>
            <Text style={s.text}>{greet}</Text>
            <Text style={s.text}>Seu período de teste terminou e nenhuma cobrança foi feita.</Text>
            <Text style={s.text}>Seus documentos e dados continuam salvos e seguros. Se um dia quiser voltar, tudo estará onde você deixou.</Text>
            <Text style={s.text}>Se puder me responder uma linha sobre o que faltou, eu agradeço de verdade. Não é pesquisa automática — é para melhorar o produto mesmo.</Text>
            <Text style={s.text}>E se for questão de momento, as vagas de fundador seguem abertas:</Text>
            <Section style={offerBox}>
              <Text style={offerTitle}>MindMed Pro Anual — Fundador</Text>
              <Text style={offerPrice}>R$ 1.990/ano</Text>
              <Text style={offerLine}>Preço travado · Kit de Adequação CFM incluído · Garantia de 30 dias</Text>
            </Section>
            <Section style={s.ctaSection}>
              <Button style={s.ctaButton} href={FUNDADOR_URL}>Ver as vagas restantes</Button>
            </Section>
            <Text style={s.text}>Obrigado por ter testado.</Text>
            <Text style={s.signature}>Pedro Suassuna<br/>MindMed</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: 'Seus documentos continuam salvos',
  displayName: 'Trial expirado — D+8',
  previewData: { firstName: 'Maria' },
} satisfies TemplateEntry

const offerBox = { backgroundColor: '#f0f7ff', borderRadius: '10px', padding: '24px 28px', margin: '28px 0', borderLeft: '4px solid hsl(220, 85%, 38%)', textAlign: 'center' as const }
const offerTitle = { fontSize: '15px', fontWeight: '700' as const, color: 'hsl(220, 20%, 15%)', margin: '0 0 8px' }
const offerPrice = { fontSize: '34px', fontWeight: 'bold' as const, color: 'hsl(220, 85%, 38%)', margin: '0', lineHeight: '1.1' }
const offerLine = { fontSize: '13px', color: 'hsl(220, 15%, 40%)', margin: '8px 0 0', lineHeight: '1.5' }
