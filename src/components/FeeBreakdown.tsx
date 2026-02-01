import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScoreRing } from "@/components/ScoreRing";
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  DollarSign,
  ShieldCheck,
  Scale,
  Trash2,
  HelpCircle
} from "lucide-react";
import { TermTooltip } from "@/components/TermTooltip";

type FeeCategory = "legit" | "negotiable" | "junk";

interface FeeItem {
  name: string;
  amount: number;
  category: FeeCategory;
  description: string;
  tip: string;
}

interface FeeBreakdownProps {
  docFee: number;
  dealerFee: number;
  addOns: number;
  taxes: number;
  registration: number;
  askingPrice: number;
  className?: string;
  onGlossaryClick?: () => void;
}

const categoryConfig: Record<FeeCategory, { 
  label: string; 
  color: string; 
  bgColor: string; 
  icon: typeof CheckCircle2;
  textColor: string;
}> = {
  legit: { 
    label: "Legit", 
    color: "bg-green-500", 
    bgColor: "bg-green-100 dark:bg-green-900/30",
    textColor: "text-green-600 dark:text-green-400",
    icon: CheckCircle2 
  },
  negotiable: { 
    label: "Negotiable", 
    color: "bg-yellow-500", 
    bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
    textColor: "text-yellow-600 dark:text-yellow-400",
    icon: AlertTriangle 
  },
  junk: { 
    label: "Junk Fee", 
    color: "bg-red-500", 
    bgColor: "bg-red-100 dark:bg-red-900/30",
    textColor: "text-red-600 dark:text-red-400",
    icon: XCircle 
  },
};

function classifyDocFee(amount: number): FeeCategory {
  if (amount <= 0) return "legit";
  if (amount <= 500) return "legit"; // Standard doc fee
  if (amount <= 700) return "negotiable"; // High but sometimes standard
  return "junk"; // Excessive doc fee
}

function classifyDealerFee(amount: number): FeeCategory {
  if (amount <= 0) return "legit";
  if (amount <= 200) return "negotiable"; // Minor dealer fee
  return "junk"; // Dealer fees are mostly junk
}

function classifyAddOns(amount: number, askingPrice: number): FeeCategory {
  if (amount <= 0) return "legit";
  const percentage = (amount / askingPrice) * 100;
  if (percentage <= 1) return "negotiable"; // Small add-ons
  if (percentage <= 3) return "negotiable"; // Moderate add-ons
  return "junk"; // Excessive add-ons
}

