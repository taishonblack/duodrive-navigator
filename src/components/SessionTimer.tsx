import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, AlertTriangle, Play, Pause, Square, 
  Plus, Phone, Video, MessageSquare 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SessionTimerProps {
  sessionId: string;
  sessionType: "text" | "phone" | "video";
  scheduledDurationMinutes: number;
  startedAt: string | null;
  onSessionEnd?: () => void;
  isCoach?: boolean;
}

const SESSION_DURATIONS: Record<string, number> = {
  text: 10,
  phone: 30,
  video: 30,
};

const WARNING_THRESHOLDS = {
  FIVE_MINUTES: 5 * 60, // 5 minutes in seconds
  TWO_MINUTES: 2 * 60,  // 2 minutes in seconds
  ONE_MINUTE: 60,       // 1 minute in seconds
};

const sessionTypeIcons = {
  text: MessageSquare,
  phone: Phone,
  video: Video,
};

export function SessionTimer({
  sessionId,
  sessionType,
  scheduledDurationMinutes,
  startedAt,
  onSessionEnd,
  isCoach = false,
}: SessionTimerProps) {
  const { toast } = useToast();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(!!startedAt);
  const [isPaused, setIsPaused] = useState(false);
  const [extensionRequested, setExtensionRequested] = useState(false);
  const [warningLevel, setWarningLevel] = useState<"none" | "warning" | "urgent" | "critical">("none");
  const [hasShownWarning, setHasShownWarning] = useState<Record<string, boolean>>({});

  const totalSeconds = scheduledDurationMinutes * 60;
  const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
  const progressPercent = (elapsedSeconds / totalSeconds) * 100;

  const Icon = sessionTypeIcons[sessionType];

  // Calculate elapsed time from startedAt
  useEffect(() => {
    if (startedAt) {
      const startTime = new Date(startedAt).getTime();
      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000);
      setElapsedSeconds(Math.max(0, elapsed));
      setIsRunning(true);
    }
  }, [startedAt]);

  // Timer tick
  useEffect(() => {
    if (!isRunning || isPaused) return;

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => {
        const newElapsed = prev + 1;
        
        // Check for session end
        if (newElapsed >= totalSeconds) {
          clearInterval(interval);
          handleSessionExpired();
          return totalSeconds;
        }
        
        return newElapsed;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, isPaused, totalSeconds]);

  // Warning level updates
  useEffect(() => {
    if (remainingSeconds <= WARNING_THRESHOLDS.ONE_MINUTE) {
      setWarningLevel("critical");
      if (!hasShownWarning["critical"]) {
        showWarningToast("1 minute remaining!", "critical");
        setHasShownWarning((prev) => ({ ...prev, critical: true }));
      }
    } else if (remainingSeconds <= WARNING_THRESHOLDS.TWO_MINUTES) {
      setWarningLevel("urgent");
      if (!hasShownWarning["urgent"]) {
        showWarningToast("2 minutes remaining!", "urgent");
        setHasShownWarning((prev) => ({ ...prev, urgent: true }));
      }
    } else if (remainingSeconds <= WARNING_THRESHOLDS.FIVE_MINUTES) {
      setWarningLevel("warning");
      if (!hasShownWarning["warning"]) {
        showWarningToast("5 minutes remaining", "warning");
        setHasShownWarning((prev) => ({ ...prev, warning: true }));
      }
    } else {
      setWarningLevel("none");
    }
  }, [remainingSeconds, hasShownWarning]);

  const showWarningToast = (message: string, level: string) => {
    toast({
      title: level === "critical" ? "⚠️ Session Ending Soon" : "⏰ Time Warning",
      description: message,
      variant: level === "critical" ? "destructive" : "default",
    });
  };

  const handleSessionExpired = async () => {
    setIsRunning(false);
    
    toast({
      title: "Session Time Expired",
      description: "The scheduled session time has ended.",
      variant: "destructive",
    });

    // Update session in database
    try {
      await supabase
        .from("coaching_sessions")
        .update({
          ended_at: new Date().toISOString(),
          actual_duration_minutes: scheduledDurationMinutes,
          status: "completed",
        })
        .eq("id", sessionId);
    } catch (error) {
      console.error("Error updating session:", error);
    }

    onSessionEnd?.();
  };

  const startSession = async () => {
    const now = new Date().toISOString();
    
    try {
      await supabase
        .from("coaching_sessions")
        .update({
          started_at: now,
          status: "active",
        })
        .eq("id", sessionId);

      setIsRunning(true);
      setElapsedSeconds(0);
      
      toast({
        title: "Session Started",
        description: `${scheduledDurationMinutes} minute session has begun.`,
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

  const pauseSession = () => {
    setIsPaused(!isPaused);
  };

  const endSession = async () => {
    setIsRunning(false);
    
    try {
      const actualMinutes = Math.ceil(elapsedSeconds / 60);
      
      await supabase
        .from("coaching_sessions")
        .update({
          ended_at: new Date().toISOString(),
          actual_duration_minutes: actualMinutes,
          status: "completed",
        })
        .eq("id", sessionId);

      toast({
        title: "Session Ended",
        description: `Session completed after ${actualMinutes} minutes.`,
      });

      onSessionEnd?.();
    } catch (error) {
      console.error("Error ending session:", error);
      toast({
        title: "Error",
        description: "Failed to end session.",
        variant: "destructive",
      });
    }
  };

  const requestExtension = async () => {
    try {
      await supabase
        .from("coaching_sessions")
        .update({
          extension_requested: true,
          extension_minutes: 15,
        })
        .eq("id", sessionId);

      setExtensionRequested(true);
      
      toast({
        title: "Extension Requested",
        description: "A 15-minute extension has been requested. Waiting for approval.",
      });
    } catch (error) {
      console.error("Error requesting extension:", error);
      toast({
        title: "Error",
        description: "Failed to request extension.",
        variant: "destructive",
      });
    }
  };

  const approveExtension = async () => {
    try {
      const newDuration = scheduledDurationMinutes + 15;
      
      await supabase
        .from("coaching_sessions")
        .update({
          extension_approved: true,
          scheduled_duration_minutes: newDuration,
        })
        .eq("id", sessionId);

      toast({
        title: "Extension Approved",
        description: "Session extended by 15 minutes.",
      });

      // Reset warnings for new time
      setHasShownWarning({});
      setWarningLevel("none");
    } catch (error) {
      console.error("Error approving extension:", error);
      toast({
        title: "Error",
        description: "Failed to approve extension.",
        variant: "destructive",
      });
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
        return "border-destructive bg-destructive/5 animate-pulse";
      case "urgent":
        return "border-orange-500 bg-orange-500/5";
      case "warning":
        return "border-yellow-500 bg-yellow-500/5";
      default:
        return "border-border";
    }
  };

  const getProgressColor = () => {
    if (progressPercent >= 90) return "bg-destructive";
    if (progressPercent >= 75) return "bg-orange-500";
    if (progressPercent >= 50) return "bg-yellow-500";
    return "bg-primary";
  };

  return (
    <Card className={`border-2 transition-colors ${getWarningStyles()}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <span className="font-medium capitalize">{sessionType} Session</span>
          </div>
          <Badge 
            variant={isRunning ? (isPaused ? "secondary" : "default") : "outline"}
            className={warningLevel === "critical" ? "bg-destructive" : ""}
          >
            {!isRunning ? "Not Started" : isPaused ? "Paused" : "Active"}
          </Badge>
        </div>

        {/* Timer Display */}
        <div className="text-center mb-4">
          <div className={`text-4xl font-mono font-bold ${
            warningLevel === "critical" ? "text-destructive" : 
            warningLevel === "urgent" ? "text-orange-500" : 
            "text-foreground"
          }`}>
            {formatTime(remainingSeconds)}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {formatTime(elapsedSeconds)} / {formatTime(totalSeconds)} elapsed
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ${getProgressColor()}`}
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            />
          </div>
        </div>

        {/* Warning Message */}
        {warningLevel !== "none" && (
          <div className={`flex items-center gap-2 p-2 rounded-md mb-4 ${
            warningLevel === "critical" ? "bg-destructive/10 text-destructive" :
            warningLevel === "urgent" ? "bg-orange-500/10 text-orange-600" :
            "bg-yellow-500/10 text-yellow-600"
          }`}>
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">
              {warningLevel === "critical" 
                ? "Session ending in less than 1 minute!" 
                : warningLevel === "urgent"
                ? "Less than 2 minutes remaining"
                : "5 minutes remaining"}
            </span>
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-2 justify-center">
          {!isRunning && (
            <Button onClick={startSession} className="flex-1">
              <Play className="h-4 w-4 mr-2" />
              Start Session
            </Button>
          )}
          
          {isRunning && isCoach && (
            <>
              <Button variant="outline" onClick={pauseSession}>
                {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </Button>
              <Button variant="destructive" onClick={endSession}>
                <Square className="h-4 w-4 mr-2" />
                End
              </Button>
            </>
          )}

          {/* Extension Request (for customers) */}
          {isRunning && !isCoach && warningLevel !== "none" && !extensionRequested && (
            <Button variant="outline" onClick={requestExtension}>
              <Plus className="h-4 w-4 mr-2" />
              Request Extension
            </Button>
          )}

          {/* Extension Approval (for coaches) */}
          {isRunning && isCoach && extensionRequested && (
            <Button onClick={approveExtension} className="bg-green-600 hover:bg-green-700">
              <Clock className="h-4 w-4 mr-2" />
              Approve +15 min
            </Button>
          )}
        </div>

        {extensionRequested && !isCoach && (
          <p className="text-sm text-center text-muted-foreground mt-2">
            Extension request pending approval...
          </p>
        )}
      </CardContent>
    </Card>
  );
}
