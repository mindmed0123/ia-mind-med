import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type FeatureKey = "appointments" | "telemedicina";

const cache = new Map<string, { value: boolean; ts: number }>();
const TTL = 30_000;

export function useFeatureAccess(featureKey: FeatureKey) {
  const { user } = useAuth();
  const [hasAccess, setHasAccess] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (!user) {
      setHasAccess(false);
      setLoading(false);
      return;
    }

    const cacheKey = `${user.id}:${featureKey}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < TTL) {
      setHasAccess(cached.value);
      setLoading(false);
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from("feature_access")
        .select("enabled, expires_at")
        .eq("user_id", user.id)
        .eq("feature_key", featureKey)
        .maybeSingle();

      if (!mounted) return;

      const granted =
        !!data &&
        !error &&
        data.enabled === true &&
        (!data.expires_at || new Date(data.expires_at) > new Date());

      cache.set(cacheKey, { value: granted, ts: Date.now() });
      setHasAccess(granted);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [user, featureKey]);

  return { hasAccess, loading };
}

export function invalidateFeatureAccessCache(userId?: string) {
  if (!userId) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(`${userId}:`)) cache.delete(key);
  }
}
