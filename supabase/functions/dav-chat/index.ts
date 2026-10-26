import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  return new Response(JSON.stringify({ error: 'fora_de_escopo' }), { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
