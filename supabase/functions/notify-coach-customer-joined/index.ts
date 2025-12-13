import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { isValidUUID, sanitizeForHtml } from "../_shared/validation.ts";
import { checkRateLimit, getClientIP, rateLimitExceededResponse } from "../_shared/rate-limit.ts";
import { getCorsWithSecurityHeaders } from "../_shared/security-headers.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = getCorsWithSecurityHeaders();

// Rate limit: 10 requests per minute per IP
const RATE_LIMIT_CONFIG = {
  maxRequests: 10,
  windowMs: 60 * 1000,
  keyPrefix: "notify-coach",
};

interface NotifyRequest {
  chatSessionId: string;
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

    const { chatSessionId }: NotifyRequest = await req.json();

    if (!isValidUUID(chatSessionId)) {
      console.error("Invalid chatSessionId:", chatSessionId);
      return new Response(
        JSON.stringify({ error: "Invalid chatSessionId format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Notifying coach that customer joined:", chatSessionId);

    // Get chat session with coach info
    const { data: chatSession, error: sessionError } = await supabase
      .from("coach_chat_sessions")
      .select(`
        id,
        coach_id,
        customer_id,
        request_id
      `)
      .eq("id", chatSessionId)
      .single();

    if (sessionError || !chatSession) {
      console.error("Chat session not found:", sessionError);
      return new Response(
        JSON.stringify({ error: "Chat session not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get coach details including user_id for email
    const { data: coach, error: coachError } = await supabase
      .from("coaches")
      .select("id, display_name, user_id")
      .eq("id", chatSession.coach_id)
      .single();

    if (coachError || !coach) {
      console.error("Coach not found:", coachError);
      return new Response(
        JSON.stringify({ error: "Coach not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get coach's email from profiles
    const { data: coachProfile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", coach.user_id)
      .single();

    if (!coachProfile?.email) {
      console.error("Coach email not found");
      return new Response(
        JSON.stringify({ error: "Coach email not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get customer name for personalization
    const { data: customerProfile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", chatSession.customer_id)
      .single();

    const rawCustomerName = customerProfile?.email?.split("@")[0] || "A customer";
    const customerName = sanitizeForHtml(rawCustomerName);
    const safeCoachName = sanitizeForHtml(coach.display_name);

    // Build the chat URL for coach
    const chatUrl = `${supabaseUrl.replace(".supabase.co", ".lovable.app")}/coaching-chat/${chatSessionId}`;

    // Send email to coach
    const emailContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🎯 Customer Joined Your Chat!</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 16px 16px;">
          <p style="font-size: 16px; color: #374151;">Hi ${safeCoachName},</p>
          <p style="font-size: 16px; color: #374151;">
            <strong>${customerName}</strong> has joined your coaching chat session and is ready to start!
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${chatUrl}" style="display: inline-block; background: #10b981; color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
              Open Chat Now
            </a>
          </div>

          <div style="background: #ecfdf5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #065f46;">
              <strong>💡 Tip:</strong> Start the session timer when you're ready to begin. You can extend the session if needed.
            </p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">
          <p style="font-size: 12px; color: #9ca3af; text-align: center;">
            DuoDrive Coach Portal
          </p>
        </div>
      </div>
    `;

    const emailPromises: Promise<any>[] = [];

    // Send email notification
    emailPromises.push(
      resend.emails.send({
        from: "DuoDrive <onboarding@resend.dev>",
        to: [coachProfile.email],
        subject: "🎯 Customer Ready for Chat - Join Now!",
        html: emailContent,
      })
    );

    // Send SMS to coach if they have phone number in their profile
    // First, check if coach has a phone number stored (we need to add this capability)
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

    // Get coach's phone from coaching_requests (where coach claimed a request that had their phone)
    // Or we could store coach phone separately - for now use request phone as fallback
    const { data: coachRequest } = await supabase
      .from("coaching_requests")
      .select("phone_number")
      .eq("coach_id", coach.id)
      .eq("id", chatSession.request_id)
      .single();

    // Note: This gets customer phone, not coach phone. 
    // For coach SMS, we'd need coaches table to have phone_number column
    // For now, we'll skip coach SMS and rely on email + push notifications
    // TODO: Add phone_number to coaches table for coach SMS notifications

    const results = await Promise.allSettled(emailPromises);
    console.log("Coach notification results:", results);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Coach notified",
        notificationData: {
          title: "Customer Ready!",
          body: `${customerName} has joined your chat session`,
          chatUrl,
          coachUserId: coach.user_id
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error notifying coach:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to notify coach";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
