import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-PAYMENT-NOTIFICATION] ${step}${detailsStr}`);
};

interface PaymentNotificationRequest {
  requestId: string;
  notificationType: "payment_received" | "payment_failed" | "refund_processed";
  amount?: number;
  sessionType?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { requestId, notificationType, amount, sessionType }: PaymentNotificationRequest = await req.json();
    
    logStep("Sending payment notification", { requestId, notificationType });

    // Get the coaching request with customer email
    const { data: request, error: requestError } = await supabaseClient
      .from("coaching_requests")
      .select("email, session_type, scheduled_date, scheduled_time")
      .eq("id", requestId)
      .single();

    if (requestError || !request) {
      throw new Error("Coaching request not found");
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      logStep("RESEND_API_KEY not configured, skipping email");
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const resend = new Resend(resendKey);

    const sessionTypeNames: Record<string, string> = {
      text: "Quick Text Help",
      phone: "Live Phone Session",
      video: "Full Concierge",
    };

    const sessionName = sessionTypeNames[sessionType || request.session_type] || request.session_type;
    const formattedDate = new Date(request.scheduled_date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    let subject = "";
    let htmlContent = "";

    switch (notificationType) {
      case "payment_received":
        subject = "Payment Confirmed - Your DuoDrive Coaching Session";
        htmlContent = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #22c55e; margin-bottom: 24px;">✓ Payment Received</h1>
            <p style="color: #555; font-size: 16px; line-height: 1.6;">
              Thank you! Your payment${amount ? ` of <strong>$${(amount / 100).toFixed(2)}</strong>` : ''} for your <strong>${sessionName}</strong> coaching session has been confirmed.
            </p>
            <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 24px 0;">
              <p style="margin: 0; color: #333;"><strong>Session Details:</strong></p>
              <p style="margin: 8px 0 0 0; color: #555;">📅 ${formattedDate}</p>
              <p style="margin: 4px 0 0 0; color: #555;">🕐 ${request.scheduled_time}</p>
            </div>
            <p style="color: #555; font-size: 16px; line-height: 1.6;">
              A coach will be assigned to your session soon. We'll notify you when your session is ready to begin.
            </p>
            <p style="color: #888; font-size: 14px; margin-top: 32px;">
              — The DuoDrive Team
            </p>
          </div>
        `;
        break;

      case "payment_failed":
        subject = "Payment Issue - Action Required";
        htmlContent = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #ef4444; margin-bottom: 24px;">⚠️ Payment Failed</h1>
            <p style="color: #555; font-size: 16px; line-height: 1.6;">
              Unfortunately, we were unable to process your payment for the <strong>${sessionName}</strong> coaching session.
            </p>
            <p style="color: #555; font-size: 16px; line-height: 1.6;">
              Please update your payment method and try again, or contact us if you need assistance.
            </p>
            <div style="margin: 24px 0;">
              <a href="https://duodrive.app/coaching" style="display: inline-block; background: #f97316; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
                Update Payment
              </a>
            </div>
            <p style="color: #888; font-size: 14px; margin-top: 32px;">
              — The DuoDrive Team
            </p>
          </div>
        `;
        break;

      case "refund_processed":
        subject = "Refund Processed - DuoDrive Coaching";
        htmlContent = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #3b82f6; margin-bottom: 24px;">Refund Processed</h1>
            <p style="color: #555; font-size: 16px; line-height: 1.6;">
              Your refund${amount ? ` of <strong>$${(amount / 100).toFixed(2)}</strong>` : ''} for the <strong>${sessionName}</strong> coaching session has been processed.
            </p>
            <p style="color: #555; font-size: 16px; line-height: 1.6;">
              The refund should appear in your account within 5-10 business days, depending on your bank.
            </p>
            <p style="color: #555; font-size: 16px; line-height: 1.6;">
              We're sorry to see you go! If you'd like to book another session in the future, we'd be happy to help.
            </p>
            <p style="color: #888; font-size: 14px; margin-top: 32px;">
              — The DuoDrive Team
            </p>
          </div>
        `;
        break;
    }

    const { error: emailError } = await resend.emails.send({
      from: "DuoDrive <onboarding@resend.dev>",
      to: [request.email],
      subject,
      html: htmlContent,
    });

    if (emailError) {
      throw emailError;
    }

    logStep("Email sent successfully", { to: request.email, type: notificationType });

    return new Response(JSON.stringify({ success: true }), {
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
