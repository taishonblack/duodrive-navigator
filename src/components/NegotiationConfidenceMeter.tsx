import { CheckCircle2, AlertCircle, XCircle, ChevronDown } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  ConfidenceResult,
  getConfidenceDisplay,
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
}

export function NegotiationConfidenceMeter({
  confidence,
  className,
}: NegotiationConfidenceMeterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { state, missingFields, progress } = confidence;
  const display = getConfidenceDisplay(state);

  const Icon = state === "ready" 
    ? CheckCircle2 
    : state === "almost" 
      ? AlertCircle 
      : XCircle;

  const iconColor = state === "ready"
    ? "text-green-600 dark:text-green-400"
    : state === "almost"
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400";

  const progressColor = state === "ready"
    ? "bg-green-500"
    : state === "almost"
      ? "bg-amber-500"
      : "bg-red-500";

  const bgColor = state === "ready"
    ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
    : state === "almost"
      ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
      : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800";

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
                <p className="font-medium text-foreground text-sm leading-tight">
                  {display.headline}
                </p>
              </div>
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
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 pt-0">
            <p className="text-xs text-muted-foreground mb-2">
              {display.subtext}
            </p>

            {/* Missing fields (only show if not ready) */}
            {state !== "ready" && missingFields.length > 0 && (
              <div className="pt-2 border-t border-current/10">
                <p className="text-xs text-muted-foreground mb-1.5">Missing:</p>
                <div className="flex flex-wrap gap-1.5">
                  {missingFields.map((field) => (
                    <span
                      key={field}
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground"
                    >
                      {field}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {state === "ready" && (
              <p className="text-xs text-green-700 dark:text-green-300">
                All key details captured — ready for full analysis.
              </p>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
