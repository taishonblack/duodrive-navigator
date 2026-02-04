import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  Target,
  MessageSquare,
  TrendingUp,
  Shield,
  Footprints,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PremiumDecisionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string | null;
  dealName?: string;
}

const PREMIUM_BENEFITS = [
  {
    icon: Target,
    text: "A clear fair price range",
  },
  {
    icon: Shield,
    text: "Dealer-ready negotiation scripts",
  },
  {
    icon: TrendingUp,
    text: "A breakdown of fees that matter vs. fluff",
  },
  {
    icon: MessageSquare,
    text: "Exact wording you can use with the dealer",
  },
  {
    icon: Footprints,
    text: "A confidence check so you don't second-guess later",
  },
];

export function PremiumDecisionModal({
  open,
  onOpenChange,
  dealId,
  dealName,
}: PremiumDecisionModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleUnlock = async () => {
    if (!dealId) {
      toast.error("Please save your deal first to unlock premium analysis");
      return;
    }

    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to unlock deal analysis");
        return;
      }

      const { data, error } = await supabase.functions.invoke(
        "create-deal-analysis-checkout",
        {
          body: { dealId },
        }
      );

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error) {
      console.error("Error creating checkout:", error);
      toast.error("Failed to start checkout. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle className="text-xl">
            Unlock clarity before you decide.
          </DialogTitle>
          <DialogDescription className="text-base">
            You're close to making a real decision. Premium gives you the confidence to move forward — or walk away.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm font-medium text-foreground">
            Premium gives you:
          </p>

          <ul className="space-y-3">
            {PREMIUM_BENEFITS.map((benefit, index) => (
              <li key={index} className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <benefit.icon className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-sm text-muted-foreground leading-relaxed">
                  {benefit.text}
                </span>
              </li>
            ))}
          </ul>

          {/* Price */}
          <div className="text-center pt-2">
            <div className="inline-flex items-baseline gap-1">
              <span className="text-2xl font-bold text-primary">$9.99</span>
              <span className="text-sm text-muted-foreground">· one-time</span>
              <span className="text-sm text-muted-foreground">· for this deal</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              No subscription. Unlimited access for this car.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Button
            onClick={handleUnlock}
            disabled={isLoading || !dealId}
            size="lg"
            className="w-full"
          >
            {isLoading ? "Processing..." : "Unlock Premium Analysis"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Keep going without it
          </Button>
        </div>

        {/* Reassurance - post-purchase anxiety reducer */}
        <p className="text-xs text-center text-muted-foreground pt-2">
          This is about walking in prepared — not buying blind. Nothing here locks you in.
        </p>
      </DialogContent>
    </Dialog>
  );
}

// Trigger conditions checker
export interface PremiumTriggerContext {
  hasNegotiatedPrice: boolean;
  hasTradeIn: boolean;
  tradeInValueMissing: boolean;
  hasDealerFees: boolean;
  dealerPressureDetected: boolean;
  isAtDealership: boolean;
  clickedPremiumTab: boolean;
}

export function shouldShowPremiumModal(context: PremiumTriggerContext): boolean {
  // Any one of these conditions triggers the modal
  return (
    (!context.hasNegotiatedPrice && context.hasTradeIn) || // Trade mentioned but not valued
    context.tradeInValueMissing ||
    context.dealerPressureDetected ||
    (context.clickedPremiumTab && !context.hasNegotiatedPrice) ||
    context.isAtDealership
  );
}
