import { Button } from "@/components/ui/button";
import { ArrowRight, PlusCircle } from "lucide-react";

interface ChatActionButtonsProps {
  onGoToWhatToSay: () => void;
  onCompareAnother: () => void;
}

export function ChatActionButtons({ onGoToWhatToSay, onCompareAnother }: ChatActionButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2 mt-2 ml-11">
      <Button
        variant="outline"
        size="sm"
        onClick={onGoToWhatToSay}
        className="text-xs h-8 gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
      >
        <ArrowRight className="h-3.5 w-3.5" />
        Go to What to Say
      </Button>
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
    /here'?s what I have/i,
    /here'?s what I'?ve got/i,
    /summary of your deal/i,
    /your deal (so far|breakdown)/i,
    /let me summarize/i,
    /to summarize/i,
    /in summary/i,
    /deal (recap|overview)/i,
    /you'?re in a (good|solid|strong) (spot|position)/i,
    /next:?\s*(tap|check|open)\s*(what to say|the deal)/i,
    /check\s+what to say/i,
    /tap\s+what to say/i,
  ];

  return summaryPatterns.some(pattern => pattern.test(content));
}
