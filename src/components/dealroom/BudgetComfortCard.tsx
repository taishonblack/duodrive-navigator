import { CheckCircle2, AlertTriangle, ShieldAlert, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AffordabilityStatus } from "@/lib/duodriveScore";

interface BudgetComfortCardProps {
  affordabilityStatus: AffordabilityStatus;
  priceToIncomeRatio: number;
  paymentBurdenPercent: number;
  operatingCostBurden: number;
  monthlyPayment: number;
  monthlyIncome: number;
  askingPrice: number;
  customerMaxSafePrice: number;
  isAcknowledged: boolean;
  onAcknowledge: () => void;
}

type ComfortLevel = "comfortable" | "stretch" | "high-risk";

function getComfortLevel(status: AffordabilityStatus): ComfortLevel {
  if (status === "fits_budget") return "comfortable";
  if (status === "stretch_warning") return "stretch";
  return "high-risk";
}

function getComfortLabel(level: ComfortLevel): string {
  switch (level) {
    case "comfortable": return "Comfortable";
    case "stretch": return "Stretch";
    case "high-risk": return "High Risk for Your Budget";
  }
}

function getComfortDescription(level: ComfortLevel, priceToIncomeRatio: number): string {
  switch (level) {
    case "comfortable":
      return "This vehicle fits comfortably within recommended affordability guidelines. The monthly costs should be manageable alongside your other expenses.";
    case "stretch":
      return "This vehicle is at the edge of recommended affordability thresholds. While manageable, it may reduce your financial flexibility month-to-month.";
    case "high-risk":
      return `Vehicles at this price level (${priceToIncomeRatio.toFixed(0)}% of annual income) typically require a higher income or larger down payment to feel comfortable long-term.`;
  }
}

export function BudgetComfortCard({
  affordabilityStatus,
  priceToIncomeRatio,
  paymentBurdenPercent,
  operatingCostBurden,
  monthlyPayment,
  monthlyIncome,
  askingPrice,
  customerMaxSafePrice,
  isAcknowledged,
  onAcknowledge,
}: BudgetComfortCardProps) {
  const level = getComfortLevel(affordabilityStatus);
  const label = getComfortLabel(level);
  const description = getComfortDescription(level, priceToIncomeRatio);
  
  const Icon = level === "comfortable" ? CheckCircle2 : 
               level === "stretch" ? AlertTriangle : ShieldAlert;
  
  return (
    <Card className={`border-2 shadow-card ${
      level === "comfortable" ? "border-green-200 dark:border-green-800" :
      level === "stretch" ? "border-yellow-200 dark:border-yellow-800" :
      "border-red-200 dark:border-red-800"
    }`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
            level === "comfortable" ? "bg-green-100 dark:bg-green-900/30" :
            level === "stretch" ? "bg-yellow-100 dark:bg-yellow-900/30" :
            "bg-red-100 dark:bg-red-900/30"
          }`}>
            <Icon className={`h-4 w-4 ${
              level === "comfortable" ? "text-green-600 dark:text-green-400" :
              level === "stretch" ? "text-yellow-600 dark:text-yellow-400" :
              "text-red-600 dark:text-red-400"
            }`} />
          </div>
          Budget Comfort Check
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Badge */}
        <div className={`p-4 rounded-xl ${
          level === "comfortable" ? "bg-green-50 dark:bg-green-950/30" :
          level === "stretch" ? "bg-yellow-50 dark:bg-yellow-950/30" :
          "bg-red-50 dark:bg-red-950/30"
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <Icon className={`h-5 w-5 ${
              level === "comfortable" ? "text-green-600 dark:text-green-400" :
              level === "stretch" ? "text-yellow-600 dark:text-yellow-400" :
              "text-red-600 dark:text-red-400"
            }`} />
            <p className={`font-semibold ${
              level === "comfortable" ? "text-green-700 dark:text-green-300" :
              level === "stretch" ? "text-yellow-700 dark:text-yellow-300" :
              "text-red-700 dark:text-red-300"
            }`}>
              {label}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        
        {/* Quick Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted">
            <p className="text-xs text-muted-foreground">Monthly Payment</p>
            <p className="text-lg font-bold text-foreground">
              ${monthlyPayment.toLocaleString()}
            </p>
            <p className={`text-xs ${
              paymentBurdenPercent <= 12 ? "text-green-600 dark:text-green-400" :
              paymentBurdenPercent <= 15 ? "text-yellow-600 dark:text-yellow-400" :
              "text-red-600 dark:text-red-400"
            }`}>
              {paymentBurdenPercent.toFixed(0)}% of income
            </p>
          </div>
          <div className="p-3 rounded-lg bg-muted">
            <p className="text-xs text-muted-foreground">Comfort Zone Max</p>
            <p className="text-lg font-bold text-foreground">
              ${customerMaxSafePrice.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">
              Based on your profile
            </p>
          </div>
        </div>
        
        {/* Why This Matters */}
        {level !== "comfortable" && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border">
            <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Even when monthly payments look manageable, higher-priced vehicles increase insurance costs, 
              reduce financial flexibility, and raise long-term risk.
            </p>
          </div>
        )}
        
        {/* Acknowledgment for High Risk */}
        {level === "high-risk" && !isAcknowledged && (
          <div className="pt-3 border-t border-border">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Checkbox 
                id="acknowledge-risk"
                checked={isAcknowledged}
                onCheckedChange={() => onAcknowledge()}
                className="mt-0.5"
              />
              <label 
                htmlFor="acknowledge-risk"
                className="text-sm text-muted-foreground cursor-pointer leading-relaxed"
              >
                I understand this vehicle may not be a good financial fit, but I want to explore my options anyway.
              </label>
            </div>
          </div>
        )}
        
        {level === "high-risk" && isAcknowledged && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span>Risk acknowledged — proceed with caution</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
