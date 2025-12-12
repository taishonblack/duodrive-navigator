import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { 
  isValidUUID, 
  isValidReminderType, 
  sanitizeForHtml,
  validationErrorResponse,
  type ValidationError 
} from "../_shared/validation.ts";

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

interface DealDetails {
  name: string;
  year: string | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  asking_price: string | null;
  negotiated_price: string | null;
}

function validateRequest(data: unknown): { valid: true; data: ReminderRequest } | { valid: false; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  
  if (!data || typeof data !== "object") {
    return { valid: false, errors: [{ field: "body", message: "Request body must be an object" }] };
  }
  
  const req = data as Record<string, unknown>;
  
  if (!req.sessionId && !req.requestId) {
    errors.push({ field: "sessionId/requestId", message: "Either sessionId or requestId is required" });
  }
  
  if (req.sessionId !== undefined && !isValidUUID(req.sessionId)) {
    errors.push({ field: "sessionId", message: "Invalid sessionId format (must be UUID)" });
  }
  
  if (req.requestId !== undefined && !isValidUUID(req.requestId)) {
    errors.push({ field: "requestId", message: "Invalid requestId format (must be UUID)" });
  }
  
  if (!isValidReminderType(req.reminderType)) {
    errors.push({ field: "reminderType", message: "reminderType must be one of: session_starting, session_claimed, session_scheduled" });
  }
  
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  
  return { valid: true, data: req as unknown as ReminderRequest };
}

