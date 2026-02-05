 import { useRef, useCallback } from "react";
 
 // Milestone nudge variations for each threshold
 const NUDGES_25 = [
   "Quick heads-up: you're about 25% in. The more info you add, the better I can analyze the deal.",
   "Nice — we've started building the deal. You're around 25% complete.",
   "We're making progress (about 25%). Want to keep going with price and fees next?",
   "Good start — you're roughly a quarter of the way there.",
   "You're at 25%. If you paste the quote numbers, we'll move fast.",
   "We've got the basics. About 25% done — next step is the money details.",
   "FYI: you're 25% toward evaluation. Keep dropping details and I'll sharpen the analysis.",
   "Good momentum — about 25% complete. Price or monthly payment next?",
   "You're 25% in. The more fields we fill, the more confident the results.",
   "We're about 25% there — want to add the selling price/OTD next?",
 ];
 
 const NUDGES_50 = [
   "Nice — you're about 50% complete. We're getting close to a real evaluation.",
   "Halfway there (50%). If you add fees/APR/term, I can flag anything sketchy.",
   "You're around 50% in. Want to fill the remaining money pieces next?",
   "We're at 50% — good time to paste the quote if you have it.",
   "Halfway. The more info you enter, the better I can analyze your deal.",
   "You've filled about half the checklist. Next we should lock down fees + APR/term.",
   "You're 50% there — once we get a couple more numbers, we can score it.",
   "Solid — 50% complete. What's the out-the-door or selling price?",
   "We're halfway done. If you want, tap The Deal tab to fill any missing fields quicker.",
   "About 50% complete — keep going and we can evaluate soon.",
 ];
 
 const NUDGES_75 = [
   "You're around 75% complete — we're basically ready to evaluate.",
   "Great — 75% in. Want to evaluate now, or fill the last few fields first?",
   "We're at 75%. Tap The Deal tab to see what's missing and finish fast.",
   "You're close — 75% complete. I think we can score this deal.",
   "Almost there. At 75%, we usually have enough to evaluate — want me to do it?",
   "You're 75% toward evaluation. If anything's missing, we can plug it in on The Deal tab.",
   "We're close enough to run an evaluation. Want to hit Evaluate My Deal?",
   "Nice work — 75% done. Let's either evaluate now or quickly fill the last gaps.",
   "At 75%, you're in the home stretch. Want to see the breakdown? Tap The Deal.",
   "You're 75% complete — I can evaluate your deal now if you want.",
 ];
 
 const DEALER_MODE_NUDGES = [
   "Since you're at the dealership, we can go fast. If you drop the numbers into The Deal tab, you can evaluate sooner — and ask me anything along the way.",
   "You're at the dealer — totally fine to paste what you have now. Filling The Deal page will speed up the evaluation.",
   "If it helps, enter the quote numbers on The Deal tab while we chat — that's the quickest path to an evaluation.",
   "No pressure — give me whatever you have. If you also plug it into The Deal page, we'll score it faster.",
   "We can do this two ways: chat it to me, or enter it on The Deal tab. Either works — I'm here.",
   "If the salesperson is waiting, the fastest move is: put the key numbers into The Deal tab → hit Evaluate → I'll help you respond.",
   "At the dealership, speed matters. Want to paste the quote here or fill it in on The Deal tab?",
   "Whatever is easiest for you — type it here, or add it on The Deal page so you can evaluate instantly.",
   "Quick path: OTD price + APR + term + any fees. Add those on The Deal tab and we'll move.",
   "I'm with you — share the numbers however you want. If you enter them on The Deal tab, you'll get to Evaluate faster.",
 ];
 
 // Get random nudge from array
 const getRandomNudge = (nudges: string[]): string => {
   return nudges[Math.floor(Math.random() * nudges.length)];
 };
 
 export interface MilestoneNudgesResult {
   checkMilestone: (progress: number, isDealershipMode: boolean) => string | null;
   resetMilestones: () => void;
 }
 
 export function useMilestoneNudges(): MilestoneNudgesResult {
   const milestonesShownRef = useRef<Set<number>>(new Set());
   
   const checkMilestone = useCallback((progress: number, isDealershipMode: boolean): string | null => {
     // Check thresholds in order
     if (progress >= 25 && !milestonesShownRef.current.has(25)) {
       milestonesShownRef.current.add(25);
       return isDealershipMode ? getRandomNudge(DEALER_MODE_NUDGES) : getRandomNudge(NUDGES_25);
     }
     
     if (progress >= 50 && !milestonesShownRef.current.has(50)) {
       milestonesShownRef.current.add(50);
       return isDealershipMode ? getRandomNudge(DEALER_MODE_NUDGES) : getRandomNudge(NUDGES_50);
     }
     
     if (progress >= 75 && !milestonesShownRef.current.has(75)) {
       milestonesShownRef.current.add(75);
       return getRandomNudge(NUDGES_75);
     }
     
     return null;
   }, []);
   
   const resetMilestones = useCallback(() => {
     milestonesShownRef.current = new Set();
   }, []);
   
   return { checkMilestone, resetMilestones };
 }