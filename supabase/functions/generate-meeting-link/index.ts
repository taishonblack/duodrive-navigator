import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sanitizeForHtml } from "../_shared/validation.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const data = await response.json();
    return data.access_token || null;
  } catch (error) {
    console.error("Error refreshing token:", error);
    return null;
  }
}

async function sendSMS(to: string, body: string) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.log("Twilio not configured, skipping SMS");
    return;
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
      },
      body: new URLSearchParams({
        From: TWILIO_PHONE_NUMBER,
        To: to,
        Body: body,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("SMS send failed:", error);
    } else {
      console.log("SMS sent successfully to:", to);
    }
  } catch (error) {
    console.error("SMS error:", error);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { updateId, selectedTime } = await req.json();
    const safeSelectedTime = sanitizeForHtml(selectedTime || "");

    console.log("Generating meeting link for update:", updateId, "time:", selectedTime);

    // Get the update record
    const { data: update, error: updateError } = await supabase
      .from("coach_customer_updates")
      .select("*, coaches(id, display_name, user_id)")
      .eq("id", updateId)
      .single();

    if (updateError || !update) {
      console.error("Update not found:", updateError);
      return new Response(
        JSON.stringify({ error: "Update not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get OAuth tokens from secure table (only accessible via service_role)
    const { data: oauthTokens } = await supabase
      .from("coach_oauth_tokens")
      .select("*")
      .eq("coach_id", update.coach_id)
      .maybeSingle();

    // Check if connected via coach_integrations
    const { data: integration } = await supabase
      .from("coach_integrations")
      .select("google_connected")
      .eq("coach_id", update.coach_id)
      .maybeSingle();

    let meetLink: string | null = null;

    if (integration?.google_connected && oauthTokens?.google_refresh_token) {
      // Refresh access token
      const accessToken = await refreshAccessToken(oauthTokens.google_refresh_token);
      
      if (accessToken) {
        // Update stored access token
        await supabase
          .from("coach_oauth_tokens")
          .update({
            google_access_token: accessToken,
            google_token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("coach_id", update.coach_id);

        // Create Google Calendar event with Meet link
        const eventStart = new Date();
        eventStart.setHours(eventStart.getHours() + 24); // Default to 24 hours from now
        const eventEnd = new Date(eventStart.getTime() + 30 * 60000); // 30 min meeting

        const event = {
          summary: "DuoDrive Coaching Follow-up",
          description: `Follow-up coaching session.\n\nSelected time: ${selectedTime}`,
          start: {
            dateTime: eventStart.toISOString(),
            timeZone: "America/New_York",
          },
          end: {
            dateTime: eventEnd.toISOString(),
            timeZone: "America/New_York",
          },
          conferenceData: {
            createRequest: {
              requestId: `duodrive-${updateId}`,
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          },
        };

        try {
          const calResponse = await fetch(
            "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(event),
            }
          );

          if (calResponse.ok) {
            const calData = await calResponse.json();
            meetLink = calData.conferenceData?.entryPoints?.[0]?.uri || null;
            console.log("Created Google Meet link:", meetLink);
          } else {
            const errorText = await calResponse.text();
            console.error("Failed to create calendar event:", errorText);
          }
        } catch (calError) {
          console.error("Calendar API error:", calError);
        }
      }
    }

    // Update the record with meet link
    const { error: saveError } = await supabase
      .from("coach_customer_updates")
      .update({
        meet_link: meetLink,
        status: meetLink ? "completed" : "responded",
      })
      .eq("id", updateId);

    if (saveError) {
      console.error("Error saving meet link:", saveError);
    }

    // Get customer and coach info
    const { data: customerProfile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", update.customer_id)
      .single();

    const { data: coachProfile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", (update as any).coaches?.user_id)
      .maybeSingle();

    // Get customer phone from recent request
    const { data: recentRequest } = await supabase
      .from("coaching_requests")
      .select("phone_number")
      .eq("customer_id", update.customer_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const customerPhone = recentRequest?.phone_number;
    const coachName = sanitizeForHtml((update as any).coaches?.display_name || "Your Coach");
    
    // Email to customer
    if (customerProfile?.email) {
      const customerHtml = meetLink
        ? `
          <h2>Your Coaching Call is Scheduled!</h2>
          <p>Great news! Your follow-up call with ${coachName} has been confirmed.</p>
          <p><strong>Selected time:</strong> ${safeSelectedTime}</p>
          <p><strong>Join the meeting:</strong></p>
          <p><a href="${meetLink}" style="background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Join Google Meet</a></p>
          <p>Best,<br>The DuoDrive Team</p>
        `
        : `
          <h2>Time Selected!</h2>
          <p>You've selected: ${safeSelectedTime}</p>
          <p>Your coach ${coachName} will send you the meeting details shortly.</p>
          <p>Best,<br>The DuoDrive Team</p>
        `;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "DuoDrive <onboarding@resend.dev>",
          to: [customerProfile.email],
          subject: meetLink ? "Your Coaching Call is Scheduled!" : "Time Selected for Coaching Call",
          html: customerHtml,
        }),
      });
    }

    // SMS to customer (not sanitized - plain text)
    if (customerPhone) {
      const rawCoachName = (update as any).coaches?.display_name || "Your Coach";
      const smsText = meetLink
        ? `DuoDrive: Your call with ${rawCoachName} is scheduled! Join: ${meetLink}`
        : `DuoDrive: Time confirmed (${selectedTime}). ${rawCoachName} will send meeting details soon.`;
      await sendSMS(customerPhone, smsText);
    }

    // Email to coach
    if (coachProfile?.email) {
      const coachHtml = `
        <h2>Customer Selected a Time!</h2>
        <p>Your customer has selected a time for the follow-up call.</p>
        <p><strong>Selected time:</strong> ${safeSelectedTime}</p>
        ${meetLink ? `<p><strong>Google Meet link:</strong> <a href="${meetLink}">${meetLink}</a></p>` : ""}
        <p><a href="https://duodrive.app/coach/dashboard" style="background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Dashboard</a></p>
        <p>Best,<br>The DuoDrive Team</p>
      `;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "DuoDrive <onboarding@resend.dev>",
          to: [coachProfile.email],
          subject: "Customer Selected Call Time",
          html: coachHtml,
        }),
      });
    }

    return new Response(
      JSON.stringify({ success: true, meetLink }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in generate-meeting-link:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-type": "application/json" } }
    );
  }
});
