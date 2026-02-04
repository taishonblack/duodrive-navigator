import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, CheckCircle, Shield, TrendingUp, MessageSquare, Target, Footprints, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DealAnalysisPaywallProps {
  dealId: string;
  dealName?: string;
  onUnlocked?: () => void;
}

const DealAnalysisPaywall = ({ dealId, dealName, onUnlocked }: DealAnalysisPaywallProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleUnlock = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to unlock deal analysis");
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-deal-analysis-checkout", {
        body: { dealId },
      });

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

  const features = [
    {
      icon: Shield,
      title: "Fee Clarity",
      description: "See every fee labeled as fair, questionable, or unnecessary — so you know what to challenge.",
    },
    {
      icon: Target,
      title: "Counter-Offer Range",
      description: "A realistic price range you can negotiate with confidence, not a fantasy number.",
    },
    {
      icon: TrendingUp,
      title: "Market Comparison",
      description: "Compare this car to similar listings nearby and in neighboring states.",
    },
    {
      icon: MessageSquare,
      title: "Dealer-Ready Scripts",
      description: "Word-for-word responses you can actually say at the dealership — tailored to this deal.",
    },
    {
      icon: Footprints,
      title: "Walk-Away Guidance",
      description: "A clear line where walking away makes more sense than pushing forward.",
    },
  ];

  return (
    <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Lock className="h-8 w-8 text-primary" />
        </div>
        <CardTitle className="text-2xl">When it's time to act — not just understand</CardTitle>
        <CardDescription className="text-base mt-2">
          {dealName ? `Premium analysis for "${dealName}"` : "Unlock Premium Deal Analysis"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Core value proposition */}
        <div className="text-center p-4 rounded-xl bg-muted/50">
          <p className="text-sm text-muted-foreground">
            Free DuoDrive helps you <span className="font-medium text-foreground">understand</span> the deal.
          </p>
          <p className="text-sm text-foreground font-medium mt-1">
            Premium DuoDrive helps you <span className="text-primary">negotiate</span> it — calmly and confidently.
          </p>
        </div>

        {/* Features list */}
        <div className="space-y-4">
          {features.map((feature, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <feature.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-medium">{feature.title}</h4>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Preview Example Section */}
        <PreviewExampleSection />

        <div className="border-t pt-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-3xl font-bold text-primary">$9.99</span>
            <div className="text-left text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                <span>10-hour premium access</span>
              </div>
              <p>Analyze multiple cars. No subscription.</p>
            </div>
          </div>
          
          <p className="text-xs text-center text-muted-foreground mb-4">
            Perfect if you're shopping in one sitting or visiting multiple dealerships.
          </p>
          
          <Button 
            onClick={handleUnlock} 
            disabled={isLoading}
            className="w-full h-12 text-lg"
            size="lg"
          >
            {isLoading ? "Processing..." : "Unlock Premium Analysis"}
          </Button>
          
          <div className="flex items-center justify-center gap-2 mt-3 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>Most buyers recover the cost with one good counter-offer</span>
          </div>

          <p className="text-xs text-center text-muted-foreground mt-4 italic">
            "One good counter usually saves more than the cost of Premium."
          </p>
        </div>

        {/* Trust builder */}
        <div className="pt-4 border-t text-center">
          <p className="text-xs text-muted-foreground">
            We don't sell cars · We don't take dealer commissions · DuoDrive works for you
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

// Static preview example component
function PreviewExampleSection() {
  return (
    <div className="border-t pt-6">
      <h3 className="text-sm font-semibold text-foreground mb-1">
        What Premium Looks Like in Practice
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        Here's a real example of what Quinn generates once your deal is unlocked.
      </p>

      <div className="rounded-xl border border-border bg-card/50 p-4 space-y-4 text-sm">
        {/* Example header */}
        <div className="pb-3 border-b border-border">
          <p className="text-xs text-muted-foreground">Example</p>
          <p className="font-medium text-foreground">2024 Toyota Camry SE — Dealer Quote $29,800</p>
        </div>

        {/* Deal Reality Check */}
        <div>
          <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">Deal Reality Check</p>
          <ul className="space-y-1 text-muted-foreground">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
              Market average nearby: <span className="text-foreground font-medium">$27,900</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
              Dealer price: <span className="text-destructive font-medium">$1,900 above market</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Reasonable counter range: <span className="text-foreground font-medium">$27,200 – $27,700</span>
            </li>
          </ul>
        </div>

        {/* Fees to Challenge */}
        <div>
          <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">Fees to Challenge</p>
          <ul className="space-y-1 text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-1.5" />
              <span>Dealer documentation fee: $699 → <span className="text-yellow-600 dark:text-yellow-400 font-medium">questionable</span></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive mt-1.5" />
              <span>Protection package: $1,295 → <span className="text-destructive font-medium">optional / removable</span></span>
            </li>
          </ul>
        </div>

        {/* What to Say */}
        <div>
          <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">What to Say at the Dealership</p>
          <div className="bg-muted/50 rounded-lg p-3 text-foreground italic border-l-2 border-primary">
            "I'm ready to move forward today if we can get closer to market. Comparable listings are around $27,500 — can you meet me there?"
          </div>
        </div>

        {/* Walk-Away Line */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Walk-Away Line</p>
          <div className="bg-destructive/10 rounded-lg p-3 text-foreground italic border-l-2 border-destructive">
            "I like the car, but at this number I'm going to step back and think it through."
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-xs text-muted-foreground pt-2 border-t border-border">
          Example only. Your actual analysis is tailored to your deal, location, and financing.
        </p>
      </div>
    </div>
  );
}

export default DealAnalysisPaywall;
