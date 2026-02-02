import { Info, Search, BarChart3, Car } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface WhyThisMattersCardProps {
  affordabilityStatus: "fits_budget" | "stretch_warning" | "outside_budget" | "blocked";
  onShowAlternatives?: () => void;
  onShowWhatWouldWork?: () => void;
  onExploreLowerTrims?: () => void;
}

export function WhyThisMattersCard({
  affordabilityStatus,
  onShowAlternatives,
  onShowWhatWouldWork,
  onExploreLowerTrims,
}: WhyThisMattersCardProps) {
  const isStretched = affordabilityStatus !== "fits_budget";
  
  if (!isStretched) {
    return null; // Don't show if everything fits
  }
  
  return (
    <Card className="border border-border shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
            <Info className="h-4 w-4 text-muted-foreground" />
          </div>
          Why Conservative Guidelines Matter
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Cars are depreciating assets. Staying within conservative spending ranges helps reduce stress, 
          preserve savings, and avoid long-term tradeoffs — even at higher incomes.
        </p>
        
        <p className="text-sm text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">Lenders ask "What's the maximum?"</span>
          <br />
          <span className="font-medium text-primary">DuoDrive asks "What's comfortable long-term?"</span>
        </p>
        
        {/* Action Buttons */}
        <div className="grid gap-2 pt-2">
          {onShowAlternatives && (
            <Button 
              variant="outline" 
              className="w-full justify-start gap-3 h-auto py-3"
              onClick={onShowAlternatives}
            >
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Search className="h-4 w-4 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-medium text-foreground">Show similar vehicles within my budget</p>
                <p className="text-xs text-muted-foreground">Find comparable options that fit better</p>
              </div>
            </Button>
          )}
          
          {onShowWhatWouldWork && (
            <Button 
              variant="outline" 
              className="w-full justify-start gap-3 h-auto py-3"
              onClick={onShowWhatWouldWork}
            >
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <BarChart3 className="h-4 w-4 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-medium text-foreground">What would make this car work?</p>
                <p className="text-xs text-muted-foreground">See what needs to change for this to fit</p>
              </div>
            </Button>
          )}
          
          {onExploreLowerTrims && (
            <Button 
              variant="outline" 
              className="w-full justify-start gap-3 h-auto py-3"
              onClick={onExploreLowerTrims}
            >
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Car className="h-4 w-4 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-medium text-foreground">Explore used or lower trims</p>
                <p className="text-xs text-muted-foreground">Same model, more affordable options</p>
              </div>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
