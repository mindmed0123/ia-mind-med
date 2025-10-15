import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CaktoWebhookPayload {
  event: string;
  data: {
    transaction_id?: string;
    customer_email?: string;
    product_id?: string;
    status?: string;
    amount?: number;
    metadata?: Record<string, any>;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const payload: CaktoWebhookPayload = await req.json();
    console.log('Webhook Cakto recebido:', JSON.stringify(payload, null, 2));

    const { event, data } = payload;

    // Identificar o usuário pelo email
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', data.customer_email)
      .limit(1);

    if (profileError || !profiles || profiles.length === 0) {
      console.error('Usuário não encontrado para email:', data.customer_email);
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = profiles[0].id;

    // Determinar o plano baseado no product_id
    let plan: 'STARTER' | 'PRO' = 'STARTER';
    let quotaTotal = 10;

    // IDs dos produtos Cakto
    // Starter: 3bsu2vi_607441
    // Pro: u95r4cv_607505
    if (data.product_id?.includes('u95r4cv_607505')) {
      plan = 'PRO';
      quotaTotal = 0; // Ilimitado
    }

    switch (event) {
      case 'subscription_created':
      case 'payment_confirmed': {
        // Criar ou atualizar assinatura
        const { data: existingSubscription } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('user_id', userId)
          .eq('external_payment_id', data.transaction_id)
          .single();

        if (existingSubscription) {
          // Atualizar existente
          const { error: updateError } = await supabase
            .from('subscriptions')
            .update({
              status: 'ACTIVE',
              plan,
              remaining_starter_credits: plan === 'STARTER' ? quotaTotal : 0,
              quota_used: 0,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingSubscription.id);

          if (updateError) throw updateError;
        } else {
          // Criar nova
          const { error: insertError } = await supabase
            .from('subscriptions')
            .insert({
              user_id: userId,
              plan,
              status: 'ACTIVE',
              external_payment_id: data.transaction_id,
              payment_provider: 'cakto',
              remaining_starter_credits: plan === 'STARTER' ? quotaTotal : 0,
              quota_used: 0,
              current_period_start: new Date().toISOString(),
              current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // +30 dias
            });

          if (insertError) throw insertError;
        }

        console.log(`Assinatura ${event} para usuário ${userId}, plano ${plan}`);
        break;
      }

      case 'subscription_canceled': {
        // Cancelar assinatura
        const { error: cancelError } = await supabase
          .from('subscriptions')
          .update({
            status: 'CANCELED',
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('external_payment_id', data.transaction_id);

        if (cancelError) throw cancelError;

        console.log(`Assinatura cancelada para usuário ${userId}`);
        break;
      }

      default:
        console.log('Evento não tratado:', event);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Webhook processed' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro no webhook Cakto:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
