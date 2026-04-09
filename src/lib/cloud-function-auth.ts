import { supabase } from "@/integrations/supabase/client";

export async function getCloudFunctionHeaders(existingAccessToken?: string | null) {
  let accessToken = existingAccessToken ?? null;

  if (!accessToken) {
    const { data } = await supabase.auth.getSession();
    accessToken = data.session?.access_token ?? null;
  }

  if (!accessToken) {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      throw error;
    }
    accessToken = data.session?.access_token ?? null;
  }

  if (!accessToken) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  return {
    Authorization: `Bearer ${accessToken}`,
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}