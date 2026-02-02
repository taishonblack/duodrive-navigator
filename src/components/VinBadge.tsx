import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Pencil, RotateCcw, User } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type FieldSource = "vin" | "user" | "estimated" | "unknown";

interface VinBadgeProps {
  source: FieldSource;
  onEdit?: () => void;
  onRevert?: () => void;
  className?: string;
}

export function VinBadge({ source, onEdit, onRevert, className }: VinBadgeProps) {
  if (source === "unknown") return null;

  const badgeConfig: Record<Exclude<FieldSource, "unknown">, {
    label: string;
    tooltip: string;
    icon: React.ReactNode;
    variant: "default" | "secondary" | "outline";
  }> = {
    vin: {
      label: "Detected from VIN (NHTSA)",
      tooltip: "We decoded this from your VIN using the NHTSA database. If anything looks off, tap to edit.",
      icon: <ShieldCheck className="h-3 w-3" />,
      variant: "secondary",
    },
    user: {
      label: "Edited by you",
      tooltip: "You provided or edited this value.",
      icon: <User className="h-3 w-3" />,
      variant: "outline",
    },
    estimated: {
      label: "Estimated",
      tooltip: "This value is estimated. You can update it anytime.",
      icon: null,
      variant: "outline",
    },
  };

  const config = badgeConfig[source];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("inline-flex items-center gap-1", className)}>
            <Badge
              variant={config.variant}
              className="text-xs py-0 px-1.5 h-5 gap-1 cursor-help"
            >
              {config.icon}
              {config.label}
            </Badge>
            {onEdit && (
              <button
                onClick={onEdit}
                className="p-0.5 rounded hover:bg-muted transition-colors"
                title="Edit"
              >
                <Pencil className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
            {source === "user" && onRevert && (
              <button
                onClick={onRevert}
                className="p-0.5 rounded hover:bg-muted transition-colors"
                title="Revert to VIN value"
              >
                <RotateCcw className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px]">
          <p className="text-xs">{config.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Helper to determine source for a field
export function getFieldSource(
  fieldValue: string | undefined,
  vinDecodedFields?: Set<string>,
  fieldKey?: string
): FieldSource {
  if (!fieldValue) return "unknown";
  if (vinDecodedFields?.has(fieldKey || "")) return "vin";
  return "user";
}
