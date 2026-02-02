import { DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface MonthlyRealityCardProps {
  monthlyPayment: number;
  insurance: number;
  fuelCost: number;
  maintenance: number;
  totalMonthlyCost: number;
  monthlyIncome: number;
  operatingCostBurden: number;
}

export function MonthlyRealityCard({
  monthlyPayment,
  insurance,
  fuelCost,
  maintenance,
  totalMonthlyCost,
  monthlyIncome,
  operatingCostBurden,
}: MonthlyRealityCardProps) {
  const costItems = [
    { label: "Loan Payment", value: monthlyPayment, color: "bg-blue-500" },
    { label: "Insurance", value: insurance, color: "bg-purple-500" },
    { label: "Fuel", value: fuelCost, color: "bg-orange-500" },
    { label: "Maintenance", value: maintenance, color: "bg-green-500" },
  ];
  
  const getBurdenColor = () => {
    if (operatingCostBurden <= 15) return "text-green-600 dark:text-green-400";
    if (operatingCostBurden <= 20) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };
  
  const getBurdenLabel = () => {
    if (operatingCostBurden <= 15) return "Healthy";
    if (operatingCostBurden <= 20) return "Manageable";
    if (operatingCostBurden <= 25) return "Stretched";
    return "Strained";
  };
  
  return (
    <Card className="border border-border shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          What This Costs You Monthly
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cost Breakdown */}
        <div className="space-y-2">
          {costItems.map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${item.color}`} />
                <span className="text-sm text-muted-foreground">{item.label}</span>
              </div>
              <span className="text-sm font-medium text-foreground">
                ${item.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
        
        {/* Total */}
        <div className="pt-3 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">Total Monthly Cost</span>
            <span className="text-2xl font-bold text-foreground">
              ${totalMonthlyCost.toLocaleString()}
            </span>
          </div>
        </div>
        
        {/* Burden Analysis */}
        <div className="p-4 rounded-xl bg-muted">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">% of Monthly Income</span>
            <div className="flex items-center gap-2">
              <span className={`text-lg font-bold ${getBurdenColor()}`}>
                {operatingCostBurden.toFixed(0)}%
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                operatingCostBurden <= 15 ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300" :
                operatingCostBurden <= 20 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300" :
                "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
              }`}>
                {getBurdenLabel()}
              </span>
            </div>
          </div>
          <Progress 
            value={Math.min(operatingCostBurden * 4, 100)} 
            className="h-2"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Many conservative finance guidelines suggest keeping total car costs under ~10–12% of income to protect savings and flexibility.
          </p>
        </div>
        
        {/* Helper Text */}
        <p className="text-xs text-muted-foreground text-center">
          Financial planners recommend evaluating total car costs — not just the loan payment.
        </p>
      </CardContent>
    </Card>
  );
}
