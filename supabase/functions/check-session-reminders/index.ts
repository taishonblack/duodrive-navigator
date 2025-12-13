import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SESSION-REMINDERS] ${step}${detailsStr}`);
};

// Send SMS via Twilio
async function sendSMS(to: string, body: string): Promise<boolean> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const fromNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

  if (!accountSid || !authToken || !fromNumber) {
    logStep("Twilio credentials not configured");
    return false;
  }

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        },
        body: new URLSearchParams({
          To: to,
          From: fromNumber,
          Body: body,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      logStep("Twilio SMS failed", { error });
      return false;
    }

    logStep("SMS sent successfully", { to });
    return true;
  } catch (error) {
    logStep("SMS send error", { error: String(error) });
    return false;
  }
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
    logStep("Checking for upcoming sessions");

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const resend = resendKey ? new Resend(resendKey) : null;

    // Get current time and 15 minutes from now
    const now = new Date();
    const in15Minutes = new Date(now.getTime() + 15 * 60 * 1000);
    const in20Minutes = new Date(now.getTime() + 20 * 60 * 1000);

    // Format for comparison (we need to check sessions starting in ~15 minutes)
    const todayDate = now.toISOString().split("T")[0];

    // Get coaching requests scheduled for today that haven't been reminded yet
    const { data: requests, error: requestsError } = await supabaseClient
      .from("coaching_requests")
      .select("id, email, phone_number, customer_id, session_type, scheduled_date, scheduled_time, coach_id, coaches(display_name)")
      .eq("scheduled_date", todayDate)
      .in("status", ["claimed", "in_progress"])
      .in("payment_status", ["fully_paid", "deposit_paid"]);

    if (requestsError) {
      logStep("Failed to fetch requests", { error: requestsError.message });
      throw requestsError;
    }

    logStep("Found requests for today", { count: requests?.length || 0 });

    let sentCount = 0;

    for (const request of requests || []) {
      // Parse scheduled time
      const [hours, minutes] = request.scheduled_time.split(":").map(Number);
      const scheduledDateTime = new Date(request.scheduled_date);
      scheduledDateTime.setHours(hours, minutes, 0, 0);

      // Check if session is 15-20 minutes away (allows for cron timing variance)
      const timeDiff = scheduledDateTime.getTime() - now.getTime();
      const minutesUntilSession = timeDiff / (1000 * 60);

      if (minutesUntilSession >= 10 && minutesUntilSession <= 20) {
        logStep("Sending reminder", { 
          requestId: request.id, 
          minutesUntil: minutesUntilSession.toFixed(1) 
        });

        const sessionTypeNames: Record<string, string> = {
          text: "Quick Text Help",
          phone: "Live Phone Session",
          video: "Full Concierge",
        };

        const sessionName = sessionTypeNames[request.session_type] || request.session_type;
        const formattedTime = scheduledDateTime.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
        
        // Get coach display name (coaches is an object from foreign key join)
        const coachName = (request.coaches as any)?.display_name || null;

        try {
          // Send email if Resend is configured
          if (resend) {
            await resend.emails.send({
              from: "DuoDrive <onboarding@resend.dev>",
              to: [request.email],
              subject: `⏰ Your Coaching Session Starts in 15 Minutes!`,
              html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h1 style="color: #f97316; margin-bottom: 24px;">Session Starting Soon!</h1>
                  <p style="color: #555; font-size: 16px; line-height: 1.6;">
                    Your <strong>${sessionName}</strong> coaching session is starting in approximately <strong>15 minutes</strong>.
                  </p>
                  <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 24px 0; border-left: 4px solid #f97316;">
                    <p style="margin: 0; color: #333;"><strong>Session Time:</strong> ${formattedTime}</p>
                    <p style="margin: 8px 0 0 0; color: #333;"><strong>Session Type:</strong> ${sessionName}</p>
                    ${coachName ? `<p style="margin: 8px 0 0 0; color: #333;"><strong>Coach:</strong> ${coachName}</p>` : ''}
                  </div>
                  <p style="color: #555; font-size: 16px; line-height: 1.6;">
                    Please make sure you're ready and have a stable internet connection.
                  </p>
                  <div style="margin: 24px 0;">
                    <a href="https://duodrive.app/coaching" style="display: inline-block; background: #f97316; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
                      Go to DuoDrive
                    </a>
                  </div>
                  <p style="color: #888; font-size: 14px; margin-top: 32px;">
                    — The DuoDrive Team
                  </p>
                </div>
              `,
            });
            logStep("Email reminder sent", { requestId: request.id, email: request.email });
          }

          // Send SMS if phone number exists and user has SMS enabled
          if (request.phone_number && request.customer_id) {
            // Check user's SMS preference
            const { data: prefs } = await supabaseClient
              .from("notification_preferences")
              .select("sms_reminders")
              .eq("user_id", request.customer_id)
              .single();

            const smsEnabled = prefs?.sms_reminders ?? true;
            
            if (smsEnabled) {
              const smsBody = `DuoDrive: Your ${sessionName} session starts in 15 minutes at ${formattedTime}. Go to https://duodrive.app/coaching to join.`;
              const smsSent = await sendSMS(request.phone_number, smsBody);
              if (smsSent) {
                logStep("SMS reminder sent", { requestId: request.id });
              }
            } else {
              logStep("SMS skipped - user opted out", { requestId: request.id });
            }
          }

          sentCount++;
        } catch (emailError) {
          logStep("Failed to send reminder", { 
            requestId: request.id, 
            error: String(emailError) 
          });
        }
      }
    }

    logStep("Reminder check complete", { sentCount });

    return new Response(JSON.stringify({ 
      success: true, 
      reminders_sent: sentCount 
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
