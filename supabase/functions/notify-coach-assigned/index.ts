import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { sanitizeForHtml, isValidUUID } from "../_shared/validation.ts";
import { getCorsWithSecurityHeaders } from "../_shared/security-headers.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const corsHeaders = getCorsWithSecurityHeaders();

interface NotifyAssignedRequest {
  requestId: string;
  coachId: string;
}

const sessionTypeLabels: Record<string, string> = {
  text: "Quick Text Help ($29)",
  phone: "Live Phone Session ($99)",
  video: "Full Concierge ($499)",
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { requestId, coachId }: NotifyAssignedRequest = await req.json();

    // Validate inputs
    if (!requestId || !isValidUUID(requestId)) {
      console.error("Invalid or missing requestId");
      return new Response(
        JSON.stringify({ error: "Valid requestId is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!coachId || !isValidUUID(coachId)) {
      console.error("Invalid or missing coachId");
      return new Response(
        JSON.stringify({ error: "Valid coachId is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Notifying coach ${coachId} about assignment to request ${requestId}`);

    // Fetch the coaching request details
    const { data: request, error: requestError } = await supabase
      .from("coaching_requests")
      .select(`
        id,
        session_type,
        scheduled_date,
        scheduled_time,
        notes,
        deal_id,
        customer_id
      `)
      .eq("id", requestId)
      .single();

    if (requestError || !request) {
      console.error("Request not found:", requestError);
      return new Response(
        JSON.stringify({ error: "Request not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch coach details
    const { data: coach, error: coachError } = await supabase
      .from("coaches")
      .select("id, user_id, display_name")
      .eq("id", coachId)
      .single();

    if (coachError || !coach) {
      console.error("Coach not found:", coachError);
      return new Response(
        JSON.stringify({ error: "Coach not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch coach's email from profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", coach.user_id)
      .single();

    if (!profile?.email) {
      console.error("Coach email not found");
      return new Response(
        JSON.stringify({ error: "Coach email not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch deal details if available
    let dealInfo = "";
    if (request.deal_id) {
      const { data: deal } = await supabase
        .from("deals")
        .select("name, year, make, model, trim, asking_price, negotiated_price, mileage")
        .eq("id", request.deal_id)
        .single();
      
      if (deal) {
        const safeName = deal.name ? sanitizeForHtml(deal.name) : "";
        const safeYear = deal.year ? sanitizeForHtml(deal.year) : "";
        const safeMake = deal.make ? sanitizeForHtml(deal.make) : "";
        const safeModel = deal.model ? sanitizeForHtml(deal.model) : "";
        const safeTrim = deal.trim ? sanitizeForHtml(deal.trim) : "";
        
        const vehicle = [safeYear, safeMake, safeModel, safeTrim].filter(Boolean).join(" ");
        const askingPrice = formatPrice(deal.asking_price);
        const negotiatedPrice = formatPrice(deal.negotiated_price);
        const safeMileage = deal.mileage ? parseInt(deal.mileage).toLocaleString() : "";
        
        dealInfo = `
          <div style="background: #ecfdf5; padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #10b981;">
            <p style="margin: 0 0 10px 0; color: #047857; font-size: 14px; font-weight: 600;">🚗 Customer's Deal:</p>
            ${safeName ? `<p style="margin: 5px 0; color: #111827;"><strong>Deal Name:</strong> ${safeName}</p>` : ""}
            ${vehicle ? `<p style="margin: 5px 0; color: #111827;"><strong>Vehicle:</strong> ${vehicle}</p>` : ""}
            ${safeMileage ? `<p style="margin: 5px 0; color: #111827;"><strong>Mileage:</strong> ${safeMileage} miles</p>` : ""}
            ${askingPrice ? `<p style="margin: 5px 0; color: #111827;"><strong>Asking Price:</strong> ${askingPrice}</p>` : ""}
            ${negotiatedPrice ? `<p style="margin: 5px 0; color: #111827;"><strong>Negotiated Price:</strong> ${negotiatedPrice}</p>` : ""}
          </div>
        `;
      }
    }

    const sessionLabel = sessionTypeLabels[request.session_type] || request.session_type;
    const formattedDate = formatDate(request.scheduled_date);
    const formattedTime = formatTime(request.scheduled_time);
    const dashboardUrl = `${supabaseUrl.replace(".supabase.co", ".lovable.app")}/coach-dashboard`;

    // Sanitize display name and notes
    const safeDisplayName = sanitizeForHtml(coach.display_name);
    const safeNotes = request.notes ? sanitizeForHtml(request.notes) : "";

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">✅ You've Been Assigned!</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 16px 16px;">
          <p style="font-size: 16px; color: #374151;">Hi ${safeDisplayName},</p>
          <p style="font-size: 16px; color: #374151;">An admin has assigned you to a new <strong>${sessionLabel}</strong> coaching session!</p>
          
          <div style="background: #f9fafb; padding: 20px; border-radius: 12px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Session Details:</p>
            <p style="margin: 5px 0; color: #111827;"><strong>📅 Scheduled Date:</strong> ${formattedDate}</p>
            <p style="margin: 5px 0; color: #111827;"><strong>🕐 Scheduled Time:</strong> ${formattedTime}</p>
            <p style="margin: 5px 0; color: #111827;"><strong>📱 Session Type:</strong> ${sessionLabel}</p>
          </div>

          ${dealInfo}

          ${safeNotes ? `
            <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0 0 5px 0; font-size: 14px; color: #92400e; font-weight: 600;">📝 Customer Notes:</p>
              <p style="margin: 0; font-size: 14px; color: #78350f;">${safeNotes}</p>
            </div>
          ` : ""}

          <div style="text-align: center; margin: 25px 0;">
            <a href="${dashboardUrl}" style="display: inline-block; background: #10b981; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              View in Dashboard
            </a>
          </div>

          <p style="font-size: 14px; color: #6b7280; text-align: center;">
            Please review the customer's needs and prepare for the session. 🎯
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">
          <p style="font-size: 12px; color: #9ca3af; text-align: center;">
            DuoDrive Coaching Team
          </p>
        </div>
      </div>
    `;

    try {
      const result = await resend.emails.send({
        from: "DuoDrive Coaching <onboarding@resend.dev>",
        to: [profile.email],
        subject: `✅ You've been assigned: ${sessionLabel}`,
        html: htmlContent,
      });
      console.log(`Assignment notification sent to ${coach.display_name}:`, result);

      return new Response(
        JSON.stringify({ success: true, email: profile.email }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    } catch (emailError) {
      console.error(`Failed to send email to ${coach.display_name}:`, emailError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to send email" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

  } catch (error: unknown) {
    console.error("Error in notify-coach-assigned:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to notify coach";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
