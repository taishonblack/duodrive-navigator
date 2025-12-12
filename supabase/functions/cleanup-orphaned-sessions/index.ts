import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsWithSecurityHeaders } from "../_shared/security-headers.ts";

const corsHeaders = getCorsWithSecurityHeaders();

// Threshold for considering a session orphaned (in minutes)
const ORPHAN_THRESHOLD_MINUTES = 5;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate the threshold time
    const thresholdTime = new Date(Date.now() - ORPHAN_THRESHOLD_MINUTES * 60 * 1000);
    console.log(`Looking for sessions not updated since: ${thresholdTime.toISOString()}`);

    // Find active sessions that haven't been updated recently (no heartbeat)
    const { data: orphanedSessions, error: fetchError } = await supabase
      .from("coach_chat_sessions")
      .select("id, coach_id, customer_id, started_at, updated_at, scheduled_duration_minutes")
      .eq("status", "active")
      .lt("updated_at", thresholdTime.toISOString());

    if (fetchError) {
      console.error("Error fetching orphaned sessions:", fetchError);
      throw fetchError;
    }

    if (!orphanedSessions || orphanedSessions.length === 0) {
      console.log("No orphaned sessions found");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No orphaned sessions found",
          cleanedUp: 0,
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    console.log(`Found ${orphanedSessions.length} orphaned session(s)`);

    // Calculate actual duration for each session and mark as completed
    const cleanupPromises = orphanedSessions.map(async (session) => {
      const startedAt = session.started_at ? new Date(session.started_at) : new Date();
      const endedAt = new Date();
      const actualDurationMinutes = Math.ceil((endedAt.getTime() - startedAt.getTime()) / 60000);

      const { error: updateError } = await supabase
        .from("coach_chat_sessions")
        .update({
          status: "completed",
          ended_at: endedAt.toISOString(),
          actual_duration_minutes: Math.min(actualDurationMinutes, session.scheduled_duration_minutes || 10),
        })
        .eq("id", session.id);

      if (updateError) {
        console.error(`Failed to cleanup session ${session.id}:`, updateError);
        return { id: session.id, success: false, error: updateError.message };
      }

      console.log(`Cleaned up orphaned session: ${session.id}`);
      return { id: session.id, success: true };
    });

    const results = await Promise.all(cleanupPromises);
    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Cleaned up ${successCount} orphaned session(s)`,
        cleanedUp: successCount,
        failed: failedCount,
        details: results,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error) {
    console.error("Error in cleanup-orphaned-sessions:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
