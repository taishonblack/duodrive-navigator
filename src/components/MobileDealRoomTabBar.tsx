import { Bot, Upload, Calculator, MessageCircle, BarChart3, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DealRoomTab = "copilot" | "deal" | "calculator" | "scripts" | "overview";

interface MobileDealRoomTabBarProps {
  activeTab: DealRoomTab;
  onTabChange: (tab: DealRoomTab) => void;
  isLocked?: boolean;
}

const tabs = [
  { id: "copilot" as const, label: "Quinn", icon: Bot },
  { id: "deal" as const, label: "Deal", icon: Upload },
  { id: "calculator" as const, label: "Calc", icon: Calculator },
  { id: "scripts" as const, label: "Say", icon: MessageCircle, showLock: true },
  { id: "overview" as const, label: "Score", icon: BarChart3 },
];

/**
 * Bottom tab navigation for mobile Deal Room.
 * Persistent across all Deal Room views (app-like experience).
 */
export function MobileDealRoomTabBar({
  activeTab,
  onTabChange,
  isLocked = false,
}: MobileDealRoomTabBarProps) {
  return (
    <nav className="shrink-0 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5 gap-0 px-0.5 py-0.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <Button
              key={tab.id}
              variant="ghost"
              size="sm"
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex-col h-auto py-1.5 gap-0.5 relative rounded-md transition-colors min-h-0",
                isActive && "bg-accent text-accent-foreground"
              )}
            >
              <Icon className={cn("h-4 w-4", isActive && "text-primary")} />
              <span className={cn(
                "text-[9px] font-medium leading-tight",
                isActive ? "text-primary" : "text-muted-foreground"
              )}>
                {tab.label}
              </span>
              {tab.showLock && isLocked && (
                <span className="absolute top-0.5 right-1.5 flex items-center justify-center h-3 w-3 rounded-full bg-amber-500 text-white">
                  <Lock className="h-2 w-2" />
                </span>
              )}
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
