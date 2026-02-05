import { Button } from "@/components/ui/button";
import { ArrowRight, PlusCircle } from "lucide-react";
 import { FEATURES } from "@/config/features";

interface ChatActionButtonsProps {
  onGoToWhatToSay: () => void;
  onCompareAnother: () => void;
   showWhatToSay?: boolean; // Only show if premium-relevant content exists
}

 export function ChatActionButtons({ 
   onGoToWhatToSay, 
   onCompareAnother,
   showWhatToSay = true 
 }: ChatActionButtonsProps) {
   // Only show "What to Say" if premium is enabled
   const canShowWhatToSay = showWhatToSay && FEATURES.premiumEnabled;
 
  return (
    <div className="flex flex-wrap gap-2 mt-2 ml-11">
       {canShowWhatToSay && (
         <Button
           variant="outline"
           size="sm"
           onClick={onGoToWhatToSay}
           className="text-xs h-8 gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
         >
           <ArrowRight className="h-3.5 w-3.5" />
           Go to What to Say
         </Button>
       )}
      <Button
        variant="outline"
        size="sm"
        onClick={onCompareAnother}
        className="text-xs h-8 gap-1.5"
      >
        <PlusCircle className="h-3.5 w-3.5" />
        Compare another car
      </Button>
    </div>
  );
}

/**
 * Detects if a message appears to be a deal summary from Quinn.
 * Looks for common summary patterns.
 */
export function isDealSummaryMessage(content: string): boolean {
  const summaryPatterns = [
    // Direct summary phrases
    /here'?s what I have/i,
    /here'?s what I'?ve got/i,
    /here'?s (the|your) (deal|breakdown)/i,
    /summary of your deal/i,
    /your deal (so far|breakdown)/i,
    /let me summarize/i,
    /to summarize/i,
    /in summary/i,
    /deal (recap|overview)/i,
    /based on (what you('ve)?|everything)/i,
    
    // Position/status phrases
    /you'?re in a (good|solid|strong|decent) (spot|position)/i,
    /looking (pretty )?(good|solid|strong)/i,
    /this (deal )?(looks|seems) (reasonable|fair|good)/i,
    
    // Next step phrases
    /next:?\s*(tap|check|open)\s*(what to say|the deal)/i,
    /check\s+(out\s+)?what to say/i,
    /tap\s+what to say/i,
    /head (over )?to (what to say|the deal)/i,
    /take a look at (what to say|the deal)/i,
    
    // Coaching/ready phrases
    /you('re| are) (ready|set|good) to/i,
    /if (the dealer|they) counter/i,
    /come back (if|when)/i,
    /I('ll| will) be here/i,
    /bring me the counteroffer/i,
    
    // Numbers confirmation (when Quinn recaps specific deal numbers)
    /out-the-door.{0,20}\$[\d,]+/i,
    /monthly.{0,20}\$[\d,]+/i,
    /asking price.{0,20}\$[\d,]+/i,
  ];

  return summaryPatterns.some(pattern => pattern.test(content));
}

/**
 * Determines if action buttons should show based on conversation state.
 * Shows buttons if:
 * 1. Message is a detected summary, OR
 * 2. Conversation has 4+ user messages (meaningful back-and-forth)
 */
export function shouldShowActionButtons(
  content: string, 
  userMessageCount: number
): boolean {
  // Always show if it's a detected summary
  if (isDealSummaryMessage(content)) return true;
  
  // Fallback: show after meaningful conversation (4+ user messages)
  if (userMessageCount >= 4) return true;
  
  return false;
}
