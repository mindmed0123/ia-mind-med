// Helpers to identify who is calling an edge function.
// Claim parsing is only trusted on functions with verify_jwt = true, where the
// gateway has already verified the token signature.

export function bearerToken(req: Request): string | null {
  const header = req.headers.get('Authorization') || req.headers.get('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : null
}

export function parseJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4)
    return JSON.parse(atob(padded))
  } catch {
    return null
  }
}

/** True only for trusted server-to-server calls made with the service role key. */
export function isServiceRoleRequest(req: Request): boolean {
  const token = bearerToken(req)
  if (!token) return false
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (serviceKey && token === serviceKey) return true
  return parseJwtClaims(token)?.role === 'service_role'
}

/** Masks an e-mail for diagnostic logs: "jo***@dominio.com". */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return ''
  const [local, domain] = String(email).split('@')
  if (!domain) return '***'
  return `${local.slice(0, 2)}***@${domain}`
}