const sessionTypeLabels = {
  text: "Text Coaching ($29)",
  phone: "Phone Session ($99)", 
  video: "Video Chat ($499)",
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

const formatPrice = (price: string | null) => {
  if (!price) return null;
  const num = parseFloat(price.replace(/[^0-9.]/g, ""));
  if (isNaN(num)) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(num);
};

const buildDealSection = (deal: DealDetails | null) => {
  if (!deal) return "";
  
  const vehicle = [deal.year, deal.make, deal.model, deal.trim].filter(Boolean).join(" ");
  const askingPrice = formatPrice(deal.asking_price);
  const negotiatedPrice = formatPrice(deal.negotiated_price);
  
  if (!vehicle && !askingPrice) return "";
  
  return `
    <div style="background: #ecfdf5; padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #10b981;">
      <p style="margin: 0 0 10px 0; color: #047857; font-size: 14px; font-weight: 600;">🚗 Deal Details:</p>
      ${deal.name ? `<p style="margin: 5px 0; color: #111827;"><strong>Deal Name:</strong> ${sanitizeForHtml(deal.name)}</p>` : ""}
      ${vehicle ? `<p style="margin: 5px 0; color: #111827;"><strong>Vehicle:</strong> ${sanitizeForHtml(vehicle)}</p>` : ""}
      ${askingPrice ? `<p style="margin: 5px 0; color: #111827;"><strong>Asking Price:</strong> ${askingPrice}</p>` : ""}
      ${negotiatedPrice ? `<p style="margin: 5px 0; color: #111827;"><strong>Negotiated Price:</strong> ${negotiatedPrice}</p>` : ""}
    </div>
  `;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const rawData = await req.json();
    
    const validation = validateRequest(rawData);
    if (!validation.valid) {
      console.error("Validation failed:", validation.errors);
      return validationErrorResponse(validation.errors, corsHeaders);
    }
    
    const { sessionId, requestId, reminderType } = validation.data;

    console.log("Processing reminder:", { sessionId, requestId, reminderType });

    let customerEmail: string;
    let customerName: string;
    let sessionType: string;
    let scheduledDate: string;
    let scheduledTime: string;
    let coachName: string | null = null;
    let meetLink: string | null = null;
    let maskedPhone: string | null = null;
    let dealDetails: DealDetails | null = null;

    if (sessionId) {
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

      const { data: request, error: requestError } = await supabase
        .from("coaching_requests")
        .select("email, phone_number, scheduled_date, scheduled_time, customer_id, deal_id")
        .eq("id", session.request_id)
        .single();

      if (requestError || !request) {
        console.error("Request not found:", requestError);
        throw new Error("Request not found");
      }

      // Fetch deal details if available
      if (request.deal_id) {
        const { data: deal } = await supabase
          .from("deals")
          .select("name, year, make, model, trim, asking_price, negotiated_price")
          .eq("id", request.deal_id)
          .single();
        
        if (deal) {
          dealDetails = deal;
        }
      }

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

      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", request.customer_id)
        .single();
      customerName = profile?.email?.split("@")[0] || "there";

    } else if (requestId) {
      const { data: request, error: requestError } = await supabase
        .from("coaching_requests")
        .select(`
          email,
          phone_number,
          scheduled_date,
          scheduled_time,
          session_type,
          customer_id,
          coach_id,
          deal_id
        `)
        .eq("id", requestId)
        .single();

      if (requestError || !request) {
        console.error("Request not found:", requestError);
        throw new Error("Request not found");
      }

      // Fetch deal details if available
      if (request.deal_id) {
        const { data: deal } = await supabase
          .from("deals")
          .select("name, year, make, model, trim, asking_price, negotiated_price")
          .eq("id", request.deal_id)
          .single();
        
        if (deal) {
          dealDetails = deal;
        }
      }

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

      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", request.customer_id)
        .single();
      customerName = profile?.email?.split("@")[0] || "there";
    } else {
      throw new Error("Either sessionId or requestId is required");
    }

    const safeCustomerName = sanitizeForHtml(customerName);
    const safeCoachName = coachName ? sanitizeForHtml(coachName) : null;

    let subject: string;
    let htmlContent: string;

    const sessionLabel = sessionTypeLabels[sessionType as keyof typeof sessionTypeLabels] || sessionType;
    const formattedDate = formatDate(scheduledDate);
    const formattedTime = formatTime(scheduledTime);
    const dealSection = buildDealSection(dealDetails);

    switch (reminderType) {
      case "session_starting":
        subject = "🚗 Your DuoDrive Coaching Session is Starting Soon!";
        htmlContent = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Your Session Starts Soon!</h1>
            </div>
            <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 16px 16px;">
              <p style="font-size: 16px; color: #374151;">Hi ${safeCustomerName},</p>
              <p style="font-size: 16px; color: #374151;">Your <strong>${sessionLabel}</strong> coaching session is about to begin!</p>
              
              <div style="background: #f9fafb; padding: 20px; border-radius: 12px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Session Details:</p>
                <p style="margin: 5px 0; color: #111827;"><strong>📅 Date:</strong> ${formattedDate}</p>
                <p style="margin: 5px 0; color: #111827;"><strong>🕐 Time:</strong> ${formattedTime}</p>
                ${safeCoachName ? `<p style="margin: 5px 0; color: #111827;"><strong>👤 Coach:</strong> ${safeCoachName}</p>` : ""}
              </div>

              ${dealSection}

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
              <p style="font-size: 16px; color: #374151;">Hi ${safeCustomerName},</p>
              <p style="font-size: 16px; color: #374151;">Great news! A coach has been assigned to your <strong>${sessionLabel}</strong> session.</p>
              
              <div style="background: #f9fafb; padding: 20px; border-radius: 12px; margin: 20px 0;">
                ${safeCoachName ? `<p style="margin: 0 0 15px 0; font-size: 18px; color: #111827;"><strong>Your Coach:</strong> ${safeCoachName}</p>` : ""}
                <p style="margin: 5px 0; color: #111827;"><strong>📅 Date:</strong> ${formattedDate}</p>
                <p style="margin: 5px 0; color: #111827;"><strong>🕐 Time:</strong> ${formattedTime}</p>
              </div>

              ${dealSection}

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
              <p style="font-size: 16px; color: #374151;">Hi ${safeCustomerName},</p>
              <p style="font-size: 16px; color: #374151;">Your <strong>${sessionLabel}</strong> coaching session has been scheduled!</p>
              
              <div style="background: #f9fafb; padding: 20px; border-radius: 12px; margin: 20px 0;">
                <p style="margin: 5px 0; color: #111827;"><strong>📅 Date:</strong> ${formattedDate}</p>
                <p style="margin: 5px 0; color: #111827;"><strong>🕐 Time:</strong> ${formattedTime}</p>
              </div>

              ${dealSection}

              <p style="font-size: 14px; color: #6b7280;">
                A coach will be assigned soon (typically within 2-4 hours), and we'll notify you once that happens. You'll receive connection details before your session starts.
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

    // Send email notification
    const emailResponse = await resend.emails.send({
      from: "DuoDrive <onboarding@resend.dev>",
      to: [customerEmail],
      subject,
      html: htmlContent,
    });

    console.log("Email sent successfully:", emailResponse);

    // Also send push notification if available
    let pushResult = null;
    try {
      // Get customer user ID from profile
      const { data: customerProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", customerEmail)
        .single();

      if (customerProfile) {
        const pushResponse = await fetch(
          `${supabaseUrl}/functions/v1/send-push-notification`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              userId: customerProfile.id,
              title: subject.replace(/^[^\s]+ /, ""), // Remove emoji prefix
              body: reminderType === "session_starting" 
                ? `Your ${sessionLabel} session is about to begin!`
                : reminderType === "session_claimed"
                ? `A coach has been assigned to your ${sessionLabel} session.`
                : `Your ${sessionLabel} session has been confirmed.`,
              url: "/coaching",
            }),
          }
        );
        pushResult = await pushResponse.json();
        console.log("Push notification result:", pushResult);
      }
    } catch (pushError) {
      console.error("Push notification error (non-fatal):", pushError);
      // Don't fail the request if push fails
    }

    return new Response(JSON.stringify({ success: true, emailResponse, pushResult }), {
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