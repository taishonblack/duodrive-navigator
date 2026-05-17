import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Loader2,
  FileText,
  Download,
  RotateCcw,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProgressStep {
  id: string;
  label: string;
  completed: boolean;
}

interface PostPurchaseConfirmationProps {
  isVisible: boolean;
  onDismiss?: () => void;
  onSaveDeal?: () => void;
  onDownloadNotes?: () => void;
  onCompareAnother?: () => void;
  className?: string;
}

const INITIAL_STEPS: ProgressStep[] = [
  { id: "fees", label: "Reviewing fees line-by-line", completed: false },
  { id: "listings", label: "Comparing this deal to nearby listings", completed: false },
  { id: "counter", label: "Calculating a fair counter-offer range", completed: false },
  { id: "scripts", label: "Preparing dealer-ready scripts", completed: false },
  { id: "risks", label: "Flagging walk-away risks", completed: false },
];

export function PostPurchaseConfirmation({
  isVisible,
  onDismiss,
  onSaveDeal,
  onDownloadNotes,
  onCompareAnother,
  className,
}: PostPurchaseConfirmationProps) {
  const [steps, setSteps] = useState<ProgressStep[]>(INITIAL_STEPS);
  const [allComplete, setAllComplete] = useState(false);

  // Animate steps completing one by one
  useEffect(() => {
    if (!isVisible) {
      setSteps(INITIAL_STEPS);
      setAllComplete(false);
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];

    steps.forEach((_, index) => {
      const timer = setTimeout(() => {
        setSteps((prev) =>
          prev.map((step, i) =>
            i <= index ? { ...step, completed: true } : step
          )
        );

        if (index === steps.length - 1) {
          setTimeout(() => setAllComplete(true), 500);
        }
      }, 800 * (index + 1));

      timers.push(timer);
    });

    return () => timers.forEach(clearTimeout);
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <Card
      className={cn(
        "border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/20",
        className
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          You're unlocked. Here's what I'm doing now.
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress checklist */}
        <ul className="space-y-2">
          {steps.map((step) => (
            <li
              key={step.id}
              className={cn(
                "flex items-center gap-3 text-sm transition-all duration-300",
                step.completed
                  ? "text-foreground"
                  : "text-muted-foreground/50"
              )}
            >
              {step.completed ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
              )}
              <span>{step.label}</span>
            </li>
          ))}
        </ul>

        {/* Reassurance text (shows after all complete) */}
        {allComplete && (
          <div className="pt-3 border-t border-green-200/50 dark:border-green-800/50 space-y-3">
            <p className="text-sm text-muted-foreground italic">
              "Most buyers never see this level of clarity before signing."
            </p>
            <p className="text-sm text-foreground font-medium">
              You didn't overthink this — you did your homework.
            </p>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-2">
              {onSaveDeal && (
                <Button variant="outline" size="sm" onClick={onSaveDeal}>
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  Save deal
                </Button>
              )}
              {onDownloadNotes && (
                <Button variant="outline" size="sm" onClick={onDownloadNotes}>
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Download notes
                </Button>
              )}
              {onCompareAnother && (
                <Button variant="outline" size="sm" onClick={onCompareAnother}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Compare another car
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
