import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsWithSecurityHeaders } from "../_shared/security-headers.ts";

const corsHeaders = getCorsWithSecurityHeaders();

interface EscalationPayload {
  term: string;
  user_message: string;
  context?: string;
  conversation_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header (optional - escalations can be anonymous)
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    const payload: EscalationPayload = await req.json();

    if (!payload.term || !payload.user_message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: term, user_message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert the escalation
    const { data, error } = await supabase
      .from("unknown_term_escalations")
      .insert({
        term: payload.term,
        user_message: payload.user_message,
        context: payload.context || null,
        conversation_id: payload.conversation_id || null,
        user_id: userId,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to save escalation:", error);
      return new Response(
        JSON.stringify({ error: "Failed to save escalation" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Escalation saved:", data.id, "Term:", payload.term);

    return new Response(
      JSON.stringify({ success: true, id: data.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Save escalation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
