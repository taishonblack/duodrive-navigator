import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface DealUnlockRequest {
  dealId: string;
  userEmail: string;
  dealName: string;
  paymentIntentId: string;
  amount: number;
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-DEAL-UNLOCK-EMAIL] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { dealId, userEmail, dealName, paymentIntentId, amount }: DealUnlockRequest = await req.json();
    
    logStep("Sending deal unlock email", { dealId, userEmail, dealName });

    if (!userEmail || !dealId) {
      throw new Error("Missing required fields: dealId or userEmail");
    }

    const formattedAmount = (amount / 100).toFixed(2);
    const formattedDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Deal Analysis Unlocked</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #1e293b; padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">DuoDrive</h1>
              <p style="margin: 8px 0 0; color: #94a3b8; font-size: 14px;">Your Car Buying Advisor</p>
            </td>
          </tr>
          
          <!-- Success Icon -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <div style="width: 80px; height: 80px; background-color: #dcfce7; border-radius: 50%; margin: 0 auto; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 40px; line-height: 80px;">✓</span>
              </div>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 0 40px 30px; text-align: center;">
              <h2 style="margin: 0 0 16px; color: #1e293b; font-size: 24px; font-weight: bold;">Deal Analysis Unlocked!</h2>
              <p style="margin: 0; color: #64748b; font-size: 16px; line-height: 1.6;">
                Great news! Your deal analysis has been unlocked. You now have full access to premium features for this deal.
              </p>
            </td>
          </tr>
          
          <!-- Deal Details Box -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                <tr>
                  <td style="padding: 24px;">
                    <h3 style="margin: 0 0 16px; color: #1e293b; font-size: 16px; font-weight: 600;">Purchase Details</h3>
                    
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Deal</td>
                        <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600; text-align: right;">${dealName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Date</td>
                        <td style="padding: 8px 0; color: #1e293b; font-size: 14px; text-align: right;">${formattedDate}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Receipt ID</td>
                        <td style="padding: 8px 0; color: #1e293b; font-size: 14px; text-align: right; font-family: monospace;">${paymentIntentId.slice(0, 20)}...</td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding-top: 16px; border-top: 1px solid #e2e8f0;"></td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #1e293b; font-size: 16px; font-weight: 600;">Amount Paid</td>
                        <td style="padding: 8px 0; color: #22c55e; font-size: 20px; font-weight: bold; text-align: right;">$${formattedAmount}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Features Unlocked -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <h3 style="margin: 0 0 16px; color: #1e293b; font-size: 16px; font-weight: 600;">What You've Unlocked:</h3>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 12px 16px; background-color: #fef3c7; border-radius: 8px; margin-bottom: 8px;">
                    <p style="margin: 0; color: #92400e; font-size: 14px;">
                      <strong>📊 Fee Breakdown</strong> - See exactly what dealer fees are hidden in your deal
                    </p>
                  </td>
                </tr>
                <tr><td style="height: 8px;"></td></tr>
                <tr>
                  <td style="padding: 12px 16px; background-color: #dbeafe; border-radius: 8px;">
                    <p style="margin: 0; color: #1e40af; font-size: 14px;">
                      <strong>🗣️ Negotiation Scripts</strong> - AI-powered scripts to help you negotiate the best price
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 40px 40px; text-align: center;">
              <a href="https://duodrive-deal-guardian.lovable.app/deal-room?dealId=${dealId}" 
                 style="display: inline-block; background-color: #1e293b; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                View Your Deal Analysis →
              </a>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 8px; color: #64748b; font-size: 14px;">
                Thank you for choosing DuoDrive!
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                Questions? Contact us at <a href="mailto:support@duodrive.app" style="color: #3b82f6;">support@duodrive.app</a>
              </p>
            </td>
          </tr>
        </table>
        
        <!-- Legal Footer -->
        <table width="600" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding: 24px 40px; text-align: center;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                © ${new Date().getFullYear()} DuoDrive. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const { data, error } = await resend.emails.send({
      from: "DuoDrive <noreply@resend.dev>",
      to: [userEmail],
      subject: `🎉 Deal Analysis Unlocked - ${dealName}`,
      html: emailHtml,
    });

    if (error) {
      logStep("Failed to send email", { error: error.message });
      throw new Error(`Failed to send email: ${error.message}`);
    }

    logStep("Email sent successfully", { emailId: data?.id });

    return new Response(JSON.stringify({ success: true, emailId: data?.id }), {
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
