import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEAL_ANALYSIS_PRICE = 999; // $9.99 in cents

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-DEAL-ANALYSIS-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const { dealId } = await req.json();
    logStep("Received request", { dealId });

    if (!dealId) {
      throw new Error("Deal ID is required");
    }

    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Verify deal belongs to user
    const { data: deal, error: dealError } = await supabaseClient
      .from("deals")
      .select("id, name, user_id")
      .eq("id", dealId)
      .single();

    if (dealError || !deal) {
      throw new Error("Deal not found");
    }

    if (deal.user_id !== user.id) {
      throw new Error("Deal does not belong to user");
    }

    logStep("Deal verified", { dealId: deal.id, dealName: deal.name });

    // Check if already unlocked
    const { data: entitlement } = await supabaseClient
      .from("deal_entitlements")
      .select("status")
      .eq("deal_id", dealId)
      .single();

    if (entitlement?.status === "unlocked") {
      throw new Error("Deal analysis already unlocked");
    }

    // Initialize Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    logStep("Stripe initialized");

    // Check for existing Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
    } else {
      // Create new customer
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = customer.id;
      logStep("Created new customer", { customerId });
    }

    const origin = req.headers.get("origin") || "https://duodrive.app";

    // Create checkout session for deal analysis
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Deal Analysis Unlock",
              description: `Unlock premium analysis for: ${deal.name || "Your Deal"}`,
            },
            unit_amount: DEAL_ANALYSIS_PRICE,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/deal-room?dealId=${dealId}&checkout=success`,
      cancel_url: `${origin}/deal-room?dealId=${dealId}&checkout=cancelled`,
      metadata: {
        deal_id: dealId,
        user_id: user.id,
        type: "deal_analysis",
      },
    });

    logStep("Created checkout session", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
