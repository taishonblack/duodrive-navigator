 import { useEffect, useRef, useCallback } from "react";
 
 const IDLE_MS = 3 * 60 * 1000; // 3 minutes
 const ANTI_SPAM_MS = 6 * 60 * 1000; // Don't ping more than once every 6 minutes
 
 const IDLE_PROMPTS = [
   "Hey — are you still there?",
   "Still with me?",
   "No rush — want to keep evaluating this deal?",
   "I'm here when you're ready. Want to continue?",
   "Did you want to paste the numbers from the quote?",
   "Quick check-in: do you want to keep going on this car?",
   "All good — should we keep building the deal details?",
   "Just making sure I didn't lose you. Want to continue?",
   "If you drop in the price/fees/APR, I can analyze it more accurately.",
   "How can I help next — sticker photo, or paste the quote?",
 ];
 
 function pickIdlePrompt(): string {
   return IDLE_PROMPTS[Math.floor(Math.random() * IDLE_PROMPTS.length)];
 }
 
 interface UseIdlePingOptions {
   /** Called when an idle ping should be sent */
   onIdlePing: (message: string) => void;
   /** Whether we're currently waiting for an assistant response */
   isLoading: boolean;
   /** Whether the idle timer should be active */
   isActive: boolean;
 }
 
 export function useIdlePing({ onIdlePing, isLoading, isActive }: UseIdlePingOptions) {
   const idleTimerRef = useRef<number | null>(null);
   const lastPingAtRef = useRef<number>(0);
   const isLoadingRef = useRef(isLoading);
 
   // Keep ref in sync with isLoading prop
   useEffect(() => {
     isLoadingRef.current = isLoading;
   }, [isLoading]);
 
   const clearIdleTimer = useCallback(() => {
     if (idleTimerRef.current) {
       window.clearTimeout(idleTimerRef.current);
       idleTimerRef.current = null;
     }
   }, []);
 
   const scheduleIdleTimer = useCallback(() => {
     clearIdleTimer();
     
     if (!isActive) return;
 
     idleTimerRef.current = window.setTimeout(() => {
       const now = Date.now();
       const lastPing = lastPingAtRef.current;
 
       // Anti-spam: don't ping more than once every 6 minutes
       if (now - lastPing < ANTI_SPAM_MS) return;
 
       // Don't ping if currently generating a reply
       if (isLoadingRef.current) return;
 
       lastPingAtRef.current = now;
       onIdlePing(pickIdlePrompt());
     }, IDLE_MS);
   }, [clearIdleTimer, isActive, onIdlePing]);
 
   // Reset timer on activity (call this after sending a message)
   const resetIdleTimer = useCallback(() => {
     scheduleIdleTimer();
   }, [scheduleIdleTimer]);
 
   // Setup and cleanup
   useEffect(() => {
     if (isActive) {
       scheduleIdleTimer();
     } else {
       clearIdleTimer();
     }
     
     return () => clearIdleTimer();
   }, [isActive, scheduleIdleTimer, clearIdleTimer]);
 
   return { resetIdleTimer };
 }