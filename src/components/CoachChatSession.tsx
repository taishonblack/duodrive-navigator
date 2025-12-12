import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Send, Clock, AlertTriangle, MessageSquare, 
  Loader2, Play, Square, Circle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useChatPresence } from "@/hooks/useChatPresence";
import { useAuditLog } from "@/hooks/useAuditLog";
import { SessionRatingDialog } from "@/components/SessionRatingDialog";

interface ChatMessage {
  id: string;
  sender_type: "coach" | "customer";
  sender_id: string;
  content: string;
  created_at: string;
}

interface CoachChatSessionProps {
  sessionId: string;
  isCoach: boolean;
  coachId?: string;
  coachName?: string;
  coachAvatar?: string;
  coachBio?: string;
  onSessionEnd?: () => void;
}

const WARNING_THRESHOLDS = {
  FIVE_MINUTES: 5 * 60,
  TWO_MINUTES: 2 * 60,
  ONE_MINUTE: 60,
};

export function CoachChatSession({
  sessionId,
  isCoach,
  coachId,
  coachName = "Your Coach",
  coachAvatar,
  coachBio,
  onSessionEnd,
}: CoachChatSessionProps) {
  const { toast } = useToast();
  const { logAction } = useAuditLog();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [warningLevel, setWarningLevel] = useState<"none" | "warning" | "urgent" | "critical">("none");
  const [hasShownWarning, setHasShownWarning] = useState<Record<string, boolean>>({});
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [partnerId, setPartnerId] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get presence info for this chat session
  const { isPartnerOnline, isPartnerTyping, setTyping } = useChatPresence(
    sessionId,
    currentUserId,
    partnerId
  );

  const totalSeconds = (session?.scheduled_duration_minutes || 10) * 60;
  const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
  const progressPercent = (elapsedSeconds / totalSeconds) * 100;

  // Fetch session and messages
  const fetchSessionData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }

      const { data: sessionData, error: sessionError } = await supabase
        .from("coach_chat_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (sessionError) throw sessionError;
      setSession(sessionData);

      // Set partner ID for presence tracking
      if (user) {
        if (sessionData.customer_id === user.id) {
          // Current user is customer, partner is coach user
          const { data: coachData } = await supabase
            .from("coaches")
            .select("user_id")
            .eq("id", sessionData.coach_id)
            .single();
          if (coachData) {
            setPartnerId(coachData.user_id);
          }
        } else {
          // Current user is coach, partner is customer
          setPartnerId(sessionData.customer_id);
        }
      }

      // Calculate elapsed time if session is active
      if (sessionData.started_at) {
        const startTime = new Date(sessionData.started_at).getTime();
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setElapsedSeconds(Math.max(0, elapsed));
      }

      const { data: messagesData, error: messagesError } = await supabase
        .from("coach_chat_messages")
        .select("*")
        .eq("chat_session_id", sessionId)
        .order("created_at", { ascending: true });

      if (messagesError) throw messagesError;
      setMessages((messagesData || []) as ChatMessage[]);
    } catch (error) {
      console.error("Error fetching session:", error);
      toast({
        title: "Error",
        description: "Failed to load chat session.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, toast]);

  useEffect(() => {
    fetchSessionData();
  }, [fetchSessionData]);

  // Subscribe to realtime messages
  useEffect(() => {
    const channel = supabase
      .channel(`chat-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "coach_chat_messages",
          filter: `chat_session_id=eq.${sessionId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as ChatMessage]);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "coach_chat_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          setSession(payload.new);
          if (payload.new.status === "completed") {
            toast({
              title: "Session Ended",
              description: "The coaching session has ended.",
            });
            // Show rating dialog for customers
            if (!isCoach) {
              setShowRatingDialog(true);
            } else {
              onSessionEnd?.();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, toast, onSessionEnd]);

  // Timer tick
  useEffect(() => {
    if (session?.status !== "active" || !session?.started_at) return;

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => {
        const newElapsed = prev + 1;
        if (newElapsed >= totalSeconds && !session.coach_extended) {
          handleSessionExpired();
          return totalSeconds;
        }
        return newElapsed;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [session?.status, session?.started_at, totalSeconds, session?.coach_extended]);

  // Warning level updates
  useEffect(() => {
    if (session?.coach_extended) {
      setWarningLevel("none");
      return;
    }

    if (remainingSeconds <= WARNING_THRESHOLDS.ONE_MINUTE) {
      setWarningLevel("critical");
      if (!hasShownWarning["critical"]) {
        showWarningToast("1 minute remaining!");
        setHasShownWarning((prev) => ({ ...prev, critical: true }));
      }
    } else if (remainingSeconds <= WARNING_THRESHOLDS.TWO_MINUTES) {
      setWarningLevel("urgent");
      if (!hasShownWarning["urgent"]) {
        showWarningToast("2 minutes remaining!");
        setHasShownWarning((prev) => ({ ...prev, urgent: true }));
      }
    } else if (remainingSeconds <= WARNING_THRESHOLDS.FIVE_MINUTES) {
      setWarningLevel("warning");
      if (!hasShownWarning["warning"]) {
        showWarningToast("5 minutes remaining");
        setHasShownWarning((prev) => ({ ...prev, warning: true }));
      }
    } else {
      setWarningLevel("none");
    }
  }, [remainingSeconds, hasShownWarning, session?.coach_extended]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const showWarningToast = (message: string) => {
    toast({
      title: "⏰ Time Warning",
      description: message,
      variant: warningLevel === "critical" ? "destructive" : "default",
    });
  };

  const handleSessionExpired = async () => {
    toast({
      title: "Session Time Expired",
      description: "The scheduled session time has ended.",
      variant: "destructive",
    });

    try {
      await supabase
        .from("coach_chat_sessions")
        .update({
          ended_at: new Date().toISOString(),
          actual_duration_minutes: Math.ceil(elapsedSeconds / 60),
          status: "completed",
        })
        .eq("id", sessionId);
    } catch (error) {
      console.error("Error updating session:", error);
    }

    onSessionEnd?.();
  };

  const startSession = async () => {
    try {
      await supabase
        .from("coach_chat_sessions")
        .update({
          started_at: new Date().toISOString(),
          status: "active",
        })
        .eq("id", sessionId);

      setElapsedSeconds(0);
      
      // Notify coach that customer has started (if customer is starting)
      if (!isCoach) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const { data } = await supabase.functions.invoke("notify-coach-customer-joined", {
            body: { chatSessionId: sessionId },
            headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
          });
          console.log("Coach notification sent:", data);
        } catch (notifyError) {
          console.error("Failed to notify coach:", notifyError);
          // Don't fail the session start if notification fails
        }
      }
      
      toast({
        title: "Session Started",
        description: "Your 10-minute coaching session has begun!",
      });
    } catch (error) {
      console.error("Error starting session:", error);
      toast({
        title: "Error",
        description: "Failed to start session.",
        variant: "destructive",
      });
    }
  };

  const endSession = async () => {
    try {
      await supabase
        .from("coach_chat_sessions")
        .update({
          ended_at: new Date().toISOString(),
          actual_duration_minutes: Math.ceil(elapsedSeconds / 60),
          status: "completed",
        })
        .eq("id", sessionId);

      // Log audit event for ending session (only for coaches)
      if (isCoach && coachId) {
        logAction({
          coachId,
          action: "end_chat_session",
          resourceType: "coach_chat_sessions",
          resourceId: sessionId,
          details: { 
            duration_minutes: Math.ceil(elapsedSeconds / 60),
            was_extended: session?.coach_extended || false,
          },
        });
      }

      toast({
        title: "Session Ended",
        description: `Session completed after ${Math.ceil(elapsedSeconds / 60)} minutes.`,
      });

      onSessionEnd?.();
    } catch (error) {
      console.error("Error ending session:", error);
    }
  };

  const extendSession = async () => {
    try {
      await supabase
        .from("coach_chat_sessions")
        .update({ coach_extended: true })
        .eq("id", sessionId);

      setHasShownWarning({});
      setWarningLevel("none");
      
      toast({
        title: "Session Extended",
        description: "Timer paused. End the session when ready.",
      });
    } catch (error) {
      console.error("Error extending session:", error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isSending || session?.status !== "active") return;

    setIsSending(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to send messages.",
        variant: "destructive",
      });
      setIsSending(false);
      return;
    }

    try {
      const { error } = await supabase.from("coach_chat_messages").insert({
        chat_session_id: sessionId,
        sender_type: isCoach ? "coach" : "customer",
        sender_id: user.id,
        content: input.trim(),
      });

      if (error) throw error;
      setInput("");
      inputRef.current?.focus();
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to send message.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getWarningStyles = () => {
    switch (warningLevel) {
      case "critical":
        return "border-destructive bg-destructive/5";
      case "urgent":
        return "border-orange-500 bg-orange-500/5";
      case "warning":
        return "border-yellow-500 bg-yellow-500/5";
      default:
        return "border-border";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (session?.status === "completed") {
    return (
      <>
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-8 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Session Completed</h2>
            <p className="text-muted-foreground">
              This coaching session has ended. Thank you for using DuoDrive!
            </p>
          </CardContent>
        </Card>

        {/* Rating Dialog for customers */}
        {!isCoach && coachId && (
          <SessionRatingDialog
            open={showRatingDialog}
            onOpenChange={setShowRatingDialog}
            sessionId={sessionId}
            coachId={coachId}
            coachName={coachName}
            coachPhotoUrl={coachAvatar}
            onRatingComplete={onSessionEnd}
          />
        )}
      </>
    );
  }

  // Partner display name based on role
  const partnerDisplayName = isCoach ? "Customer" : coachName;
  const partnerLabel = isCoach ? "Customer" : "Your Coach";

  return (
    <Card className={`max-w-2xl mx-auto border-2 ${getWarningStyles()}`}>
      {/* Header */}
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="h-12 w-12 border-2 border-primary/20">
                <AvatarImage src={isCoach ? undefined : coachAvatar} alt={partnerDisplayName} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {partnerDisplayName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              {/* Online indicator */}
              <span
                className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${
                  isPartnerOnline ? "bg-green-500" : "bg-muted-foreground"
                }`}
                title={isPartnerOnline ? "Online" : "Offline"}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">{partnerDisplayName}</CardTitle>
                {isPartnerTyping && (
                  <span className="text-xs text-primary animate-pulse">typing...</span>
                )}
                <Badge 
                  variant="outline" 
                  className={`text-xs ${
                    isPartnerOnline 
                      ? "bg-green-500/10 text-green-600 border-green-500/20" 
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isPartnerOnline ? "Online" : "Offline"}
                </Badge>
              </div>
              {coachBio && !isCoach && (
                <p className="text-xs text-muted-foreground line-clamp-1">{coachBio}</p>
              )}
              {isCoach && (
                <p className="text-sm text-muted-foreground">
                  {isPartnerOnline ? "Customer is ready to chat" : "Waiting for customer to join..."}
                </p>
              )}
            </div>
          </div>
          
          {/* Timer */}
          {session?.status === "active" && !session?.coach_extended && (
            <div className="text-right">
              <div className={`text-2xl font-mono font-bold ${
                warningLevel === "critical" ? "text-destructive" : 
                warningLevel === "urgent" ? "text-orange-500" : 
                "text-foreground"
              }`}>
                {formatTime(remainingSeconds)}
              </div>
              <p className="text-xs text-muted-foreground">remaining</p>
            </div>
          )}
          
          {session?.coach_extended && (
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
              Extended
            </Badge>
          )}
        </div>

        {/* Progress bar */}
        {session?.status === "active" && !session?.coach_extended && (
          <div className="mt-3">
            <Progress 
              value={progressPercent} 
              className={`h-1.5 ${progressPercent >= 90 ? "[&>div]:bg-destructive" : ""}`}
            />
          </div>
        )}

        {/* Warning */}
        {warningLevel !== "none" && !session?.coach_extended && (
          <div className={`flex items-center gap-2 p-2 rounded-md mt-3 ${
            warningLevel === "critical" ? "bg-destructive/10 text-destructive" :
            warningLevel === "urgent" ? "bg-orange-500/10 text-orange-600" :
            "bg-yellow-500/10 text-yellow-600"
          }`}>
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">
              {warningLevel === "critical" 
                ? "Session ending soon!" 
                : `${Math.ceil(remainingSeconds / 60)} minutes remaining`}
            </span>
          </div>
        )}
      </CardHeader>

      {/* Messages */}
      <CardContent className="p-0">
        <div className="h-80 overflow-y-auto p-4 space-y-4">
          {session?.status === "pending" && (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2" />
              <p>Waiting for session to start...</p>
              {isCoach && (
                <Button onClick={startSession} className="mt-4">
                  <Play className="h-4 w-4 mr-2" />
                  Start Session
                </Button>
              )}
            </div>
          )}

          {session?.status === "ready" && !isCoach && (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2" />
              <p className="mb-4">Your coach is ready! Click below to begin.</p>
              <Button onClick={startSession}>
                <Play className="h-4 w-4 mr-2" />
                Start Chat Session
              </Button>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender_type === (isCoach ? "coach" : "customer") ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                  msg.sender_type === (isCoach ? "coach" : "customer")
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p className={`text-xs mt-1 ${
                  msg.sender_type === (isCoach ? "coach" : "customer")
                    ? "text-primary-foreground/70"
                    : "text-muted-foreground"
                }`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { 
                    hour: "2-digit", 
                    minute: "2-digit" 
                  })}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        {session?.status === "active" && (
          <div className="border-t p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="flex gap-2"
            >
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  // Trigger typing indicator
                  if (e.target.value.trim()) {
                    setTyping(true);
                  } else {
                    setTyping(false);
                  }
                }}
                onBlur={() => setTyping(false)}
                placeholder="Type your message..."
                disabled={isSending}
                className="flex-1"
              />
              <Button type="submit" disabled={!input.trim() || isSending}>
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>

            {/* Coach controls */}
            {isCoach && (
              <div className="flex gap-2 mt-3 justify-end">
                {!session?.coach_extended && warningLevel !== "none" && (
                  <Button variant="outline" size="sm" onClick={extendSession}>
                    <Clock className="h-4 w-4 mr-2" />
                    Keep Chat Open
                  </Button>
                )}
                <Button variant="destructive" size="sm" onClick={endSession}>
                  <Square className="h-4 w-4 mr-2" />
                  End Session
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
