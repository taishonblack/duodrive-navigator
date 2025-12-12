import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getCorsWithSecurityHeaders } from "../_shared/security-headers.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = getCorsWithSecurityHeaders();

interface NotifyRequest {
  chatSessionId: string;
}

const isValidUUID = (id: unknown): id is string => {
  if (typeof id !== "string") return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { chatSessionId }: NotifyRequest = await req.json();

    if (!isValidUUID(chatSessionId)) {
      console.error("Invalid chatSessionId:", chatSessionId);
      return new Response(
        JSON.stringify({ error: "Invalid chatSessionId format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Notifying customer for chat session:", chatSessionId);

    // Get the chat session with request and coach info
    const { data: chatSession, error: sessionError } = await supabase
      .from("coach_chat_sessions")
      .select(`
        id,
        customer_id,
        request_id,
        coach_id
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

    // Get customer email from coaching_requests (NOT exposing to coach via response)
    const { data: request, error: requestError } = await supabase
      .from("coaching_requests")
      .select("email, phone_number, scheduled_date, scheduled_time")
      .eq("id", chatSession.request_id)
      .single();

    if (requestError || !request) {
      console.error("Request not found:", requestError);
      return new Response(
        JSON.stringify({ error: "Request not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get coach name for the email
    const { data: coach, error: coachError } = await supabase
      .from("coaches")
      .select("display_name")
      .eq("id", chatSession.coach_id)
      .single();

    const coachName = coach?.display_name || "Your coach";

    // Get customer profile for personalization
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", chatSession.customer_id)
      .single();

    const customerName = profile?.email?.split("@")[0] || "there";

    // Build the DuoDrive chat URL
    const chatUrl = `${supabaseUrl.replace(".supabase.co", ".lovable.app")}/coaching-chat/${chatSessionId}`;

    // Send email notification
    const emailContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🚗 Your Coach is Ready!</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 16px 16px;">
          <p style="font-size: 16px; color: #374151;">Hi ${customerName},</p>
          <p style="font-size: 16px; color: #374151;">
            Great news! <strong>${coachName}</strong> is ready to help you with your car deal. 
            Click the button below to start your text coaching session.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${chatUrl}" style="display: inline-block; background: #f97316; color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
              Start Chat Session
            </a>
          </div>

          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #92400e;">
              <strong>⏰ Your session is 10 minutes.</strong> Have your deal information ready to make the most of your time!
            </p>
          </div>

          <p style="font-size: 14px; color: #6b7280;">
            Your coach is waiting in the DuoDrive chat. All conversations are secure and your contact info remains private.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">
          <p style="font-size: 12px; color: #9ca3af; text-align: center;">
            DuoDrive — Your advocate in car buying
          </p>
        </div>
      </div>
    `;

    const emailPromises: Promise<any>[] = [];

    // Send email
    emailPromises.push(
      resend.emails.send({
        from: "DuoDrive <onboarding@resend.dev>",
        to: [request.email],
        subject: "🚗 Your Coach is Ready to Chat!",
        html: emailContent,
      })
    );

    // Send SMS via Twilio if configured
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber && request.phone_number) {
      const smsBody = `DuoDrive: ${coachName} is ready to help with your car deal! Start your chat session: ${chatUrl}`;
      
      emailPromises.push(
        fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`, {
          method: "POST",
          headers: {
            "Authorization": `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: request.phone_number,
            From: twilioPhoneNumber,
            Body: smsBody,
          }),
        }).then(res => res.json())
      );
    }

    // Update chat session status to ready
    await supabase
      .from("coach_chat_sessions")
      .update({ status: "ready" })
      .eq("id", chatSessionId);

    const results = await Promise.allSettled(emailPromises);
    console.log("Notification results:", results);

    return new Response(
      JSON.stringify({ success: true, message: "Customer notified via email and SMS" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error notifying customer:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to notify customer";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
