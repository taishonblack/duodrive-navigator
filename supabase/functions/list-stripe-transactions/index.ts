import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[LIST-STRIPE-TRANSACTIONS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    logStep("Fetching Stripe transactions");

    // Verify admin authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Invalid token");

    // Check admin role
    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) throw new Error("Unauthorized: Admin access required");

    const { limit = 50 } = await req.json().catch(() => ({}));

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Fetch recent payment intents
    const paymentIntents = await stripe.paymentIntents.list({
      limit: Math.min(limit, 100),
      expand: ["data.customer"],
    });

    // Fetch recent charges for more details
    const charges = await stripe.charges.list({
      limit: Math.min(limit, 100),
    });

    // Fetch recent refunds
    const refunds = await stripe.refunds.list({
      limit: Math.min(limit, 100),
    });

    // Combine and format transactions
    const transactions = [];

    // Add payment intents
    for (const pi of paymentIntents.data) {
      const customer = pi.customer as Stripe.Customer | null;
      transactions.push({
        id: pi.id,
        type: "payment",
        amount: pi.amount,
        currency: pi.currency,
        status: pi.status,
        description: pi.description || `${pi.metadata?.session_type || "Coaching"} Session`,
        customerEmail: customer?.email || pi.metadata?.customer_email || null,
        created: pi.created,
        metadata: pi.metadata,
      });
    }

    // Add refunds
    for (const refund of refunds.data) {
      transactions.push({
        id: refund.id,
        type: "refund",
        amount: refund.amount,
        currency: refund.currency,
        status: refund.status,
        description: `Refund for ${refund.payment_intent}`,
        customerEmail: null,
        created: refund.created,
        metadata: refund.metadata,
        paymentIntentId: refund.payment_intent,
      });
    }

    // Sort by created date (newest first)
    transactions.sort((a, b) => b.created - a.created);

    logStep("Transactions fetched", { count: transactions.length });

    return new Response(JSON.stringify({ 
      success: true, 
      transactions: transactions.slice(0, limit)
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
