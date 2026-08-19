import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'profile-images';
const SIGNED_URL_TTL = 60 * 60 * 24 * 7; // 7 dias

/**
 * Extrai o caminho dentro do bucket a partir de uma URL pública/signed do Supabase Storage.
 * Retorna null se não for possível extrair.
 */
function extractPathFromUrl(url: string): { bucket: string; path: string } | null {
  try {
    const parsed = new URL(url);
    // Formatos:
    // /storage/v1/object/public/<bucket>/<path>
    // /storage/v1/object/sign/<bucket>/<path>?token=...
    const match = parsed.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/);
    if (match) {
      return { bucket: match[1], path: decodeURIComponent(match[2]) };
    }
  } catch {
    // Ignora URL inválida
  }
  return null;
}

/**
 * Gera uma URL assinada (signed URL) para uma imagem de perfil.
 * Aceita tanto um caminho relativo quanto uma URL pública/signed antiga.
 */
export async function getProfileImageUrl(storedValue: string | null | undefined): Promise<string | null> {
  if (!storedValue) return null;

  // Se já for data URI, devolve como está
  if (storedValue.startsWith('data:')) return storedValue;

  // Se for URL, tenta extrair bucket/caminho
  const extracted = extractPathFromUrl(storedValue);
  if (extracted) {
    const { bucket, path } = extracted;
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL);
    if (error) {
      console.error('Erro ao gerar signed URL:', error);
      return null;
    }
    return data?.signedUrl || null;
  }

  // Assume que é um caminho relativo ao bucket profile-images
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storedValue, SIGNED_URL_TTL);
  if (error) {
    console.error('Erro ao gerar signed URL:', error);
    return null;
  }
  return data?.signedUrl || null;
}

/**
 * Monta o caminho relativo de uma imagem de perfil no bucket.
 */
export function buildProfileImagePath(userId: string, type: string, ext: string): string {
  return `${userId}/${type}-${Date.now()}.${ext}`;
}

/**
 * Monta a URL pública (não-usável diretamente em bucket privado) apenas para referência/extração posterior.
 */
export function buildProfileImagePublicUrl(path: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
