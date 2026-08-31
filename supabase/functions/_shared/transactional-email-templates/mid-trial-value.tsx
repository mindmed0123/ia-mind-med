/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { styles as s } from './_shared-styles.ts'
import { APP_URL } from './config.ts'

interface Props { firstName?: string; doctorName?: string; daysRemaining?: number }

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
      <Preview>Receituário, atestado e templates da sua especialidade</Preview>
      <Body style={s.main}>
        <Container style={s.container}>
          <Section style={s.header}>
            <Heading style={s.logo}>MindMed</Heading>
            <Text style={s.logoSub}>Inteligência Artificial para Medicina</Text>
          </Section>
          <Section style={s.content}>
            <Heading style={s.h1}>Três coisas que a maioria não descobre no teste</Heading>
            <Text style={s.text}>{greet}</Text>
            <Text style={s.text}>Você já está na metade do teste. A maior parte das pessoas usa a MindMed só para laudo e não descobre o resto.</Text>
            <Text style={s.text}>Vale conhecer estas três:</Text>
            <ol style={s.list}>
              <li><strong>Receituário e atestado</strong> — saem do mesmo áudio da consulta, com os dados do paciente já preenchidos. Você não redigita nada.</li>
              <li><strong>Templates da sua especialidade</strong> — dá para configurar o formato que você já usa. A MindMed passa a escrever no seu padrão, não no dela.</li>
              <li><strong>Exportação assinada</strong> — PDF com hash de verificação e trilha de auditoria de cada alteração. Se alguém questionar um documento daqui a três anos, o registro está lá.</li>
            </ol>
            <Section style={s.ctaSection}>
              <Button style={s.ctaButton} href={`${APP_URL}/dashboard`}>Abrir a plataforma</Button>
            </Section>
            <Text style={s.text}>Sobre o terceiro item: em 27 de agosto de 2026 entrou em vigor a Resolução CFM nº 2.454/2026, que passou a exigir que o uso de inteligência artificial seja registrado no prontuário e que exista rastreabilidade de como foi usado. A MindMed já fazia isso antes da norma existir — se você usa, está coberto.</Text>
            {typeof days === 'number' && <Text style={s.text}>Faltam {days} dias de teste.</Text>}
            <Text style={s.text}>Se tiver dúvida, responda este e-mail.</Text>
            <Text style={s.signature}>Pedro Suassuna<br/>MindMed</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: 'Três coisas que a maioria não descobre no teste',
  displayName: 'Meio do trial — D+3',
  previewData: { firstName: 'Maria', daysRemaining: 4 },
} satisfies TemplateEntry
