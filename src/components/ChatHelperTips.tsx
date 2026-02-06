import { useState } from "react";
import { HelpCircle, Zap, ChevronDown, ChevronUp } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface ChatHelperTipsProps {
  isDealershipMode?: boolean;
  hasUserMessages?: boolean;
}

export function ChatHelperTips({ isDealershipMode = false, hasUserMessages = false }: ChatHelperTipsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isMobile = useIsMobile();

  // On mobile, hide after user has sent messages (conversation started)
  if (isMobile && hasUserMessages) {
    return null;
  }

  // On desktop, always show expanded
  if (!isMobile) {
    return (
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <HelpCircle className="h-3 w-3" />
          <span>
            Tip: Ask "What does APR mean?" Quinn can explain any term.
          </span>
        </p>
        {isDealershipMode && (
          <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
            <Zap className="h-3 w-3" />
            <span>
              Everything is negotiable — price, fees, and add-ons.
            </span>
          </p>
        )}
      </div>
    );
  }

  // Mobile: collapsible (only shown before first message)
  return (
    <div>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-xs text-muted-foreground py-1"
      >
        <span className="flex items-center gap-1.5">
          <HelpCircle className="h-3 w-3" />
          <span>Tip: Ask "What does APR mean?"</span>
        </span>
        {isExpanded ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </button>
      {isExpanded && (
        <div className="space-y-1 pt-1">
          <p className="text-xs text-muted-foreground pl-4">
            Quinn can explain any term in plain English.
          </p>
          {isDealershipMode && (
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5 pl-4">
              <Zap className="h-3 w-3" />
              <span>Everything is negotiable — price, fees, and add-ons.</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
