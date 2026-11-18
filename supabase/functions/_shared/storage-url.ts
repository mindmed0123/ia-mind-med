// Converts a link to a file in this project's storage into its storage path.
// Anything else (other hosts, other buckets, path tricks) returns null, so edge
// functions never fetch arbitrary URLs supplied by callers.
export function storagePathFromUrl(url: unknown, supabaseUrl: string, bucket: string): string | null {
  if (typeof url !== 'string' || !url) return null
  try {
    const u = new URL(url)
    const base = new URL(supabaseUrl)
    if (u.protocol !== 'https:' || u.host !== base.host) return null
    const m = u.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/)
    if (!m || m[1] !== bucket) return null
    const path = decodeURIComponent(m[2])
    if (!path || path.includes('..') || path.startsWith('/')) return null
    return path
  } catch {
    return null
  }
}
