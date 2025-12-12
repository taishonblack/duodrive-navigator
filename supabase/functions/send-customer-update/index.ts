import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sanitizeForHtml } from "../_shared/validation.ts";
import { checkRateLimit, getClientIP, rateLimitExceededResponse } from "../_shared/rate-limit.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limit: 5 requests per minute per IP (coaches sending updates)
const RATE_LIMIT_CONFIG = {
  maxRequests: 5,
  windowMs: 60 * 1000,
  keyPrefix: "send-customer-update",
};

interface UpdateRequest {
  updateId: string;
  customerId: string;
  coachName: string;
  message: string;
  updateType: "update" | "schedule_request";
  proposedTimes?: string[];
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

  // Check rate limit
  const clientIP = getClientIP(req);
  const rateLimitResult = checkRateLimit(clientIP, RATE_LIMIT_CONFIG);
  
  if (!rateLimitResult.allowed) {
    console.log("Rate limit exceeded for IP:", clientIP);
    return rateLimitExceededResponse(rateLimitResult, corsHeaders);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { updateId, customerId, coachName, message, updateType, proposedTimes }: UpdateRequest = await req.json();

    console.log("Sending customer update notification:", { updateId, customerId, updateType });

    // Sanitize user-provided content for HTML embedding
    const safeCoachName = sanitizeForHtml(coachName);
    const safeMessage = sanitizeForHtml(message);
    const safeTimes = proposedTimes?.map(t => sanitizeForHtml(t)) || [];

    // Get customer email and phone from profiles and coaching_requests
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", customerId)
      .single();

    if (profileError || !profile?.email) {
      console.error("Failed to get customer profile:", profileError);
      return new Response(
        JSON.stringify({ error: "Customer profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try to get phone number from most recent coaching request
    const { data: recentRequest } = await supabase
      .from("coaching_requests")
      .select("phone_number")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const customerPhone = recentRequest?.phone_number;

    const dashboardUrl = "https://duodrive.app/dashboard";

    let subject: string;
    let htmlContent: string;
    let smsText: string;

    if (updateType === "schedule_request") {
      subject = `Your DuoDrive Coach wants to schedule a call`;
      const timesHtml = safeTimes.map(t => `<li>${t}</li>`).join("") || "";
      htmlContent = `
        <h2>Schedule Request from Your Coach</h2>
        <p>Hi there,</p>
        <p>Your DuoDrive coach <strong>${safeCoachName}</strong> would like to schedule a follow-up call with you.</p>
        <p><strong>Message:</strong></p>
        <p style="background: #f5f5f5; padding: 15px; border-radius: 8px;">${safeMessage}</p>
        ${safeTimes.length ? `
        <p><strong>Proposed times:</strong></p>
        <ul>${timesHtml}</ul>
        ` : ""}
        <p>Please log in to your DuoDrive account to select a time that works for you:</p>
        <p><a href="${dashboardUrl}" style="background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View & Respond</a></p>
        <p>Best,<br>The DuoDrive Team</p>
      `;
      smsText = `DuoDrive: ${coachName} wants to schedule a call. Log in to select a time: ${dashboardUrl}`;
    } else {
      subject = `Update from your DuoDrive Coach`;
      htmlContent = `
        <h2>Update from Your Coach</h2>
        <p>Hi there,</p>
        <p>Your DuoDrive coach <strong>${safeCoachName}</strong> has sent you an update about your car search:</p>
        <p style="background: #f5f5f5; padding: 15px; border-radius: 8px;">${safeMessage}</p>
        <p>Log in to your DuoDrive account to view the full update and respond:</p>
        <p><a href="${dashboardUrl}" style="background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Update</a></p>
        <p>Best,<br>The DuoDrive Team</p>
      `;
      smsText = `DuoDrive: ${coachName} sent you an update. View it at: ${dashboardUrl}`;
    }

    // Send email
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "DuoDrive <onboarding@resend.dev>",
        to: [profile.email],
        subject,
        html: htmlContent,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error("Failed to send email:", errorData);
    } else {
      console.log("Email sent successfully to:", profile.email);
    }

    // Send SMS if phone number available
    if (customerPhone) {
      await sendSMS(customerPhone, smsText);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-customer-update:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
