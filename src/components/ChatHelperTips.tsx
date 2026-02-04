import { HelpCircle, Zap } from "lucide-react";

interface ChatHelperTipsProps {
  isDealershipMode?: boolean;
}

export function ChatHelperTips({ isDealershipMode = false }: ChatHelperTipsProps) {
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
