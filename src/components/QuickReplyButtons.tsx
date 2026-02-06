import { Button } from "@/components/ui/button";
import { MapPin, Home } from "lucide-react";

interface QuickReplyButtonsProps {
  options: Array<{
    label: string;
    value: string;
    icon?: React.ReactNode;
  }>;
  onSelect: (value: string) => void;
  disabled?: boolean;
}

export function QuickReplyButtons({
  options,
  onSelect,
  disabled = false,
}: QuickReplyButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2 justify-center py-2">
      {options.map((option) => (
        <Button
          key={option.value}
          variant="outline"
          size="sm"
          onClick={() => onSelect(option.value)}
          disabled={disabled}
          className="gap-2"
        >
          {option.icon}
          {option.label}
        </Button>
      ))}
    </div>
  );
}

// Pre-built dealership check options
export function DealershipQuickReplies({
  onSelect,
  disabled = false,
}: {
  onSelect: (isAtDealership: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <QuickReplyButtons
      options={[
        {
          label: "Yes — at the dealership",
          value: "yes",
          icon: <MapPin className="h-4 w-4" />,
        },
        {
          label: "No — shopping from home",
          value: "no",
          icon: <Home className="h-4 w-4" />,
        },
      ]}
      onSelect={(value) => onSelect(value === "yes")}
      disabled={disabled}
    />
  );
}
