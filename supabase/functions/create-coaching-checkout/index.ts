import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Coaching tier configurations
const COACHING_TIERS = {
  text: {
    name: "Quick Text Help",
    description: "10-minute text coaching session with a DuoDrive expert",
    amount: 2900, // $29.00
    mode: "payment" as const,
  },
  phone: {
    name: "Live Phone Session",
    description: "30-minute phone coaching session with a DuoDrive expert",
    amount: 9900, // $99.00
    mode: "payment" as const,
  },
  video: {
    name: "Full Concierge",
    description: "Premium concierge service - 20% deposit now, 80% after service",
    amount: 9980, // $99.80 (20% of $499)
    fullAmount: 49900, // $499.00 total
    mode: "payment" as const,
    isDeposit: true,
  },
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-COACHING-CHECKOUT] ${step}${detailsStr}`);
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

    const { sessionType, requestId } = await req.json();
    logStep("Received request", { sessionType, requestId });

    if (!sessionType || !COACHING_TIERS[sessionType as keyof typeof COACHING_TIERS]) {
      throw new Error(`Invalid session type: ${sessionType}`);
    }

    const tier = COACHING_TIERS[sessionType as keyof typeof COACHING_TIERS];
    logStep("Selected tier", { tier: tier.name, amount: tier.amount });

    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

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

    // For Full Concierge, we need to save the card for later charges
    if (sessionType === "video") {
      // Create checkout session with setup for future payments
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `${tier.name} - Deposit (20%)`,
                description: tier.description,
              },
              unit_amount: tier.amount,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        payment_intent_data: {
          setup_future_usage: "off_session", // Save the card for future charges
          metadata: {
            session_type: sessionType,
            request_id: requestId || "",
            user_id: user.id,
            is_deposit: "true",
            remaining_amount: String((tier as any).fullAmount - tier.amount),
          },
        },
        success_url: `${origin}/coaching?payment=success&session_type=${sessionType}&request_id=${requestId || ""}`,
        cancel_url: `${origin}/coaching?payment=cancelled`,
        metadata: {
          session_type: sessionType,
          request_id: requestId || "",
          user_id: user.id,
          is_deposit: "true",
        },
      });

      logStep("Created Concierge checkout session", { sessionId: session.id, url: session.url });

      return new Response(JSON.stringify({ url: session.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // For Quick Text Help and Live Phone Session - standard one-time payment
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: tier.name,
              description: tier.description,
            },
            unit_amount: tier.amount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      payment_intent_data: {
        metadata: {
          session_type: sessionType,
          request_id: requestId || "",
          user_id: user.id,
        },
      },
      success_url: `${origin}/coaching?payment=success&session_type=${sessionType}&request_id=${requestId || ""}`,
      cancel_url: `${origin}/coaching?payment=cancelled`,
      metadata: {
        session_type: sessionType,
        request_id: requestId || "",
        user_id: user.id,
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
