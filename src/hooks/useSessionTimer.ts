import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CoachingSession {
  id: string;
  request_id: string;
  coach_id: string;
  customer_id: string;
  session_type: "text" | "phone" | "video";
  scheduled_duration_minutes: number;
  started_at: string | null;
  ended_at: string | null;
  actual_duration_minutes: number | null;
  extension_requested: boolean | null;
  extension_minutes: number | null;
  extension_approved: boolean | null;
  status: string;
  meet_link: string | null;
  masked_phone_number: string | null;
}

export function useSessionTimer(requestId: string) {
  const [session, setSession] = useState<CoachingSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from("coaching_sessions")
        .select("*")
        .eq("request_id", requestId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      setSession(data);
    } catch (err) {
      console.error("Error fetching session:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch session");
    } finally {
      setIsLoading(false);
    }
  }, [requestId]);

  // Subscribe to realtime updates
  useEffect(() => {
    fetchSession();

    const channel = supabase
      .channel(`session-${requestId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "coaching_sessions",
          filter: `request_id=eq.${requestId}`,
        },
        (payload) => {
          console.log("Session update:", payload);
          if (payload.new) {
            setSession(payload.new as CoachingSession);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [requestId, fetchSession]);

  const createSession = async (
    coachId: string,
    customerId: string,
    sessionType: "text" | "phone" | "video"
  ) => {
    const durationMap = { text: 10, phone: 30, video: 30 };
    
    try {
      const { data, error: insertError } = await supabase
        .from("coaching_sessions")
        .insert({
          request_id: requestId,
          coach_id: coachId,
          customer_id: customerId,
          session_type: sessionType,
          scheduled_duration_minutes: durationMap[sessionType],
          status: "scheduled",
        })
        .select()
        .single();

      if (insertError) throw insertError;
      setSession(data);
      return data;
    } catch (err) {
      console.error("Error creating session:", err);
      throw err;
    }
  };

  return {
    session,
    isLoading,
    error,
    createSession,
    refetch: fetchSession,
  };
}
