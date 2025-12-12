import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushRequest {
  userId: string;
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

// Web Push implementation for Deno
async function sendWebPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<Response> {
  const encoder = new TextEncoder();
  
  // Create VAPID JWT
  const header = { alg: "ES256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const audience = new URL(subscription.endpoint).origin;
  
  const payload_jwt = {
    aud: audience,
    exp: now + 12 * 60 * 60, // 12 hours
    sub: "mailto:contact@duodrive.app",
  };
  
  // Base64url encode
  const base64url = (data: Uint8Array | string): string => {
    const b64 = typeof data === "string" 
      ? btoa(data) 
      : btoa(String.fromCharCode(...data));
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  };
  
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload_jwt));
  const unsignedToken = `${headerB64}.${payloadB64}`;
  
  // Import the private key
  const privateKeyRaw = Uint8Array.from(
    atob(vapidPrivateKey.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0)
  );
  
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyRaw,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  ).catch(() => {
    // If PKCS8 fails, try raw format (32 bytes)
    return crypto.subtle.importKey(
      "raw",
      privateKeyRaw.length === 32 ? privateKeyRaw : privateKeyRaw.slice(-32),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"]
    );
  });
  
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    encoder.encode(unsignedToken)
  );
  
  const signatureB64 = base64url(new Uint8Array(signature));
  const jwt = `${unsignedToken}.${signatureB64}`;
  
  // Send the push notification
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Authorization": `vapid t=${jwt}, k=${vapidPublicKey}`,
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "TTL": "86400",
    },
    body: encoder.encode(payload),
  });
  
  return response;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    
    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error("VAPID keys not configured");
      return new Response(
        JSON.stringify({ error: "Push notifications not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { userId, title, body, url, icon }: PushRequest = await req.json();

    console.log("Sending push notification to user:", userId);

    // Get user's push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", userId);

    if (subError) {
      console.error("Error fetching subscriptions:", subError);
      throw new Error("Failed to fetch push subscriptions");
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log("No push subscriptions found for user:", userId);
      return new Response(
        JSON.stringify({ success: true, message: "No subscriptions found", sent: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const payload = JSON.stringify({
      title,
      body,
      icon: icon || "/favicon.ico",
      url: url || "/",
      timestamp: Date.now(),
    });

    console.log(`Sending to ${subscriptions.length} subscription(s)`);

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const subscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };
        
        try {
          const response = await sendWebPush(
            subscription,
            payload,
            vapidPublicKey,
            vapidPrivateKey
          );
          
          if (response.status === 410 || response.status === 404) {
            // Subscription expired, remove it
            console.log("Removing expired subscription:", sub.endpoint);
            await supabase
              .from("push_subscriptions")
              .delete()
              .eq("id", sub.id);
            return { success: false, expired: true };
          }
          
          if (!response.ok) {
            console.error("Push failed:", response.status, await response.text());
            return { success: false, status: response.status };
          }
          
          return { success: true };
        } catch (error) {
          console.error("Error sending push:", error);
          return { success: false, error: String(error) };
        }
      })
    );

    const successful = results.filter(
      (r) => r.status === "fulfilled" && r.value.success
    ).length;
    
    const expired = results.filter(
      (r) => r.status === "fulfilled" && r.value.expired
    ).length;

    console.log(`Push results: ${successful} sent, ${expired} expired`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: successful, 
        expired,
        total: subscriptions.length 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: unknown) {
    console.error("Error sending push notification:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to send push notification";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
