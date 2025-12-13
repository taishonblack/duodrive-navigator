import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PROCESS-REFUND] ${step}${detailsStr}`);
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
    logStep("Processing refund request");

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

    const { requestId, reason } = await req.json();
    if (!requestId) throw new Error("Request ID is required");

    logStep("Fetching coaching request", { requestId });

    // Get the coaching request
    const { data: request, error: requestError } = await supabaseClient
      .from("coaching_requests")
      .select("*, profiles:customer_id(email)")
      .eq("id", requestId)
      .single();

    if (requestError || !request) {
      throw new Error("Coaching request not found");
    }

    if (!request.stripe_payment_intent_id) {
      throw new Error("No payment intent found for this request");
    }

    logStep("Found request", { 
      paymentIntentId: request.stripe_payment_intent_id,
      paymentStatus: request.payment_status 
    });

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Process the refund
    const refund = await stripe.refunds.create({
      payment_intent: request.stripe_payment_intent_id,
      reason: "requested_by_customer",
    });

    logStep("Refund created", { refundId: refund.id, status: refund.status });

    // Update the request status
    const { error: updateError } = await supabaseClient
      .from("coaching_requests")
      .update({
        payment_status: "refunded",
        status: "cancelled",
      })
      .eq("id", requestId);

    if (updateError) {
      logStep("Failed to update request status", { error: updateError.message });
    }

    // Send refund email notification
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey && request.email) {
      try {
        const resend = new Resend(resendKey);
        
        const sessionTypeNames: Record<string, string> = {
          text: "Quick Text Help",
          phone: "Live Phone Session",
          video: "Full Concierge",
        };

        await resend.emails.send({
          from: "DuoDrive <onboarding@resend.dev>",
          to: [request.email],
          subject: "Your DuoDrive Coaching Session Has Been Refunded",
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #333; margin-bottom: 24px;">Refund Processed</h1>
              <p style="color: #555; font-size: 16px; line-height: 1.6;">
                Your payment for the <strong>${sessionTypeNames[request.session_type] || request.session_type}</strong> coaching session has been refunded.
              </p>
              ${reason ? `<p style="color: #555; font-size: 16px; line-height: 1.6;"><strong>Reason:</strong> ${reason}</p>` : ''}
              <p style="color: #555; font-size: 16px; line-height: 1.6;">
                The refund should appear in your account within 5-10 business days, depending on your bank.
              </p>
              <p style="color: #555; font-size: 16px; line-height: 1.6;">
                If you have any questions, please don't hesitate to contact us.
              </p>
              <p style="color: #888; font-size: 14px; margin-top: 32px;">
                — The DuoDrive Team
              </p>
            </div>
          `,
        });
        logStep("Refund email sent");
      } catch (emailError) {
        logStep("Failed to send refund email", { error: String(emailError) });
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      refundId: refund.id,
      status: refund.status 
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
