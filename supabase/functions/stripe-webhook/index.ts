import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Get the raw body for signature verification
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    
    // Get webhook secret if configured (optional but recommended for production)
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    let event: Stripe.Event;
    
    if (webhookSecret && signature) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
        logStep("Signature verified");
      } catch (err) {
        logStep("Signature verification failed", { error: String(err) });
        return new Response(JSON.stringify({ error: "Webhook signature verification failed" }), {
          status: 400,
        });
      }
    } else {
      // Parse without verification (for development)
      event = JSON.parse(body);
      logStep("Parsed event without signature verification (dev mode)");
    }

    logStep("Processing event", { type: event.type, id: event.id });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const requestId = session.metadata?.request_id;
        const sessionType = session.metadata?.session_type;
        const customerId = session.customer as string;
        
        logStep("Checkout completed", { requestId, sessionType, customerId });

        if (requestId) {
          // Determine payment status based on session type
          const paymentStatus = sessionType === "video" ? "deposit_paid" : "fully_paid";
          
          const { error } = await supabaseClient
            .from("coaching_requests")
            .update({
              payment_status: paymentStatus,
              stripe_customer_id: customerId,
              stripe_payment_intent_id: session.payment_intent as string,
              deposit_paid_at: new Date().toISOString(),
            })
            .eq("id", requestId);

          if (error) {
            logStep("Failed to update request", { error: error.message });
          } else {
            logStep("Updated request payment status", { requestId, paymentStatus });
          }
        }
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const requestId = paymentIntent.metadata?.request_id;
        const chargeType = paymentIntent.metadata?.charge_type;
        
        logStep("Payment succeeded", { requestId, chargeType });

        if (requestId && chargeType === "concierge_remaining") {
          const { error } = await supabaseClient
            .from("coaching_requests")
            .update({
              payment_status: "fully_paid",
              remaining_charged_at: new Date().toISOString(),
            })
            .eq("id", requestId);

          if (error) {
            logStep("Failed to update remaining payment", { error: error.message });
          } else {
            logStep("Updated to fully paid", { requestId });
          }
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const requestId = paymentIntent.metadata?.request_id;
        
        logStep("Payment failed", { requestId });

        if (requestId) {
          const { error } = await supabaseClient
            .from("coaching_requests")
            .update({ payment_status: "failed" })
            .eq("id", requestId);

          if (error) {
            logStep("Failed to update failed status", { error: error.message });
          }
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = charge.payment_intent as string;
        
        logStep("Charge refunded", { paymentIntentId });

        if (paymentIntentId) {
          const { error } = await supabaseClient
            .from("coaching_requests")
            .update({ payment_status: "refunded" })
            .eq("stripe_payment_intent_id", paymentIntentId);

          if (error) {
            logStep("Failed to update refund status", { error: error.message });
          }
        }
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
