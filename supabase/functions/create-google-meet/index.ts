import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsWithSecurityHeaders } from "../_shared/security-headers.ts";

const corsHeaders = getCorsWithSecurityHeaders();

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
  const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    console.error("Failed to refresh token:", await response.text());
    return null;
  }

  const data = await response.json();
  return data.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { coachId, requestId, scheduledDate, scheduledTime, customerEmail, sessionDurationMinutes = 30 } = await req.json();

    if (!coachId || !requestId || !scheduledDate || !scheduledTime) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Check if connected via coach_integrations
    const { data: integration, error: integrationError } = await supabase
      .from("coach_integrations")
      .select("google_connected")
      .eq("coach_id", coachId)
      .single();

    if (integrationError || !integration?.google_connected) {
      console.error("Coach integration not found or not connected:", integrationError);
      return new Response(
        JSON.stringify({ error: "Coach has not connected Google Calendar" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get OAuth tokens from secure table (only accessible via service_role)
    const { data: oauthTokens, error: tokenError } = await supabase
      .from("coach_oauth_tokens")
      .select("*")
      .eq("coach_id", coachId)
      .single();

    if (tokenError || !oauthTokens?.google_access_token) {
      console.error("OAuth tokens not found:", tokenError);
      return new Response(
        JSON.stringify({ error: "Google Calendar is not connected" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let accessToken = oauthTokens.google_access_token;

    // Check if token is expired and refresh if needed
    if (new Date(oauthTokens.google_token_expires_at) <= new Date()) {
      console.log("Access token expired, refreshing...");
      const newToken = await refreshAccessToken(oauthTokens.google_refresh_token);
      
      if (!newToken) {
        return new Response(
          JSON.stringify({ error: "Failed to refresh Google access token. Please reconnect Google Calendar." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      accessToken = newToken;

      // Update token in secure database
      await supabase
        .from("coach_oauth_tokens")
        .update({
          google_access_token: newToken,
          google_token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("coach_id", coachId);
    }

    // Create calendar event with Google Meet
    const startDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
    const endDateTime = new Date(startDateTime.getTime() + sessionDurationMinutes * 60 * 1000);

    const calendarEvent = {
      summary: "DuoDrive Coaching Session",
      description: "Video coaching session for car buying assistance via DuoDrive.",
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: "America/New_York",
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: "America/New_York",
      },
      attendees: customerEmail ? [{ email: customerEmail }] : [],
      conferenceData: {
        createRequest: {
          requestId: `duodrive-${requestId}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    };

    console.log("Creating Google Calendar event with Meet link...");

    const calendarResponse = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(calendarEvent),
      }
    );

    if (!calendarResponse.ok) {
      const errorText = await calendarResponse.text();
      console.error("Calendar API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to create calendar event" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const eventData = await calendarResponse.json();
    const meetLink = eventData.hangoutLink;

    console.log("Google Meet link created:", meetLink);

    // Update the coaching session with the meet link
    const { error: sessionUpdateError } = await supabase
      .from("coaching_sessions")
      .update({ meet_link: meetLink })
      .eq("request_id", requestId);

    if (sessionUpdateError) {
      console.warn("Failed to update session with meet link:", sessionUpdateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        meetLink,
        eventId: eventData.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Create meet error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
