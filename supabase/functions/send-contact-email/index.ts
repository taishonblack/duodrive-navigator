import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContactEmailRequest {
  name: string;
  email: string;
  subject: string;
  message: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, email, subject, message }: ContactEmailRequest = await req.json();

    // Validate inputs
    if (!name || !email || !subject || !message) {
      console.error("Missing required fields");
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Sanitize inputs for HTML
    const sanitize = (str: string) => str.replace(/[<>&"']/g, (c) => ({
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      '"': '&quot;',
      "'": '&#39;'
    }[c] || c));

    const sanitizedName = sanitize(name);
    const sanitizedEmail = sanitize(email);
    const sanitizedSubject = sanitize(subject);
    const sanitizedMessage = sanitize(message);

    console.log(`Sending contact email from ${email} about: ${subject}`);

    // Send notification to DuoDrive team
    const teamEmailResponse = await resend.emails.send({
      from: "DuoDrive Contact <onboarding@resend.dev>",
      to: ["contact@duodrive.app"],
      reply_to: email,
      subject: `[Contact Form] ${sanitizedSubject}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a; border-bottom: 2px solid #f97316; padding-bottom: 10px;">New Contact Form Submission</h2>
          
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0;"><strong>From:</strong> ${sanitizedName}</p>
            <p style="margin: 0 0 10px 0;"><strong>Email:</strong> <a href="mailto:${sanitizedEmail}">${sanitizedEmail}</a></p>
            <p style="margin: 0;"><strong>Subject:</strong> ${sanitizedSubject}</p>
          </div>
          
          <div style="margin: 20px 0;">
            <h3 style="color: #1a1a1a; margin-bottom: 10px;">Message:</h3>
            <div style="background: #ffffff; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; white-space: pre-wrap;">${sanitizedMessage}</div>
          </div>
          
          <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
            This message was sent via the DuoDrive contact form.
          </p>
        </div>
      `,
    });

    console.log("Team email sent:", teamEmailResponse);

    // Send confirmation to the user
    const userEmailResponse = await resend.emails.send({
      from: "DuoDrive <onboarding@resend.dev>",
      to: [email],
      subject: "We received your message - DuoDrive",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1a1a1a;">Thanks for reaching out, ${sanitizedName}!</h1>
          
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            We've received your message and will get back to you within 24-48 hours.
          </p>
          
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0; color: #6b7280;"><strong>Your message:</strong></p>
            <p style="margin: 0; color: #374151; white-space: pre-wrap;">${sanitizedMessage}</p>
          </div>
          
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            In the meantime, feel free to explore our <a href="https://duodrive.app/deal-room" style="color: #f97316;">Deal Room</a> 
            to analyze your car deals.
          </p>
          
          <p style="color: #374151; margin-top: 30px;">
            Best regards,<br>
            <strong>The DuoDrive Team</strong>
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="color: #9ca3af; font-size: 12px;">
            DuoDrive - Car buying simplified. Know if your deal is right for you.
          </p>
        </div>
      `,
    });

    console.log("User confirmation email sent:", userEmailResponse);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-contact-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
