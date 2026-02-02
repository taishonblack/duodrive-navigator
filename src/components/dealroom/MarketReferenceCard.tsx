import { TrendingUp, TrendingDown, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MarketReferenceCardProps {
  trueMarketPrice: number;
  askingPrice: number;
}

export function MarketReferenceCard({ trueMarketPrice, askingPrice }: MarketReferenceCardProps) {
  // Calculate a reasonable range around the market price (±10%)
  const lowRange = Math.round(trueMarketPrice * 0.90);
  const highRange = Math.round(trueMarketPrice * 1.10);
  
  return (
    <Card className="border border-border shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          Market Reference Range
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-center p-4 rounded-xl bg-muted">
          <p className="text-sm text-muted-foreground mb-1">Similar vehicles are commonly listed between</p>
          <p className="text-2xl font-bold text-foreground">
            ${lowRange.toLocaleString()} – ${highRange.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">(before dealer add-ons)</p>
        </div>
        
        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border">
          <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            This is a reference point to understand pricing — <strong>not a suggested offer</strong>. 
            Use it to gauge whether the asking price is in line with the market.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
