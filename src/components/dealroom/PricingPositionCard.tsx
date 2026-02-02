import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PricingPositionCardProps {
  dealPriceGapPercent: number;
  dealPriceGap: number;
}

type PricingLevel = "low" | "typical" | "high" | "very-high";

function getPricingLevel(gapPercent: number): PricingLevel {
  if (gapPercent <= -5) return "low";
  if (gapPercent <= 10) return "typical";
  if (gapPercent <= 25) return "high";
  return "very-high";
}

function getPricingLabel(level: PricingLevel): string {
  switch (level) {
    case "low": return "Below Typical";
    case "typical": return "Typical";
    case "high": return "High";
    case "very-high": return "Very High";
  }
}

function getPricingDescription(level: PricingLevel, gapPercent: number): string {
  switch (level) {
    case "low":
      return "This vehicle is priced below typical market listings. A good starting point.";
    case "typical":
      return "This vehicle is priced in line with similar listings. Fair market positioning.";
    case "high":
      return "This vehicle is priced above typical listings. Most buyers would expect negotiation.";
    case "very-high":
      return "This vehicle is priced well above similar listings. Consider negotiation or alternatives.";
  }
}

export function PricingPositionCard({ dealPriceGapPercent, dealPriceGap }: PricingPositionCardProps) {
  const level = getPricingLevel(dealPriceGapPercent);
  const label = getPricingLabel(level);
  const description = getPricingDescription(level, dealPriceGapPercent);
  
  const levels: PricingLevel[] = ["low", "typical", "high", "very-high"];
  
  return (
    <Card className="border border-border shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
            level === "low" ? "bg-green-100 dark:bg-green-900/30" :
            level === "typical" ? "bg-blue-100 dark:bg-blue-900/30" :
            level === "high" ? "bg-yellow-100 dark:bg-yellow-900/30" :
            "bg-red-100 dark:bg-red-900/30"
          }`}>
            <TrendingUp className={`h-4 w-4 ${
              level === "low" ? "text-green-600 dark:text-green-400" :
              level === "typical" ? "text-blue-600 dark:text-blue-400" :
              level === "high" ? "text-yellow-600 dark:text-yellow-400" :
              "text-red-600 dark:text-red-400"
            }`} />
          </div>
          How Aggressively This Vehicle Is Priced
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Visual Scale */}
        <div className="relative">
          <div className="flex gap-1">
            {levels.map((l) => (
              <div
                key={l}
                className={`flex-1 h-3 rounded-sm transition-all ${
                  l === level ? "ring-2 ring-offset-2 ring-foreground/20" : ""
                } ${
                  l === "low" ? "bg-green-500" :
                  l === "typical" ? "bg-blue-500" :
                  l === "high" ? "bg-yellow-500" :
                  "bg-red-500"
                }`}
              />
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>Low</span>
            <span>Typical</span>
            <span>High</span>
            <span>Very High</span>
          </div>
        </div>
        
        {/* Current Status */}
        <div className={`p-4 rounded-xl ${
          level === "low" ? "bg-green-50 dark:bg-green-950/30" :
          level === "typical" ? "bg-blue-50 dark:bg-blue-950/30" :
          level === "high" ? "bg-yellow-50 dark:bg-yellow-950/30" :
          "bg-red-50 dark:bg-red-950/30"
        }`}>
          <p className={`font-semibold mb-1 ${
            level === "low" ? "text-green-700 dark:text-green-300" :
            level === "typical" ? "text-blue-700 dark:text-blue-300" :
            level === "high" ? "text-yellow-700 dark:text-yellow-300" :
            "text-red-700 dark:text-red-300"
          }`}>
            {label}
          </p>
          <p className="text-sm text-muted-foreground">
            {description}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
