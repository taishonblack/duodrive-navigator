import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Verify the cryptographic signature of the OAuth state
async function verifySignature(data: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const dataToSign = encoder.encode(data);
  
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const expectedSignature = await crypto.subtle.sign("HMAC", key, dataToSign);
  const expectedHex = Array.from(new Uint8Array(expectedSignature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return signature === expectedHex;
}

interface OAuthStatePayload {
  coach_id: string;
  nonce: string;
  timestamp: number;
  signature: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");

    if (!code || !stateParam) {
      console.error("Missing code or state parameter");
      return new Response("Missing authorization code or state", { status: 400 });
    }

    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      console.error("Missing Google OAuth credentials");
      return new Response("Server configuration error", { status: 500 });
    }

    // Parse and verify the signed state
    let statePayload: OAuthStatePayload;
    try {
      statePayload = JSON.parse(atob(stateParam));
    } catch {
      console.error("Invalid state format - not valid base64 JSON");
      return new Response("Invalid state parameter", { status: 400 });
    }

    const { coach_id, nonce, timestamp, signature } = statePayload;

    // Validate all required fields exist
    if (!coach_id || !nonce || !timestamp || !signature) {
      console.error("Missing required fields in state payload");
      return new Response("Invalid state parameter", { status: 400 });
    }

    // Verify the state is not too old (max 10 minutes)
    const MAX_STATE_AGE_MS = 10 * 60 * 1000;
    if (Date.now() - timestamp > MAX_STATE_AGE_MS) {
      console.error("OAuth state expired");
      return new Response("OAuth session expired. Please try again.", { status: 400 });
    }

    // Verify the signature
    const stateData = `${coach_id}:${nonce}:${timestamp}`;
    const isValid = await verifySignature(stateData, signature, SUPABASE_SERVICE_ROLE_KEY!);
    
    if (!isValid) {
      console.error("Invalid state signature - possible tampering attempt");
      return new Response("Invalid state parameter", { status: 400 });
    }

    console.log("OAuth state verified successfully for coach:", coach_id);

    // Determine redirect URI based on the request origin
    const redirectUri = `${SUPABASE_URL}/functions/v1/google-oauth-callback`;

    // Exchange code for tokens
    console.log("Exchanging authorization code for tokens...");
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("Token exchange error:", tokenData);
      return new Response(`OAuth error: ${tokenData.error_description || tokenData.error}`, { status: 400 });
    }

    console.log("Token exchange successful, saving to database...");

    // Initialize Supabase client with service role
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Calculate token expiry time
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    // Store tokens in the secure coach_oauth_tokens table (no user access)
    const { error: tokenError } = await supabase
      .from("coach_oauth_tokens")
      .upsert({
        coach_id: coach_id,
        google_access_token: tokenData.access_token,
        google_refresh_token: tokenData.refresh_token,
        google_token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }, { onConflict: "coach_id" });

    if (tokenError) {
      console.error("Error storing tokens:", tokenError);
      return new Response("Failed to store integration", { status: 500 });
    }

    // Update the coach_integrations table to show connected status (visible to user)
    const { error: integrationError } = await supabase
      .from("coach_integrations")
      .upsert({
        coach_id: coach_id,
        google_connected: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "coach_id" });

    if (integrationError) {
      console.error("Error updating integration status:", integrationError);
      // Don't fail - tokens are already stored securely
    }

    console.log("Google integration saved successfully for coach:", coach_id);

    // Redirect back to coach dashboard with success
    const dashboardUrl = url.origin.includes("supabase.co") 
      ? "https://preview--duodrive.lovable.app/coach/dashboard?google_connected=true"
      : "/coach/dashboard?google_connected=true";

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: dashboardUrl,
      },
    });
  } catch (error: unknown) {
    console.error("OAuth callback error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(`Error: ${message}`, { status: 500 });
  }
});
