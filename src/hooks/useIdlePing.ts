import { useEffect, useRef, useCallback, useState } from "react";

type IdleMode = "regular" | "dealership";

// Timing schedules: [ping1, ping2, ping3, standby] in milliseconds
const IDLE_SCHEDULE: Record<IdleMode, number[]> = {
  dealership: [90_000, 180_000, 360_000, 600_000],   // 1.5m, 3m, 6m, 10m
  regular:    [180_000, 420_000, 720_000, 1_080_000], // 3m, 7m, 12m, 18m
};

// Mode-specific messages for each nudge level
const IDLE_MESSAGES: Record<IdleMode, string[]> = {
  dealership: [
    "Still with me? If you're talking to the salesperson, no rush.",
    "Want me to prep a quick counter-offer script while you're there?",
    "I can keep it simple. When you're ready: price + fees + trade-in (if any).",
    "All good — I'll hang here. Drop the numbers whenever you're ready.",
  ],
  regular: [
    "Still there? I can keep building this deal whenever you're ready.",
    "If you have it, a photo of the sticker or buyer's order speeds this up.",
    "When you come back, tell me: price, fees, APR/term, and whether you're trading anything in.",
    "No worries — I'll be here when you want to continue.",
  ],
};

interface UseIdlePingOptions {
  /** Called when an idle ping should be sent */
  onIdlePing: (message: string) => void;
  /** Whether we're currently waiting for an assistant response */
  isLoading: boolean;
  /** Whether the idle timer should be active */
  isActive: boolean;
  /** Current mode - affects timing and messaging */
  mode?: IdleMode;
}

export function useIdlePing({ 
  onIdlePing, 
  isLoading, 
  isActive, 
  mode = "regular" 
}: UseIdlePingOptions) {
  const timersRef = useRef<number[]>([]);
  const nudgeCountRef = useRef(0);
  const isLoadingRef = useRef(isLoading);
  const lastActivityRef = useRef(Date.now());
  const [isStandby, setIsStandby] = useState(false);

  // Keep ref in sync with isLoading prop
  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  }, []);

  const getMessageForNudge = useCallback((nudgeNumber: number): string => {
    const messages = IDLE_MESSAGES[mode];
    // nudgeNumber is 1-4, array index is 0-3
    const index = Math.min(nudgeNumber - 1, messages.length - 1);
    return messages[index];
  }, [mode]);

  const scheduleTimers = useCallback(() => {
    if (!isActive || isStandby) return;

    clearTimers();
    
    const delays = IDLE_SCHEDULE[mode];
    const startTime = lastActivityRef.current;

    delays.forEach((delay, idx) => {
      const nudgeNumber = idx + 1; // 1, 2, 3, 4 (4 = standby)
      
      const timer = window.setTimeout(() => {
        // Skip if user became active since we scheduled
        const idleFor = Date.now() - lastActivityRef.current;
        if (lastActivityRef.current !== startTime) return;
        
        // Skip if still loading a response
        if (isLoadingRef.current) return;
        
        // Skip if we've already sent this nudge or higher
        if (nudgeCountRef.current >= nudgeNumber) return;

        // Send the message
        onIdlePing(getMessageForNudge(nudgeNumber));
        nudgeCountRef.current = nudgeNumber;

        // After the 4th message (standby), enter standby mode
        if (nudgeNumber === 4) {
          setIsStandby(true);
          clearTimers();
        }
      }, delay);

      timersRef.current.push(timer);
    });
  }, [isActive, isStandby, mode, clearTimers, getMessageForNudge, onIdlePing]);

  // Reset timer on activity (call this after sending a message or any user interaction)
  const resetIdleTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    nudgeCountRef.current = 0;
    setIsStandby(false);
    clearTimers();
    
    // Only reschedule if active
    if (isActive && !isLoadingRef.current) {
      scheduleTimers();
    }
  }, [clearTimers, isActive, scheduleTimers]);

  // Setup and cleanup
  useEffect(() => {
    if (isActive && !isStandby) {
      scheduleTimers();
    } else {
      clearTimers();
    }
    
    return () => clearTimers();
  }, [isActive, isStandby, scheduleTimers, clearTimers]);

  // Re-schedule when mode changes
  useEffect(() => {
    if (isActive && !isStandby) {
      clearTimers();
      scheduleTimers();
    }
  }, [mode, isActive, isStandby, clearTimers, scheduleTimers]);

  return { 
    resetIdleTimer, 
    isStandby,
    nudgeCount: nudgeCountRef.current,
  };
}
