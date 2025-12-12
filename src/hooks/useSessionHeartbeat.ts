import { useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseSessionHeartbeatOptions {
  sessionId: string;
  isActive: boolean;
  heartbeatIntervalMs?: number; // Default: 30 seconds
  orphanThresholdMs?: number; // Default: 2 minutes without heartbeat
}

/**
 * Hook to send periodic heartbeats for active coaching sessions.
 * This allows the system to detect and clean up orphaned sessions
 * where users closed their browser without properly ending the session.
 */
export function useSessionHeartbeat({
  sessionId,
  isActive,
  heartbeatIntervalMs = 30 * 1000, // 30 seconds
}: UseSessionHeartbeatOptions) {
  const lastHeartbeat = useRef<number>(Date.now());

  const sendHeartbeat = useCallback(async () => {
    if (!isActive || !sessionId) return;

    try {
      // Update the session's updated_at timestamp as a heartbeat signal
      const { error } = await supabase
        .from("coach_chat_sessions")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", sessionId)
        .eq("status", "active");

      if (!error) {
        lastHeartbeat.current = Date.now();
        console.log("Session heartbeat sent:", sessionId);
      }
    } catch (error) {
      console.error("Failed to send session heartbeat:", error);
    }
  }, [sessionId, isActive]);

  // Send heartbeats at regular intervals
  useEffect(() => {
    if (!isActive) return;

    // Send initial heartbeat
    sendHeartbeat();

    const interval = setInterval(sendHeartbeat, heartbeatIntervalMs);

    return () => clearInterval(interval);
  }, [isActive, sendHeartbeat, heartbeatIntervalMs]);

  // Send heartbeat on visibility change (when user returns to tab)
  useEffect(() => {
    if (!isActive) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        sendHeartbeat();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isActive, sendHeartbeat]);

  return { sendHeartbeat, lastHeartbeat: lastHeartbeat.current };
}

/**
 * Cleanup orphaned sessions that haven't received a heartbeat in a while.
 * This should be called periodically by an admin or cron job.
 */
export async function cleanupOrphanedSessions(orphanThresholdMinutes = 5): Promise<number> {
  const thresholdTime = new Date(Date.now() - orphanThresholdMinutes * 60 * 1000);
  
  try {
    // Find active sessions that haven't been updated recently
    const { data: orphanedSessions, error: fetchError } = await supabase
      .from("coach_chat_sessions")
      .select("id, started_at, updated_at")
      .eq("status", "active")
      .lt("updated_at", thresholdTime.toISOString());

    if (fetchError) {
      console.error("Error fetching orphaned sessions:", fetchError);
      return 0;
    }

    if (!orphanedSessions || orphanedSessions.length === 0) {
      return 0;
    }

    // Mark orphaned sessions as completed
    const sessionIds = orphanedSessions.map(s => s.id);
    
    const { error: updateError } = await supabase
      .from("coach_chat_sessions")
      .update({
        status: "completed",
        ended_at: new Date().toISOString(),
      })
      .in("id", sessionIds);

    if (updateError) {
      console.error("Error cleaning up orphaned sessions:", updateError);
      return 0;
    }

    console.log(`Cleaned up ${sessionIds.length} orphaned session(s)`);
    return sessionIds.length;
  } catch (error) {
    console.error("Error in cleanupOrphanedSessions:", error);
    return 0;
  }
}
