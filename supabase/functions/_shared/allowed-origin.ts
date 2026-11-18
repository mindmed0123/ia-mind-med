// Return URLs (Stripe, invite links) must point to the app itself, never to an
// origin chosen by the caller.
const DEFAULT_ORIGIN = 'https://acesso.mindmed.online'
const PROJECT_ID = 'f2575919-a7a9-4fdf-8165-df309be38f26'
const EXACT = new Set([
  DEFAULT_ORIGIN,
  'https://mindmed.online',
  'https://www.mindmed.online',
  'https://ia-mind-med.lovable.app',
  'http://localhost:8080',
])

export function safeAppOrigin(req: Request): string {
  const origin = req.headers.get('origin')
  if (!origin) return DEFAULT_ORIGIN
  if (EXACT.has(origin)) return origin
  try {
    const u = new URL(origin)
    const isProjectHost =
      u.protocol === 'https:' &&
      u.hostname.includes(PROJECT_ID) &&
      (u.hostname.endsWith('.lovable.app') || u.hostname.endsWith('.lovableproject.com'))
    if (isProjectHost) return u.origin
  } catch {
    // fall through
  }
  return DEFAULT_ORIGIN
}

export { DEFAULT_ORIGIN }
