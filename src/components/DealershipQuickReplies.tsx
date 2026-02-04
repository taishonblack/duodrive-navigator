import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Clipboard, Send, Zap, MessageSquare, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  dealershipQuickReplyConfig,
  pickExpandedGroupId,
  replacePlaceholders,
  getActionById,
  DealContext,
  QuickReplyAction,
} from "@/config/dealershipQuickReplies";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DealershipQuickRepliesProps {
  dealContext: DealContext;
  isDealershipMode: boolean;
  onSendMessage: (text: string) => void;
  targets?: {
    targetOTD?: string;
    targetTermMonths?: string;
  };
}

export function DealershipQuickReplies({
  dealContext,
  isDealershipMode,
  onSendMessage,
  targets,
}: DealershipQuickRepliesProps) {
  const config = dealershipQuickReplyConfig;
  
  const [expandedGroupId, setExpandedGroupId] = useState<string>(() => 
    pickExpandedGroupId(dealContext)
  );
  const [showAllChips, setShowAllChips] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [lastCoachTip, setLastCoachTip] = useState<string | null>(null);

  // Update expanded group when deal context changes
  useEffect(() => {
    if (!isDealershipMode) return;
    setExpandedGroupId(pickExpandedGroupId(dealContext));
  }, [isDealershipMode, dealContext]);

  // Build action index for quick lookup
  const actionsById = useMemo(() => {
    const map = new Map<string, QuickReplyAction>();
    for (const g of config.groups) {
      for (const a of g.actions) map.set(a.id, a);
    }
    return map;
  }, [config.groups]);

  if (!isDealershipMode) return null;

  const handleAction = (action: QuickReplyAction) => {
    const msg = replacePlaceholders(action.userSay, {
      targetOTD: targets?.targetOTD,
      targetTermMonths: targets?.targetTermMonths,
    });
    onSendMessage(msg);
    setLastCoachTip(action.coach);
    
    // Clear coach tip after 5 seconds
    setTimeout(() => setLastCoachTip(null), 5000);
  };

  const handlePasteSubmit = () => {
    if (!pasteText.trim()) return;
    onSendMessage(pasteText.trim());
    setPasteText("");
    setPasteOpen(false);
  };

  // Always-visible chips (top row)
  const alwaysActions = config.alwaysVisible
    .map((id) => actionsById.get(id))
    .filter(Boolean) as QuickReplyAction[];

  // Expanded group for secondary chips
  const expandedGroup = config.groups.find((g) => g.id === expandedGroupId) || config.groups[0];
  
  const CHIP_LIMIT = 6;
  const secondRow = expandedGroup.actions.slice(
    0, 
    showAllChips ? expandedGroup.actions.length : Math.max(0, CHIP_LIMIT - alwaysActions.length)
  );

  return (
    <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1 bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30">
            <Zap className="h-3 w-3" />
            Dealership Mode
          </Badge>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Tap to say out loud
          </span>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPasteOpen(true)}
          className="gap-1 text-xs"
        >
          <Clipboard className="h-3 w-3" />
          Paste counter
        </Button>
      </div>

      {/* Coach tip (shows after action) */}
      {lastCoachTip && (
        <div className="flex items-start gap-2 p-2 rounded-lg bg-muted border border-border text-sm animate-in fade-in slide-in-from-top-1 duration-200">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-muted-foreground">{lastCoachTip}</p>
        </div>
      )}

      {/* Quick action chips */}
      <div className="flex flex-wrap gap-2">
        {alwaysActions.map((action) => (
          <Tooltip key={action.id}>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAction(action)}
                className="text-xs h-8"
              >
                {action.label}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[200px]">
              <p className="text-xs">{action.coach}</p>
            </TooltipContent>
          </Tooltip>
        ))}
        
        {secondRow.map((action) => (
          <Tooltip key={action.id}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleAction(action)}
                className="text-xs h-8 text-muted-foreground hover:text-foreground"
              >
                {action.label}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[200px]">
              <p className="text-xs">{action.coach}</p>
            </TooltipContent>
          </Tooltip>
        ))}
        
        {expandedGroup.actions.length + alwaysActions.length > CHIP_LIMIT && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAllChips((v) => !v)}
            className="text-xs h-8 text-muted-foreground"
          >
            {showAllChips ? "Less" : "More..."}
          </Button>
        )}
      </div>

      {/* Collapsible category sections */}
      <div className="space-y-1 pt-1 border-t border-border/50">
        {config.groups.map((group) => (
          <Collapsible
            key={group.id}
            open={expandedGroupId === group.id}
            onOpenChange={(open) => setExpandedGroupId(open ? group.id : "")}
          >
            <CollapsibleTrigger className="flex w-full items-center justify-between py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              <span>{group.title}</span>
              {expandedGroupId === group.id ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-1 pb-2">
              <div className="flex flex-wrap gap-2">
                {group.actions.map((action) => (
                  <Tooltip key={action.id}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleAction(action)}
                        className="text-xs h-7"
                      >
                        {action.label}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[220px]">
                      <p className="text-xs font-medium mb-1">Say:</p>
                      <p className="text-xs text-muted-foreground italic mb-2">
                        "{action.userSay.slice(0, 80)}{action.userSay.length > 80 ? '...' : ''}"
                      </p>
                      <p className="text-xs">{action.coach}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>

      {/* Paste dealer counter modal */}
      <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              {config.pasteCounterFlow.title}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {config.pasteCounterFlow.prompt}
            </p>
            
            <Textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Example: OTD $33,710. $612/mo. 72 months at 8.9%. $1,295 protection package. Doc fee $699."
              className="min-h-[120px] resize-y"
            />
            
            <div className="flex flex-wrap gap-2">
              {config.pasteCounterFlow.followupQuestions.map((q, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onSendMessage(q);
                    setPasteOpen(false);
                  }}
                  className="text-xs"
                >
                  {q}
                </Button>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setPasteOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handlePasteSubmit} 
              disabled={!pasteText.trim()}
              className="gap-1"
            >
              <Send className="h-4 w-4" />
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
