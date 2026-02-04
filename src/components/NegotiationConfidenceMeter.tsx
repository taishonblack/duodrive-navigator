import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  ConfidenceResult,
  getConfidenceDisplay,
} from "@/hooks/useNegotiationConfidence";

interface NegotiationConfidenceMeterProps {
  confidence: ConfidenceResult;
  className?: string;
}

export function NegotiationConfidenceMeter({
  confidence,
  className,
}: NegotiationConfidenceMeterProps) {
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
    <div
      className={cn(
        "rounded-xl border p-4 transition-all duration-300",
        bgColor,
        className
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        <Icon className={cn("h-5 w-5 mt-0.5 shrink-0", iconColor)} />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground text-sm">
            {display.headline}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {display.subtext}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <Progress
          value={progress}
          className="h-1.5 bg-muted/50"
          indicatorClassName={progressColor}
        />
      </div>

      {/* Missing fields (only show if not ready) */}
      {state !== "ready" && missingFields.length > 0 && (
        <div className="mt-3 pt-3 border-t border-current/10">
          <p className="text-xs text-muted-foreground mb-1.5">Missing:</p>
          <div className="flex flex-wrap gap-1.5">
            {missingFields.slice(0, 4).map((field) => (
              <span
                key={field}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground"
              >
                {field}
              </span>
            ))}
            {missingFields.length > 4 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">
                +{missingFields.length - 4} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
