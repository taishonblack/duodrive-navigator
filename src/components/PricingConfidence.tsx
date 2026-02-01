import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Target, AlertTriangle, DollarSign, Loader2, MapPin, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface DealData {
  year: string;
  make: string;
  model: string;
  trim?: string;
  mileage?: string;
  buyerZip?: string;
  askingPrice?: string;
}

interface PricingResult {
  fairMarketValue: number;
  priceRanges: {
    steal: number;
    low: number;
    target: number;
    walkAway: number;
  };
  confidence: "low" | "medium" | "high";
  regionalAdjustment: number;
  factors: {
    mileageImpact: string;
    ageImpact: string;
    demandLevel: string;
    seasonalTrend: string;
  };
  reasoning: string;
}

interface PricingConfidenceProps {
  dealData: DealData;
  onPricingResult?: (result: PricingResult) => void;
}

const confidenceColors = {
  low: "text-yellow-600 dark:text-yellow-400",
  medium: "text-blue-600 dark:text-blue-400",
  high: "text-green-600 dark:text-green-400",
};

const confidenceBgColors = {
  low: "bg-yellow-50 dark:bg-yellow-950/30",
  medium: "bg-blue-50 dark:bg-blue-950/30",
  high: "bg-green-50 dark:bg-green-950/30",
};

export function PricingConfidence({ dealData, onPricingResult }: PricingConfidenceProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<PricingResult | null>(null);
  const { toast } = useToast();

  const hasMinimumData = dealData.year && dealData.make && dealData.model;
  const askingPrice = dealData.askingPrice ? parseInt(dealData.askingPrice.replace(/[^0-9]/g, '')) : 0;

  const fetchPricing = async () => {
    if (!hasMinimumData) {
      toast({
        title: "More info needed",
        description: "Please enter Year, Make, and Model first.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pricing-confidence`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            year: parseInt(dealData.year),
            make: dealData.make,
            model: dealData.model,
            trim: dealData.trim || undefined,
            mileage: dealData.mileage ? parseInt(dealData.mileage.replace(/[^0-9]/g, '')) : 50000,
            condition: "good",
            zipCode: dealData.buyerZip || undefined,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to get pricing");
      }

      const data: PricingResult = await response.json();
      setResult(data);
      onPricingResult?.(data);

      toast({
        title: "Pricing Analysis Complete",
        description: `Fair market value: $${data.fairMarketValue.toLocaleString()}`,
      });
    } catch (error) {
      console.error("Pricing error:", error);
      toast({
        title: "Pricing Failed",
        description: error instanceof Error ? error.message : "Could not get pricing",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getPricePosition = (price: number) => {
    if (!result) return null;
    const { steal, low, target, walkAway } = result.priceRanges;
    
    if (price <= steal) return { label: "Steal!", color: "text-green-600 dark:text-green-400", bg: "bg-green-100 dark:bg-green-900/40" };
    if (price <= low) return { label: "Good Deal", color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/20" };
    if (price <= target) return { label: "Fair Price", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20" };
    if (price <= walkAway) return { label: "Slightly High", color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-900/20" };
    return { label: "Walk Away", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20" };
  };

  const vehicleInfo = [dealData.year, dealData.make, dealData.model, dealData.trim]
    .filter(Boolean)
    .join(" ");

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Pricing Confidence
          </CardTitle>
          <Button 
            onClick={fetchPricing} 
            disabled={!hasMinimumData || isLoading}
            size="sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : result ? (
              "Refresh"
            ) : (
              "Get Price Ranges"
            )}
          </Button>
        </div>
        {vehicleInfo && (
          <p className="text-sm text-muted-foreground">{vehicleInfo}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {!result && !isLoading && (
          <div className="text-center py-6 text-muted-foreground">
            <Target className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">
              {hasMinimumData 
                ? "Click 'Get Price Ranges' to see fair market value and negotiation targets"
                : "Enter vehicle details to get pricing guidance"}
            </p>
          </div>
        )}

        {result && (
          <div className="space-y-4 animate-fade-in">
            {/* Fair Market Value */}
            <div className="text-center p-4 rounded-xl bg-primary/10 border border-primary/20">
              <p className="text-xs font-medium text-muted-foreground mb-1">Fair Market Value</p>
              <p className="text-3xl font-bold text-foreground">
                ${result.fairMarketValue.toLocaleString()}
              </p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${confidenceBgColors[result.confidence]} ${confidenceColors[result.confidence]}`}>
                  {result.confidence.charAt(0).toUpperCase() + result.confidence.slice(1)} Confidence
                </span>
                {result.regionalAdjustment !== 0 && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {result.regionalAdjustment > 0 ? '+' : ''}{result.regionalAdjustment}% regional
                  </span>
                )}
              </div>
            </div>

            {/* Price Comparison if asking price is set */}
            {askingPrice > 0 && (
              <div className={`p-3 rounded-lg ${getPricePosition(askingPrice)?.bg}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Asking Price vs Market</p>
                    <p className={`text-lg font-bold ${getPricePosition(askingPrice)?.color}`}>
                      {getPricePosition(askingPrice)?.label}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Difference</p>
                    <p className={`font-semibold ${askingPrice <= result.fairMarketValue ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {askingPrice <= result.fairMarketValue ? '-' : '+'}${Math.abs(askingPrice - result.fairMarketValue).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Price Ranges */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Negotiation Targets</p>
              <div className="grid grid-cols-2 gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 cursor-help">
                        <div className="flex items-center gap-2 mb-1">
                          <TrendingDown className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <span className="text-xs font-medium text-green-700 dark:text-green-300">Steal</span>
                        </div>
                        <p className="text-lg font-bold text-green-700 dark:text-green-300">
                          ${result.priceRanges.steal.toLocaleString()}
                        </p>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">15-20% below market. If you can get this price, take it immediately!</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 cursor-help">
                        <div className="flex items-center gap-2 mb-1">
                          <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Good Deal</span>
                        </div>
                        <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                          ${result.priceRanges.low.toLocaleString()}
                        </p>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">5-10% below market. A solid deal worth pursuing.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 cursor-help">
                        <div className="flex items-center gap-2 mb-1">
                          <Target className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Target</span>
                        </div>
                        <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
                          ${result.priceRanges.target.toLocaleString()}
                        </p>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Fair negotiated price. Your realistic goal for negotiations.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 cursor-help">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                          <span className="text-xs font-medium text-red-700 dark:text-red-300">Walk Away</span>
                        </div>
                        <p className="text-lg font-bold text-red-700 dark:text-red-300">
                          ${result.priceRanges.walkAway.toLocaleString()}
                        </p>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Maximum you should pay. Above this, walk away.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* Factors */}
            <div className="p-3 rounded-lg bg-muted/50 space-y-2">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Market Factors</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Demand:</span>
                  <span className="font-medium text-foreground capitalize">{result.factors.demandLevel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mileage:</span>
                  <span className="font-medium text-foreground">{result.factors.mileageImpact.split(' ').slice(0, 3).join(' ')}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{result.reasoning}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
