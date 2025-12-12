import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHARGE-CONCIERGE-REMAINING] ${step}${detailsStr}`);
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
    logStep("Function started");

    const { requestId, customerId } = await req.json();
    logStep("Received request", { requestId, customerId });

    if (!requestId || !customerId) {
      throw new Error("Missing required parameters: requestId and customerId");
    }

    // Initialize Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    logStep("Stripe initialized");

    // Get customer profile to find their email
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("email")
      .eq("id", customerId)
      .single();

    if (profileError || !profile?.email) {
      throw new Error("Could not find customer profile");
    }
    logStep("Found customer profile", { email: profile.email });

    // Find the Stripe customer
    const customers = await stripe.customers.list({ email: profile.email, limit: 1 });
    if (customers.data.length === 0) {
      throw new Error("No Stripe customer found for this user");
    }

    const stripeCustomerId = customers.data[0].id;
    logStep("Found Stripe customer", { stripeCustomerId });

    // Get the customer's default payment method
    const customer = await stripe.customers.retrieve(stripeCustomerId);
    if (customer.deleted) {
      throw new Error("Stripe customer has been deleted");
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: "card",
      limit: 1,
    });

    if (paymentMethods.data.length === 0) {
      throw new Error("No saved payment method found for customer");
    }

    const paymentMethodId = paymentMethods.data[0].id;
    logStep("Found payment method", { paymentMethodId });

    // Charge the remaining 80% ($399.20)
    const remainingAmount = 39920; // $399.20 in cents

    const paymentIntent = await stripe.paymentIntents.create({
      amount: remainingAmount,
      currency: "usd",
      customer: stripeCustomerId,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      description: "Full Concierge - Remaining Balance (80%)",
      metadata: {
        request_id: requestId,
        customer_id: customerId,
        charge_type: "concierge_remaining",
      },
    });

    logStep("Payment successful", { 
      paymentIntentId: paymentIntent.id, 
      status: paymentIntent.status,
      amount: remainingAmount 
    });

    return new Response(JSON.stringify({ 
      success: true, 
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      amount: remainingAmount,
    }), {
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
