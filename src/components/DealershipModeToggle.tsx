import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Zap } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DealershipModeToggleProps {
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
  isMobile?: boolean;
}

export function DealershipModeToggle({
  isEnabled,
  onToggle,
  isMobile = false,
}: DealershipModeToggleProps) {
  if (isMobile && isEnabled) {
    // On mobile, just show a badge when active
    return (
      <Badge variant="secondary" className="gap-1 bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30">
        <Zap className="h-3 w-3" />
        Dealership Mode
      </Badge>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2">
          <Switch
            id="dealership-mode"
            checked={isEnabled}
            onCheckedChange={onToggle}
            className="data-[state=checked]:bg-amber-500"
          />
          <label
            htmlFor="dealership-mode"
            className="text-xs font-medium text-muted-foreground cursor-pointer select-none"
          >
            {isEnabled ? (
              <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Dealership Mode
              </span>
            ) : (
              "Dealership Mode"
            )}
          </label>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[200px]">
        <p className="text-xs">
          {isEnabled
            ? "Short, tactical answers + negotiation scripts"
            : "Enable for shorter answers when you're at the dealer"}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
