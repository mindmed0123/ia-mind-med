/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { styles as s } from './_shared-styles.ts'

interface Props { firstName?: string; stripeCustomerPortalUrl?: string }

const Email = ({ firstName, stripeCustomerPortalUrl = 'https://acesso.mindmed.online' }: Props) => {
  const greet = firstName ? `Dr(a). ${firstName}` : 'Doutor(a)'
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>Sua conta pode ser suspensa em 48h. Resolva agora em 1 minuto.</Preview>
      <Body style={s.main}>
        <Container style={s.container}>
          <Section style={s.header}>
            <Heading style={s.logo}>🧠 MindMed</Heading>
            <Text style={s.logoSub}>Inteligência Artificial para Medicina</Text>
          </Section>
          <Section style={s.content}>
            <Heading style={s.h1}>Problema com seu pagamento, {greet} — ação necessária</Heading>
            <Text style={s.text}>Tivemos um problema ao processar o pagamento da sua assinatura MindMed.</Text>
            <Text style={s.text}>Isso pode acontecer por vários motivos — cartão vencido, limite temporário, ou dados desatualizados. Não é nada grave, mas precisa ser resolvido para manter sua conta ativa.</Text>
            <Section style={s.ctaSection}>
              <Button style={s.ctaButtonDanger} href={stripeCustomerPortalUrl}>Atualizar método de pagamento →</Button>
            </Section>
            <Text style={s.text}>Leva menos de 1 minuto. Se o problema não for resolvido em 48h, sua conta será suspensa automaticamente — mas você não perde nenhum dado.</Text>
            <Text style={s.text}>Se precisar de ajuda, responda este email ou fale pelo WhatsApp: <Link href="https://wa.me/5511958890212">clique aqui</Link>.</Text>
            <Text style={s.signature}>Abraço,<br/><strong>Equipe MindMed</strong></Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Problema com seu pagamento, Dr(a). ${d.firstName || 'Doutor(a)'} — ação necessária`,
  displayName: 'Pagamento falhou',
  previewData: { firstName: 'Maria', stripeCustomerPortalUrl: 'https://billing.stripe.com/p/session/test_xxx' },
} satisfies TemplateEntry
