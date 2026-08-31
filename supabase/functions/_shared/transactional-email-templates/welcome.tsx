/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { styles as s } from './_shared-styles.ts'
import { APP_URL } from './config.ts'

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
      <Preview>40 segundos para ver a MindMed funcionando</Preview>
      <Body style={s.main}>
        <Container style={s.container}>
          <Section style={s.header}>
            <Heading style={s.logo}>MindMed</Heading>
            <Text style={s.logoSub}>Inteligência Artificial para Medicina</Text>
          </Section>
          <Section style={s.content}>
            <Heading style={s.h1}>{n ? `Sua conta está pronta, Dr(a). ${n}` : 'Sua conta está pronta'}</Heading>
            <Text style={s.text}>{greet}</Text>
            <Text style={s.text}>Sua conta está ativa e seus 7 dias de teste começaram agora.</Text>
            <Text style={s.text}>Antes de usar num atendimento real, vale ver funcionando. Deixamos um resumo de consulta pronto na plataforma — você clica uma vez e vê o laudo sendo montado.</Text>
            <Text style={s.text}>Não precisa de gravação, nem de paciente cadastrado. Leva menos de um minuto.</Text>
            <Section style={s.ctaSection}>
              <Button style={s.ctaButton} href={`${APP_URL}/dashboard?onboarding=laudo-demo`}>Ver a MindMed funcionando</Button>
            </Section>
            <Text style={s.text}>Depois disso, é só usar no seu primeiro atendimento: grave a consulta pelo celular ou pelo computador, e a MindMed devolve anamnese, evolução e laudo estruturados. Você revisa, ajusta e assina.</Text>
            <Text style={s.text}>Nada é finalizado sem a sua aprovação.</Text>
            <Text style={s.text}>Qualquer dúvida, responda este e-mail — quem lê sou eu.</Text>
            <Text style={s.signature}>Pedro Suassuna<br/>MindMed</Text>
            <Text style={s.small}>Nada foi cobrado ainda. A primeira cobrança acontece no 8º dia, e você pode cancelar em dois cliques até lá. Se continuar e não gostar, são 30 dias para pedir 100% de volta.</Text>
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
    return n ? `Sua conta está pronta, Dr(a). ${n}` : 'Sua conta está pronta'
  },
  displayName: 'Boas-vindas',
  previewData: { firstName: 'Maria' },
} satisfies TemplateEntry