export function FeeBreakdown({
  docFee,
  dealerFee,
  addOns,
  taxes,
  registration,
  askingPrice,
  className,
  onGlossaryClick,
}: FeeBreakdownProps) {
  const { fees, dealScore, totalFees, categorySummary, savingsPotential } = useMemo(() => {
    const feeItems: FeeItem[] = [];
    
    // Taxes - always legit
    if (taxes > 0) {
      feeItems.push({
        name: "Sales Tax",
        amount: taxes,
        category: "legit",
        description: "State/local sales tax required by law",
        tip: "This is a government-mandated fee and cannot be negotiated.",
      });
    }
    
    // Registration - always legit
    if (registration > 0) {
      feeItems.push({
        name: "Registration & Title",
        amount: registration,
        category: "legit",
        description: "DMV fees for registration and title transfer",
        tip: "Government fees - non-negotiable. Verify amount matches your state's DMV rates.",
      });
    }
    
    // Doc fee - depends on amount
    if (docFee > 0) {
      const category = classifyDocFee(docFee);
      feeItems.push({
        name: "Documentation Fee",
        amount: docFee,
        category,
        description: category === "legit" 
          ? "Standard paperwork processing fee"
          : category === "negotiable"
          ? "Doc fee is on the higher end"
          : "Doc fee is excessive - some states cap this",
        tip: category === "legit"
          ? "Standard fee, typically non-negotiable but verify against state limits."
          : category === "negotiable"
          ? "Try asking them to reduce this. Many states cap doc fees at $200-500."
          : "This is way above average. Demand they lower it or walk away.",
      });
    }
    
    // Dealer fee - almost always junk
    if (dealerFee > 0) {
      const category = classifyDealerFee(dealerFee);
      feeItems.push({
        name: "Dealer Fee / Admin Fee",
        amount: dealerFee,
        category,
        description: category === "junk" 
          ? "Pure dealer profit - this is a junk fee"
          : "Minor admin fee, still negotiable",
        tip: "Dealer fees are almost always negotiable. Ask them to remove it or reduce significantly.",
      });
    }
    
    // Add-ons - usually junk unless very small
    if (addOns > 0) {
      const category = classifyAddOns(addOns, askingPrice);
      const addOnExamples = "nitrogen tires, VIN etching, paint protection, fabric coating";
      feeItems.push({
        name: "Dealer Add-Ons",
        amount: addOns,
        category,
        description: category === "junk" 
          ? `Overpriced extras like ${addOnExamples}`
          : `Optional extras - ${addOnExamples}`,
        tip: category === "junk"
          ? "Remove these! They're marked up 300-500%. Get them aftermarket for a fraction of the cost."
          : "Consider removing these. You can usually get them cheaper elsewhere.",
      });
    }
    
    // Sort by category (junk first, then negotiable, then legit)
    const categoryOrder: Record<FeeCategory, number> = { junk: 0, negotiable: 1, legit: 2 };
    feeItems.sort((a, b) => categoryOrder[a.category] - categoryOrder[b.category]);
    
    // Calculate totals and score
    const totalFees = feeItems.reduce((sum, fee) => sum + fee.amount, 0);
    const legitTotal = feeItems.filter(f => f.category === "legit").reduce((sum, f) => sum + f.amount, 0);
    const negotiableTotal = feeItems.filter(f => f.category === "negotiable").reduce((sum, f) => sum + f.amount, 0);
    const junkTotal = feeItems.filter(f => f.category === "junk").reduce((sum, f) => sum + f.amount, 0);
    
    // Calculate deal score based on fee breakdown
    // Score starts at 100 and gets penalized for bad fees
    let score = 100;
    
    // Penalty for junk fees (major impact)
    const junkPenalty = Math.min(50, (junkTotal / askingPrice) * 500);
    score -= junkPenalty;
    
    // Penalty for negotiable fees (moderate impact)
    const negotiablePenalty = Math.min(25, (negotiableTotal / askingPrice) * 200);
    score -= negotiablePenalty;
    
    // Slight penalty if total fees are very high
    const totalFeePercent = (totalFees / askingPrice) * 100;
    if (totalFeePercent > 15) score -= 10;
    else if (totalFeePercent > 10) score -= 5;
    
    score = Math.max(0, Math.min(100, Math.round(score)));
    
    // Potential savings = junk fees + 50% of negotiable fees
    const savingsPotential = junkTotal + (negotiableTotal * 0.5);
    
    return {
      fees: feeItems,
      dealScore: score,
      totalFees,
      categorySummary: {
        legit: legitTotal,
        negotiable: negotiableTotal,
        junk: junkTotal,
      },
      savingsPotential: Math.round(savingsPotential),
    };
  }, [docFee, dealerFee, addOns, taxes, registration, askingPrice]);
  
  const getScoreLabel = (score: number): string => {
    if (score >= 80) return "Clean Fee Structure";
    if (score >= 60) return "Fees Need Work";
    if (score >= 40) return "Watch These Fees";
    return "Heavy Fee Load";
  };
  
  const getScoreColor = (score: number): string => {
    if (score >= 80) return "text-green-600 dark:text-green-400";
    if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
    if (score >= 40) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
  };

  if (totalFees === 0) {
    return (
      <Card className={cn("", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5 text-primary" />
            Fee Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No fees entered yet. Add doc fees, dealer fees, add-ons, taxes, and registration in the deal form to see the breakdown.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Scale className="h-5 w-5 text-primary" />
              Fee Analysis
              <TermTooltip
                term="Fee Analysis"
                definition="Breakdown of all fees into three categories: Legit (required by law), Negotiable (can be reduced), and Junk (should be removed)."
                onGlossaryClick={onGlossaryClick}
              />
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              How clean is your fee structure?
            </p>
          </div>
          <div className="text-center">
            <ScoreRing score={dealScore} size="sm" showLabel={false} />
            <p className={cn("text-xs font-medium mt-1", getScoreColor(dealScore))}>
              {getScoreLabel(dealScore)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Category Summary Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Fee Distribution</span>
            <span>Total: ${totalFees.toLocaleString()}</span>
          </div>
          <div className="flex h-3 rounded-full overflow-hidden bg-muted">
            {categorySummary.legit > 0 && (
              <div 
                className="bg-green-500 transition-all"
                style={{ width: `${(categorySummary.legit / totalFees) * 100}%` }}
              />
            )}
            {categorySummary.negotiable > 0 && (
              <div 
                className="bg-yellow-500 transition-all"
                style={{ width: `${(categorySummary.negotiable / totalFees) * 100}%` }}
              />
            )}
            {categorySummary.junk > 0 && (
              <div 
                className="bg-red-500 transition-all"
                style={{ width: `${(categorySummary.junk / totalFees) * 100}%` }}
              />
            )}
          </div>
          <div className="flex gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="text-muted-foreground">Legit ${categorySummary.legit.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
              <span className="text-muted-foreground">Negotiable ${categorySummary.negotiable.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="text-muted-foreground">Junk ${categorySummary.junk.toLocaleString()}</span>
            </div>
          </div>
        </div>
        
        {/* Savings Potential */}
        {savingsPotential > 0 && (
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">
                Potential Savings: <span className="text-primary">${savingsPotential.toLocaleString()}</span>
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              By removing junk fees and negotiating others
            </p>
          </div>
        )}
        
        {/* Fee List */}
        <div className="space-y-2">
          {fees.map((fee, index) => {
            const config = categoryConfig[fee.category];
            const Icon = config.icon;
            
            return (
              <div 
                key={index}
                className={cn(
                  "p-3 rounded-lg border transition-all",
                  config.bgColor,
                  "border-transparent"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2.5">
                    <Icon className={cn("h-4 w-4 mt-0.5", config.textColor)} />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{fee.name}</span>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-[10px] px-1.5 py-0 h-4",
                            config.textColor,
                            "border-current"
                          )}
                        >
                          {config.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{fee.description}</p>
                    </div>
                  </div>
                  <span className={cn("text-sm font-bold", config.textColor)}>
                    ${fee.amount.toLocaleString()}
                  </span>
                </div>
                {fee.category !== "legit" && (
                  <div className="mt-2 pl-6 text-xs text-muted-foreground flex items-start gap-1.5">
                    <HelpCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span>{fee.tip}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Action Tips */}
        {(categorySummary.junk > 0 || categorySummary.negotiable > 0) && (
          <div className="pt-3 border-t border-border">
            <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              What To Say
            </h4>
            <div className="space-y-2 text-xs">
              {categorySummary.junk > 0 && (
                <div className="p-2.5 rounded-md bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300">
                  <span className="font-medium">"I'd like these fees removed: </span>
                  {fees.filter(f => f.category === "junk").map(f => f.name).join(", ")}
                  . I won't be paying for dealer add-ons."
                </div>
              )}
              {categorySummary.negotiable > 0 && (
                <div className="p-2.5 rounded-md bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300">
                  <span className="font-medium">"Can we work on the </span>
                  {fees.filter(f => f.category === "negotiable").map(f => f.name).join(" and ")}
                  ? I've seen lower fees at other dealerships."
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
