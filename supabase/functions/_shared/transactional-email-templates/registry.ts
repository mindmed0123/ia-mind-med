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

export const TEMPLATES: Record<string, TemplateEntry> = {
  'trial-reminder': trialReminder,
  'welcome': welcome,
  'first-laudo': firstLaudo,
  'pdf-exported': pdfExported,
  'trial-expired': trialExpired,
  'upgrade-confirmed': upgradeConfirmed,
}
