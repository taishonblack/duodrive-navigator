import { useState } from "react";
import { HelpCircle, X, Bot, MessageSquare, Upload, Camera, Zap, Sparkles, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";

interface MobileHelpButtonProps {
  /** If true, renders only the trigger button (no floating position) */
  inline?: boolean;
  /** Custom class for the trigger button */
  className?: string;
}

/**
 * Mobile help button that opens the "How to use DuoDrive" tips in a drawer.
 * Can be used inline (in header) or floating (legacy).
 */
export function MobileHelpButton({ inline = false, className }: MobileHelpButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      {inline ? (
        <Button
          variant="ghost"
          size="icon"
          className={className ?? "h-8 w-8"}
          aria-label="How to use DuoDrive"
          onClick={() => setOpen(true)}
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-20 right-4 z-40 h-12 w-12 rounded-full shadow-elevated bg-card border-border"
          aria-label="How to use DuoDrive"
          onClick={() => setOpen(true)}
        >
          <HelpCircle className="h-5 w-5" />
        </Button>
      )}
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Bot className="h-4 w-4" />
            </div>
            <DrawerTitle>How to use DuoDrive</DrawerTitle>
          </div>
          <DrawerClose asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </DrawerClose>
        </DrawerHeader>
        
        <div className="p-4 overflow-y-auto space-y-4 text-sm">
          <p className="text-muted-foreground">
            Quinn helps you evaluate a real dealership deal — not sell you a car.
          </p>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <MessageSquare className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <p className="text-muted-foreground">
                Start by typing the car you're considering (year, make, model).
              </p>
            </div>

            <div className="flex items-start gap-3">
              <Upload className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <p className="text-muted-foreground">
                Paste numbers from the quote (price, down payment, APR, term, fees).
              </p>
            </div>

            <div className="flex items-start gap-3">
              <Camera className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <p className="text-muted-foreground">
                Upload a photo of the window sticker — Quinn will extract details.
              </p>
            </div>
          </div>

          {/* At the dealership tip */}
          <div className="bg-primary/10 rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <span className="font-medium text-foreground text-sm">At the dealership?</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Tell Quinn "I'm at the dealership" for faster, tactical answers.
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <p className="text-muted-foreground text-xs">
              <strong className="text-foreground">As you chat, Quinn will:</strong>
            </p>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <Sparkles className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                Build your deal step-by-step
              </li>
              <li className="flex items-start gap-2">
                <Sparkles className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                Explain terms like APR and fees
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                Flag anything risky or overpriced
              </li>
            </ul>
          </div>

          <p className="text-xs text-muted-foreground border-t border-border pt-3">
            <strong>Tip:</strong> You can pause anytime. Nothing here locks you in.
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
