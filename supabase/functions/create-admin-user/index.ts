import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-ADMIN-USER] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password, displayName } = await req.json();

    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    logStep("Creating admin user", { email });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Create the user account
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm the email
    });

    if (authError) {
      logStep("Auth error", { message: authError.message });
      throw new Error(authError.message);
    }

    if (!authData.user) {
      throw new Error("Failed to create user");
    }

    logStep("User created", { userId: authData.user.id });

    // Assign admin role
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: authData.user.id,
        role: "admin",
      });

    if (roleError) {
      logStep("Role assignment error", { message: roleError.message });
      // Try to clean up the created user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new Error("Failed to assign admin role: " + roleError.message);
    }

    logStep("Admin role assigned successfully");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Admin user created successfully",
        userId: authData.user.id,
        email: authData.user.email,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
