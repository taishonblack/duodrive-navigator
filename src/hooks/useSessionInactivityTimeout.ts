import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UseSessionInactivityTimeoutOptions {
  sessionId: string;
  inactivityTimeoutMs?: number; // Default: 5 minutes
  warningBeforeMs?: number; // Default: 1 minute before timeout
  isActive: boolean; // Only run when session is active
  onTimeout?: () => void;
}

interface InactivityState {
  isWarning: boolean;
  secondsUntilTimeout: number;
  resetInactivity: () => void;
}

const DEFAULT_INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const DEFAULT_WARNING_BEFORE = 60 * 1000; // 1 minute warning

export function useSessionInactivityTimeout({
  sessionId,
  inactivityTimeoutMs = DEFAULT_INACTIVITY_TIMEOUT,
  warningBeforeMs = DEFAULT_WARNING_BEFORE,
  isActive,
  onTimeout,
}: UseSessionInactivityTimeoutOptions): InactivityState {
  const { toast } = useToast();
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const [isWarning, setIsWarning] = useState(false);
  const [secondsUntilTimeout, setSecondsUntilTimeout] = useState(
    Math.floor(inactivityTimeoutMs / 1000)
  );
  const hasShownWarning = useRef(false);
  const hasTimedOut = useRef(false);

  // Reset inactivity timer
  const resetInactivity = useCallback(() => {
    setLastActivity(Date.now());
    setIsWarning(false);
    hasShownWarning.current = false;
    setSecondsUntilTimeout(Math.floor(inactivityTimeoutMs / 1000));
  }, [inactivityTimeoutMs]);

  // Track user activity
  useEffect(() => {
    if (!isActive) return;

    const activityEvents = ["mousedown", "keydown", "touchstart", "scroll"];
    
    const handleActivity = () => {
      resetInactivity();
    };

    activityEvents.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      activityEvents.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [isActive, resetInactivity]);

  // Check for inactivity and handle timeout
  useEffect(() => {
    if (!isActive || hasTimedOut.current) return;

    const checkInterval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastActivity;
      const remaining = Math.max(0, inactivityTimeoutMs - elapsed);
      const remainingSeconds = Math.floor(remaining / 1000);

      setSecondsUntilTimeout(remainingSeconds);

      // Show warning
      if (remaining <= warningBeforeMs && remaining > 0 && !hasShownWarning.current) {
        setIsWarning(true);
        hasShownWarning.current = true;
        toast({
          title: "⚠️ Inactivity Warning",
          description: `Session will auto-end in ${Math.ceil(remaining / 1000)} seconds due to inactivity. Move your mouse or type to stay active.`,
          variant: "default",
        });
      }

      // Handle timeout
      if (remaining <= 0 && !hasTimedOut.current) {
        hasTimedOut.current = true;
        handleSessionTimeout();
      }
    }, 1000);

    return () => clearInterval(checkInterval);
  }, [isActive, lastActivity, inactivityTimeoutMs, warningBeforeMs, toast]);

  // Handle session timeout
  const handleSessionTimeout = async () => {
    try {
      // Update session status in database
      await supabase
        .from("coach_chat_sessions")
        .update({
          ended_at: new Date().toISOString(),
          status: "completed",
        })
        .eq("id", sessionId);

      toast({
        title: "Session Ended",
        description: "Your coaching session was automatically ended due to inactivity.",
        variant: "destructive",
      });

      onTimeout?.();
    } catch (error) {
      console.error("Error ending inactive session:", error);
    }
  };

  return {
    isWarning,
    secondsUntilTimeout,
    resetInactivity,
  };
}
