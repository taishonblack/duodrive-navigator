import { HelpCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

interface TermTooltipProps {
  term: string;
  definition: string;
  onGlossaryClick?: () => void;
}

export function TermTooltip({ term, definition, onGlossaryClick }: TermTooltipProps) {
  const navigate = useNavigate();

  const handleGlossaryClick = () => {
    if (onGlossaryClick) {
      onGlossaryClick();
    } else {
      navigate("/glossary");
    }
  };

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button 
            type="button"
            className="inline-flex items-center justify-center h-4 w-4 ml-1 text-muted-foreground hover:text-foreground transition-colors cursor-help"
            aria-label={`Learn more about ${term}`}
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="max-w-xs p-3 bg-popover text-popover-foreground border border-border shadow-lg z-50"
        >
          <p className="text-sm font-medium mb-1">{term}</p>
          <p className="text-xs text-muted-foreground mb-2">{definition}</p>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs text-primary"
            onClick={(e) => {
              e.stopPropagation();
              handleGlossaryClick();
            }}
          >
            View in Glossary →
          </Button>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
