/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as trialReminder } from './trial-reminder.tsx'
import { template as welcome } from './welcome.tsx'
import { template as firstLaudo } from './first-laudo.tsx'
import { template as pdfExported } from './pdf-exported.tsx'
import { template as trialExpired } from './trial-expired.tsx'
import { template as upgradeConfirmed } from './upgrade-confirmed.tsx'
import { template as orgInvite } from './org-invite.tsx'
import { template as teleconsultaLink } from './teleconsulta-link.tsx'
import { template as activationNudge } from './activation-nudge.tsx'
import { template as activationD5 } from './activation-d5.tsx'
import { template as midTrialValue } from './mid-trial-value.tsx'
import { template as conversionOffer } from './conversion-offer.tsx'
import { template as winbackD3 } from './winback-d3.tsx'
import { template as winbackD15 } from './winback-d15.tsx'
import { template as upgradePrompt } from './upgrade-prompt.tsx'
import { template as paymentFailed } from './payment-failed.tsx'
import { template as farmacovigilanciaNotificacao } from './farmacovigilancia-notificacao.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'trial-reminder': trialReminder,
  'welcome': welcome,
  'first-laudo': firstLaudo,
  'pdf-exported': pdfExported,
  'trial-expired': trialExpired,
  'upgrade-confirmed': upgradeConfirmed,
  'org-invite': orgInvite,
  'teleconsulta-link': teleconsultaLink,
  'activation-nudge': activationNudge,
  'activation-d5': activationD5,
  'mid-trial-value': midTrialValue,
  'conversion-offer': conversionOffer,
  'winback-d3': winbackD3,
  'winback-d15': winbackD15,
  'upgrade-prompt': upgradePrompt,
  'payment-failed': paymentFailed,
  'farmacovigilancia-notificacao': farmacovigilanciaNotificacao,
}
