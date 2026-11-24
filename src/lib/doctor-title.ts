/** Evita "Dr(a). Dr. Fulano" quando o médico já cadastrou o título no nome. */
export function formatDoctorTitle(name: string): string {
  const clean = (name || '').trim();
  if (/^(dr|dra|dr\(a\))\.?\s/i.test(clean)) return clean;
  return `Dr(a). ${clean}`;
}
