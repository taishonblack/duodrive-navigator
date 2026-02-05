import { ReactNode } from "react";
import { Navbar } from "./Navbar";

interface MobileDealRoomLayoutProps {
  children: ReactNode;
}

/**
 * Mobile-specific layout for Deal Room that:
 * - Takes 100dvh viewport height
 * - Hides footer entirely
 * - Prevents body scroll
 * - Chat owns the screen
 */
export function MobileDealRoomLayout({ children }: MobileDealRoomLayoutProps) {
  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-background">
      <Navbar />
      <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
      {/* No footer on mobile Deal Room - chat is the primary screen */}
    </div>
  );
}
