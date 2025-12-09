import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReminderRequest {
  sessionId?: string;
  requestId?: string;
  reminderType: "session_starting" | "session_claimed" | "session_scheduled";
}

const sessionTypeLabels = {
  text: "Text Coaching",
  phone: "Phone Session", 
  video: "Video Chat",
};

const formatTime = (time: string) => {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? "PM" : "AM";
  const formattedHour = hour % 12 || 12;
  return `${formattedHour}:${minutes} ${ampm}`;
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { sessionId, requestId, reminderType }: ReminderRequest = await req.json();

    console.log("Processing reminder:", { sessionId, requestId, reminderType });

    let customerEmail: string;
    let customerName: string;
    let sessionType: string;
    let scheduledDate: string;
    let scheduledTime: string;
    let coachName: string | null = null;
    let meetLink: string | null = null;
    let maskedPhone: string | null = null;

    if (sessionId) {
      // Fetch session details
      const { data: session, error: sessionError } = await supabase
        .from("coaching_sessions")
        .select(`
          id,
          session_type,
          meet_link,
          masked_phone_number,
          request_id,
          coach_id
        `)
        .eq("id", sessionId)
        .single();

      if (sessionError || !session) {
        console.error("Session not found:", sessionError);
        throw new Error("Session not found");
      }

      // Get request details
      const { data: request, error: requestError } = await supabase
        .from("coaching_requests")
        .select("email, phone_number, scheduled_date, scheduled_time, customer_id")
        .eq("id", session.request_id)
        .single();

      if (requestError || !request) {
        console.error("Request not found:", requestError);
        throw new Error("Request not found");
      }

      // Get coach name
      if (session.coach_id) {
        const { data: coach } = await supabase
          .from("coaches")
          .select("display_name")
          .eq("id", session.coach_id)
          .single();
        coachName = coach?.display_name || null;
      }

      customerEmail = request.email;
      sessionType = session.session_type;
      scheduledDate = request.scheduled_date;
      scheduledTime = request.scheduled_time;
      meetLink = session.meet_link;
      maskedPhone = session.masked_phone_number;

      // Try to get customer name from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", request.customer_id)
        .single();
      customerName = profile?.email?.split("@")[0] || "there";

    } else if (requestId) {
      // Fetch request details directly
      const { data: request, error: requestError } = await supabase
        .from("coaching_requests")
        .select(`
          email,
          phone_number,
          scheduled_date,
          scheduled_time,
          session_type,
          customer_id,
          coach_id
        `)
        .eq("id", requestId)
        .single();

      if (requestError || !request) {
        console.error("Request not found:", requestError);
        throw new Error("Request not found");
      }

      // Get coach name if assigned
      if (request.coach_id) {
        const { data: coach } = await supabase
          .from("coaches")
          .select("display_name")
          .eq("id", request.coach_id)
          .single();
        coachName = coach?.display_name || null;
      }

      customerEmail = request.email;
      sessionType = request.session_type;
      scheduledDate = request.scheduled_date;
      scheduledTime = request.scheduled_time;

      // Try to get customer name
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", request.customer_id)
        .single();
      customerName = profile?.email?.split("@")[0] || "there";
    } else {
      throw new Error("Either sessionId or requestId is required");
    }

    // Build email content based on reminder type
    let subject: string;
    let htmlContent: string;

    const sessionLabel = sessionTypeLabels[sessionType as keyof typeof sessionTypeLabels] || sessionType;
    const formattedDate = formatDate(scheduledDate);
    const formattedTime = formatTime(scheduledTime);

    switch (reminderType) {
      case "session_starting":
        subject = "🚗 Your DuoDrive Coaching Session is Starting Soon!";
        htmlContent = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Your Session Starts Soon!</h1>
            </div>
            <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 16px 16px;">
              <p style="font-size: 16px; color: #374151;">Hi ${customerName},</p>
              <p style="font-size: 16px; color: #374151;">Your <strong>${sessionLabel}</strong> coaching session is about to begin!</p>
              
              <div style="background: #f9fafb; padding: 20px; border-radius: 12px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Session Details:</p>
                <p style="margin: 5px 0; color: #111827;"><strong>📅 Date:</strong> ${formattedDate}</p>
                <p style="margin: 5px 0; color: #111827;"><strong>🕐 Time:</strong> ${formattedTime}</p>
                ${coachName ? `<p style="margin: 5px 0; color: #111827;"><strong>👤 Coach:</strong> ${coachName}</p>` : ""}
              </div>

              ${meetLink ? `
                <div style="text-align: center; margin: 25px 0;">
                  <a href="${meetLink}" style="display: inline-block; background: #16a34a; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                    🎥 Join Video Call
                  </a>
                </div>
              ` : ""}

              ${maskedPhone ? `
                <div style="background: #eff6ff; padding: 20px; border-radius: 12px; margin: 20px 0; text-align: center;">
                  <p style="margin: 0 0 10px 0; color: #1e40af; font-size: 14px;">Call this number to connect:</p>
                  <p style="margin: 0; font-size: 24px; font-weight: bold; color: #1d4ed8; font-family: monospace;">${maskedPhone}</p>
                </div>
              ` : ""}

              <p style="font-size: 14px; color: #6b7280; margin-top: 25px;">
                Have your deal information ready so your coach can help you get the best outcome!
              </p>
              
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">
              <p style="font-size: 12px; color: #9ca3af; text-align: center;">
                DuoDrive — Your advocate in car buying
              </p>
            </div>
          </div>
        `;
        break;

      case "session_claimed":
        subject = "✅ A Coach Has Claimed Your Session!";
        htmlContent = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Coach Assigned!</h1>
            </div>
            <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 16px 16px;">
              <p style="font-size: 16px; color: #374151;">Hi ${customerName},</p>
              <p style="font-size: 16px; color: #374151;">Great news! A coach has been assigned to your <strong>${sessionLabel}</strong> session.</p>
              
              <div style="background: #f9fafb; padding: 20px; border-radius: 12px; margin: 20px 0;">
                ${coachName ? `<p style="margin: 0 0 15px 0; font-size: 18px; color: #111827;"><strong>Your Coach:</strong> ${coachName}</p>` : ""}
                <p style="margin: 5px 0; color: #111827;"><strong>📅 Date:</strong> ${formattedDate}</p>
                <p style="margin: 5px 0; color: #111827;"><strong>🕐 Time:</strong> ${formattedTime}</p>
              </div>

              <p style="font-size: 14px; color: #6b7280;">
                We'll send you another reminder when your session is about to start with connection details.
              </p>
              
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">
              <p style="font-size: 12px; color: #9ca3af; text-align: center;">
                DuoDrive — Your advocate in car buying
              </p>
            </div>
          </div>
        `;
        break;

      case "session_scheduled":
        subject = "📅 Your DuoDrive Coaching Session is Confirmed!";
        htmlContent = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Session Confirmed!</h1>
            </div>
            <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 16px 16px;">
              <p style="font-size: 16px; color: #374151;">Hi ${customerName},</p>
              <p style="font-size: 16px; color: #374151;">Your <strong>${sessionLabel}</strong> coaching session has been scheduled!</p>
              
              <div style="background: #f9fafb; padding: 20px; border-radius: 12px; margin: 20px 0;">
                <p style="margin: 5px 0; color: #111827;"><strong>📅 Date:</strong> ${formattedDate}</p>
                <p style="margin: 5px 0; color: #111827;"><strong>🕐 Time:</strong> ${formattedTime}</p>
              </div>

              <p style="font-size: 14px; color: #6b7280;">
                A coach will be assigned soon, and we'll notify you once that happens. You'll receive connection details before your session starts.
              </p>
              
              <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px; color: #92400e;">
                  <strong>💡 Tip:</strong> Have your dealer quote ready so your coach can review the numbers with you!
                </p>
              </div>
              
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">
              <p style="font-size: 12px; color: #9ca3af; text-align: center;">
                DuoDrive — Your advocate in car buying
              </p>
            </div>
          </div>
        `;
        break;

      default:
        throw new Error("Invalid reminder type");
    }

    // Send the email
    const emailResponse = await resend.emails.send({
      from: "DuoDrive <onboarding@resend.dev>",
      to: [customerEmail],
      subject,
      html: htmlContent,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: unknown) {
    console.error("Error sending reminder:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to send reminder";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
