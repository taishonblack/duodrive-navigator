import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-DEAL-ENTITLEMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const { dealId } = await req.json();
    logStep("Received request", { dealId });

    if (!dealId) {
      throw new Error("Deal ID is required");
    }

    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Check if user is a permanent premium user
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: premiumUser } = await supabaseAdmin
      .from("premium_users")
      .select("expires_at")
      .eq("user_id", user.id)
      .single();

    if (premiumUser) {
      // Check if premium hasn't expired (null = never expires)
      const isActive = !premiumUser.expires_at || new Date(premiumUser.expires_at) > new Date();
      if (isActive) {
        logStep("User is permanent premium", { userId: user.id, expiresAt: premiumUser.expires_at });
        return new Response(JSON.stringify({ 
          status: "unlocked",
          isPremiumUser: true,
          expiresAt: premiumUser.expires_at
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    // Check entitlement status for this specific deal
    const { data: entitlement, error: entitlementError } = await supabaseClient
      .from("deal_entitlements")
      .select("status, unlocked_at")
      .eq("deal_id", dealId)
      .eq("user_id", user.id)
      .single();

    if (entitlementError) {
      // No entitlement found - return locked
      logStep("No entitlement found", { dealId });
      return new Response(JSON.stringify({ status: "locked" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep("Entitlement found", { status: entitlement.status, unlockedAt: entitlement.unlocked_at });

    return new Response(JSON.stringify({ 
      status: entitlement.status,
      unlockedAt: entitlement.unlocked_at 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
