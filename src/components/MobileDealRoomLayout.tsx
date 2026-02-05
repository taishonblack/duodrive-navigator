import { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { MobileDealRoomTabBar, DealRoomTab } from "./MobileDealRoomTabBar";

interface MobileDealRoomLayoutProps {
  children: ReactNode;
  activeTab: DealRoomTab;
  onTabChange: (tab: DealRoomTab) => void;
  isLocked?: boolean;
}

/**
 * Mobile-specific layout for Deal Room that:
 * - Takes 100dvh viewport height
 * - Hides footer entirely
 * - Prevents body scroll
 * - Chat owns the screen
 * - Persistent bottom tab navigation
 */
export function MobileDealRoomLayout({ 
  children, 
  activeTab, 
  onTabChange,
  isLocked = false,
}: MobileDealRoomLayoutProps) {
  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-background">
      <Navbar />
      <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
      <MobileDealRoomTabBar 
        activeTab={activeTab} 
        onTabChange={onTabChange}
        isLocked={isLocked}
      />
    </div>
  );
}
