import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpdateRequest {
  updateId: string;
  customerId: string;
  coachName: string;
  message: string;
  updateType: "update" | "schedule_request";
  proposedTimes?: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { updateId, customerId, coachName, message, updateType, proposedTimes }: UpdateRequest = await req.json();

    console.log("Sending customer update notification:", { updateId, customerId, updateType });

    // Get customer email from profiles
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

    const dashboardUrl = "https://duodrive.app/dashboard";

    let subject: string;
    let htmlContent: string;

    if (updateType === "schedule_request") {
      subject = `Your DuoDrive Coach wants to schedule a call`;
      const timesHtml = proposedTimes?.map(t => `<li>${t}</li>`).join("") || "";
      htmlContent = `
        <h2>Schedule Request from Your Coach</h2>
        <p>Hi there,</p>
        <p>Your DuoDrive coach <strong>${coachName}</strong> would like to schedule a follow-up call with you.</p>
        <p><strong>Message:</strong></p>
        <p style="background: #f5f5f5; padding: 15px; border-radius: 8px;">${message}</p>
        ${proposedTimes?.length ? `
        <p><strong>Proposed times:</strong></p>
        <ul>${timesHtml}</ul>
        ` : ""}
        <p>Please log in to your DuoDrive account to select a time that works for you:</p>
        <p><a href="${dashboardUrl}" style="background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View & Respond</a></p>
        <p>Best,<br>The DuoDrive Team</p>
      `;
    } else {
      subject = `Update from your DuoDrive Coach`;
      htmlContent = `
        <h2>Update from Your Coach</h2>
        <p>Hi there,</p>
        <p>Your DuoDrive coach <strong>${coachName}</strong> has sent you an update about your car search:</p>
        <p style="background: #f5f5f5; padding: 15px; border-radius: 8px;">${message}</p>
        <p>Log in to your DuoDrive account to view the full update and respond:</p>
        <p><a href="${dashboardUrl}" style="background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Update</a></p>
        <p>Best,<br>The DuoDrive Team</p>
      `;
    }

    // Send email using Resend API
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
      return new Response(
        JSON.stringify({ error: "Failed to send notification" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Update notification sent successfully to:", profile.email);

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
