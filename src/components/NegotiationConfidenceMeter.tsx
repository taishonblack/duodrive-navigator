import { CheckCircle2, AlertCircle, Circle, ChevronDown } from "lucide-react";
import { Cloud, CloudOff, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  ConfidenceResult,
  getConfidenceDisplay,
  getNegotiationConfidenceLabel,
} from "@/hooks/useNegotiationConfidence";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";

interface NegotiationConfidenceMeterProps {
  confidence: ConfidenceResult;
  className?: string;
  isLoggedIn?: boolean;
  isSaving?: boolean;
  lastSavedAt?: Date | null;
}

export function NegotiationConfidenceMeter({
  confidence,
  className,
  isLoggedIn = false,
  isSaving = false,
  lastSavedAt = null,
}: NegotiationConfidenceMeterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { state, missingFields, progress } = confidence;
  const display = getConfidenceDisplay(state, progress);
  const negotiationLabel = getNegotiationConfidenceLabel(progress);

  // Icon based on progress, not harsh judgment
  const Icon = progress >= 75 
    ? CheckCircle2 
    : progress >= 50 
      ? AlertCircle 
      : Circle;

  const iconColor = progress >= 75
    ? "text-green-600 dark:text-green-400"
    : progress >= 50
      ? "text-amber-600 dark:text-amber-400"
      : "text-muted-foreground";

  const progressColor = progress >= 75
    ? "bg-green-500"
    : progress >= 50
      ? "bg-amber-500"
      : "bg-primary/60";

  const bgColor = progress >= 75
    ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
    : progress >= 50
      ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
      : "bg-muted/50 border-border";

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        className={cn(
          "rounded-xl border transition-all duration-300",
          bgColor,
          className
        )}
      >
        <CollapsibleTrigger asChild>
          <button className="w-full p-3 text-left hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors">
            <div className="flex items-center gap-3">
              <Icon className={cn("h-4 w-4 shrink-0", iconColor)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-foreground text-sm leading-tight">
                    Deal Creation Progress
                  </p>
                  <span className="text-xs font-medium text-muted-foreground">
                    {display.statusLine}
                  </span>
                </div>
              </div>
            {/* Autosave indicator for logged in users */}
            {isLoggedIn && progress >= 30 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                {isSaving ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : lastSavedAt ? (
                  <>
                    <Cloud className="h-3 w-3 text-score-excellent" />
                    <span className="hidden sm:inline">Saved</span>
                  </>
                ) : (
                  <>
                    <CloudOff className="h-3 w-3" />
                    <span className="hidden sm:inline">Not saved</span>
                  </>
                )}
              </div>
            )}
              <ChevronDown 
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform duration-200",
                  isOpen && "rotate-180"
                )} 
              />
            </div>
            <Progress
              value={progress}
              className="h-1.5 mt-2 bg-muted/50"
              indicatorClassName={progressColor}
            />
            {isLoggedIn && (
              <p className="text-[10px] text-muted-foreground mt-1.5 text-right">
                Saved automatically as you go
              </p>
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 pt-0 space-y-3">
            {/* Dynamic microcopy - encouraging, not corrective */}
            <p className="text-xs text-muted-foreground">
              {display.subtext}
            </p>

            {/* Negotiation confidence framing */}
            <div className="pt-2 border-t border-current/10">
              <p className="text-xs font-medium text-foreground mb-1">
                Negotiation Confidence
              </p>
              <p className="text-xs text-muted-foreground">
                {negotiationLabel}
              </p>
            </div>

            {/* What would help - only show top 3, never harsh */}
            {progress < 100 && missingFields.length > 0 && (
              <div className="pt-2 border-t border-current/10">
                <p className="text-xs text-muted-foreground mb-1.5">
                  {progress < 50 ? "Would help next:" : "To sharpen further:"}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {missingFields.slice(0, 3).map((field) => (
                    <span
                      key={field}
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground"
                    >
                      {field}
                    </span>
                  ))}
                  {missingFields.length > 3 && (
                    <span className="text-xs text-muted-foreground">
                      +{missingFields.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {progress >= 100 && (
              <p className="text-xs text-primary font-medium">
                Your deal is ready for complete analysis.
              </p>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
