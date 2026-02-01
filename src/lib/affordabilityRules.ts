// DuoDrive Affordability Rules - Conservative, Buyer-Protection-First Logic

export interface AffordabilityInput {
  grossAnnualIncome: number;
  downPayment: number;
  vehiclePrice: number; // OTD price
  apr: number;
  termMonths: number;
  insurance: number;
  fuelCost: number;
  maintenance: number;
  isLuxuryVehicle?: boolean;
}

export interface AffordabilityResult {
  // Core metrics
  cmsp: number; // Consumer Max Safe Price - the max vehicle price they should pay
  cfg: number; // Consumer Fit Gap - difference between CMSP and actual price (negative = over budget)
  
  // Rule violations
  ruleViolations: RuleViolation[];
  overallStatus: AffordabilityStatus;
  
  // Detailed metrics
  priceToIncomeRatio: number;
  monthlyPaymentBurden: number; // Payment as % of gross monthly income
  totalTransportationBurden: number; // Total car costs as % of gross monthly income
  downPaymentPercent: number;
  
  // User-facing
  primaryMessage: string;
  detailedExplanation: string;
  suggestedActions: SuggestedAction[];
}

export interface RuleViolation {
  rule: 'A' | 'B' | 'C' | 'D';
  ruleName: string;
  severity: 'warning' | 'danger' | 'block';
  message: string;
  currentValue: number;
  safeThreshold: number;
}

export type AffordabilityStatus = 
  | 'fits_budget' 
  | 'stretch_warning' 
  | 'outside_budget' 
  | 'blocked';

export interface SuggestedAction {
  icon: 'search' | 'chart' | 'car';
  label: string;
  description: string;
}

// Calculate monthly loan payment using standard amortization
function calculateMonthlyPayment(principal: number, apr: number, termMonths: number): number {
  if (principal <= 0) return 0;
  if (apr === 0) return principal / termMonths;
  const monthlyRate = apr / 100 / 12;
  return (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / 
         (Math.pow(1 + monthlyRate, termMonths) - 1);
}

// Calculate loan factor for reverse engineering max price from max payment
function calculateLoanFactor(apr: number, termMonths: number): number {
  if (apr === 0) return 1 / termMonths;
  const monthlyRate = apr / 100 / 12;
  return (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / 
         (Math.pow(1 + monthlyRate, termMonths) - 1);
}

/**
 * Calculate Consumer Max Safe Price (CMSP)
 * 
 * CORRECT FORMULA:
 * Max Monthly Payment = Gross Monthly Income × 0.12 (12% rule)
 * Loan Amount = Max Monthly Payment / LoanFactor(APR, Term)
 * CMSP = Loan Amount + Down Payment
 * 
 * This gives the maximum vehicle price that keeps the user within safe thresholds.
 */
export function calculateCMSP(
  grossMonthlyIncome: number,
  downPayment: number,
  apr: number,
  termMonths: number
): number {
  const maxMonthlyPayment = grossMonthlyIncome * 0.12; // 12% of gross monthly income
  const loanFactor = calculateLoanFactor(apr, termMonths);
  const maxLoanAmount = loanFactor > 0 ? maxMonthlyPayment / loanFactor : 0;
  const cmsp = maxLoanAmount + downPayment;
  return Math.round(cmsp);
}

/**
 * Calculate Consumer Fit Gap (CFG)
 * 
 * CORRECT FORMULA:
 * CFG = CMSP - Actual Vehicle Price
 * 
 * CFG < 0 → Outside Budget
 * CFG > 0 → Fits Budget
 * 
 * No percentages. No inverted signs. Plain dollars.
 */
export function calculateCFG(cmsp: number, vehiclePrice: number): number {
  return cmsp - vehiclePrice;
}

/**
 * Main affordability analysis function
 * Implements Rules A-D as hard guardrails
 */
export function analyzeAffordability(input: AffordabilityInput): AffordabilityResult {
  const {
    grossAnnualIncome,
    downPayment,
    vehiclePrice,
    apr,
    termMonths,
    insurance,
    fuelCost,
    maintenance,
    isLuxuryVehicle = false,
  } = input;

  const grossMonthlyIncome = grossAnnualIncome / 12;
  const loanAmount = vehiclePrice - downPayment;
  const monthlyPayment = calculateMonthlyPayment(loanAmount, apr, termMonths);
  const totalMonthlyCost = monthlyPayment + insurance + fuelCost + maintenance;
  
  // Calculate core metrics
  const cmsp = calculateCMSP(grossMonthlyIncome, downPayment, apr, termMonths);
  const cfg = calculateCFG(cmsp, vehiclePrice);
  const priceToIncomeRatio = (vehiclePrice / grossAnnualIncome) * 100;
  const monthlyPaymentBurden = (monthlyPayment / grossMonthlyIncome) * 100;
  const totalTransportationBurden = (totalMonthlyCost / grossMonthlyIncome) * 100;
  const downPaymentPercent = (downPayment / vehiclePrice) * 100;

  const ruleViolations: RuleViolation[] = [];

  // ============= RULE A: Vehicle Price to Income Ratio =============
  // Recommended max: 50-60% of gross annual income
  // Soft warning at 60%, Hard stop at >70%
  if (priceToIncomeRatio > 70) {
    ruleViolations.push({
      rule: 'A',
      ruleName: 'Price-to-Income Ratio',
      severity: 'block',
      message: `Vehicle price is ${priceToIncomeRatio.toFixed(0)}% of your annual income (max recommended: 50-60%)`,
      currentValue: priceToIncomeRatio,
      safeThreshold: 60,
    });
  } else if (priceToIncomeRatio > 60) {
    ruleViolations.push({
      rule: 'A',
      ruleName: 'Price-to-Income Ratio',
      severity: 'danger',
      message: `Vehicle price is ${priceToIncomeRatio.toFixed(0)}% of your annual income (recommended: ≤60%)`,
      currentValue: priceToIncomeRatio,
      safeThreshold: 60,
    });
  }

  // ============= RULE B: Monthly Payment Burden =============
  // Target: ≤ 10-12% of gross monthly income
  // Warning: 12-15%, Unsafe: >15%
  if (monthlyPaymentBurden > 15) {
    ruleViolations.push({
      rule: 'B',
      ruleName: 'Monthly Payment Burden',
      severity: 'danger',
      message: `Monthly payment is ${monthlyPaymentBurden.toFixed(0)}% of income (unsafe: >15%)`,
      currentValue: monthlyPaymentBurden,
      safeThreshold: 12,
    });
  } else if (monthlyPaymentBurden > 12) {
    ruleViolations.push({
      rule: 'B',
      ruleName: 'Monthly Payment Burden',
      severity: 'warning',
      message: `Monthly payment is ${monthlyPaymentBurden.toFixed(0)}% of income (target: ≤12%)`,
      currentValue: monthlyPaymentBurden,
      safeThreshold: 12,
    });
  }

  // ============= RULE C: Total Transportation Cost Burden =============
  // Target: ≤ 15-20% of gross monthly income
  // Luxury vehicles apply risk multiplier
  const luxuryMultiplier = isLuxuryVehicle ? 1.15 : 1;
  const adjustedBurden = totalTransportationBurden * luxuryMultiplier;
  
  if (adjustedBurden > 25) {
    ruleViolations.push({
      rule: 'C',
      ruleName: 'Total Transportation Cost',
      severity: 'danger',
      message: `Total car costs are ${totalTransportationBurden.toFixed(0)}% of income${isLuxuryVehicle ? ' (luxury risk applied)' : ''} (max: 20%)`,
      currentValue: totalTransportationBurden,
      safeThreshold: 20,
    });
  } else if (adjustedBurden > 20) {
    ruleViolations.push({
      rule: 'C',
      ruleName: 'Total Transportation Cost',
      severity: 'warning',
      message: `Total car costs are ${totalTransportationBurden.toFixed(0)}% of income (target: ≤20%)`,
      currentValue: totalTransportationBurden,
      safeThreshold: 20,
    });
  }

  // ============= RULE D: Down Payment Protection =============
  // Down payment <10% on luxury → warning
  // Down payment <7% → risk flag
  if (downPaymentPercent < 7) {
    ruleViolations.push({
      rule: 'D',
      ruleName: 'Down Payment Protection',
      severity: 'danger',
      message: `Down payment is only ${downPaymentPercent.toFixed(0)}% (minimum recommended: 10%)`,
      currentValue: downPaymentPercent,
      safeThreshold: 10,
    });
  } else if (downPaymentPercent < 10 && isLuxuryVehicle) {
    ruleViolations.push({
      rule: 'D',
      ruleName: 'Down Payment Protection',
      severity: 'warning',
      message: `Down payment of ${downPaymentPercent.toFixed(0)}% is low for a luxury vehicle (recommended: ≥10%)`,
      currentValue: downPaymentPercent,
      safeThreshold: 10,
    });
  }

  // Determine overall status
  let overallStatus: AffordabilityStatus = 'fits_budget';
  const hasBlock = ruleViolations.some(v => v.severity === 'block');
  const hasDanger = ruleViolations.some(v => v.severity === 'danger');
  const hasWarning = ruleViolations.some(v => v.severity === 'warning');

  if (hasBlock) {
    overallStatus = 'blocked';
  } else if (hasDanger || cfg < -vehiclePrice * 0.15) {
    overallStatus = 'outside_budget';
  } else if (hasWarning || cfg < 0) {
    overallStatus = 'stretch_warning';
  }

  // Generate user-facing messages
  const { primaryMessage, detailedExplanation, suggestedActions } = generateUserMessages(
    overallStatus,
    cfg,
    priceToIncomeRatio,
    monthlyPaymentBurden,
    vehiclePrice,
    cmsp,
    grossAnnualIncome
  );

  return {
    cmsp,
    cfg,
    ruleViolations,
    overallStatus,
    priceToIncomeRatio,
    monthlyPaymentBurden,
    totalTransportationBurden,
    downPaymentPercent,
    primaryMessage,
    detailedExplanation,
    suggestedActions,
  };
}

function generateUserMessages(
  status: AffordabilityStatus,
  cfg: number,
  priceToIncomeRatio: number,
  monthlyPaymentBurden: number,
  vehiclePrice: number,
  cmsp: number,
  grossAnnualIncome: number
): { primaryMessage: string; detailedExplanation: string; suggestedActions: SuggestedAction[] } {
  const recommendedMaxPrice = Math.round(grossAnnualIncome * 0.55);
  const priceDifference = vehiclePrice - cmsp;

  if (status === 'fits_budget') {
    return {
      primaryMessage: 'This vehicle fits your budget',
      detailedExplanation: `Based on your income and down payment, this vehicle is within your safe affordability range. Your maximum safe price is $${cmsp.toLocaleString()}, and you're ${cfg > 0 ? `$${cfg.toLocaleString()} under` : 'at'} that limit.`,
      suggestedActions: [],
    };
  }

  if (status === 'stretch_warning') {
    return {
      primaryMessage: 'Budget stretch detected',
      detailedExplanation: `This vehicle is close to or slightly above your comfortable budget range. While manageable, it may leave less financial flexibility month to month. Your maximum safe price is $${cmsp.toLocaleString()}.`,
      suggestedActions: [
        {
          icon: 'search',
          label: 'Show similar vehicles within my budget',
          description: `Find alternatives under $${cmsp.toLocaleString()}`,
        },
        {
          icon: 'chart',
          label: 'What price would make this car work?',
          description: `Reduce to $${cmsp.toLocaleString()} or increase down payment`,
        },
      ],
    };
  }

  // Outside budget or blocked - use the approved copy
  return {
    primaryMessage: 'This vehicle may be outside a comfortable budget range right now',
    detailedExplanation: `While this is an excellent vehicle, its total cost is significantly higher than what's typically recommended based on your income and down payment.

Vehicles at this price point often require long loan terms, higher insurance costs, and leave less financial flexibility month to month. That can increase stress even if the payment initially looks manageable.

This doesn't mean the car is off the table forever — it simply means the timing or structure may not be right today. We can help you find similar vehicles that fit your budget more comfortably, or show what would need to change for this deal to make sense.

Your recommended max vehicle price: $${cmsp.toLocaleString()}
This vehicle: $${vehiclePrice.toLocaleString()} ($${priceDifference.toLocaleString()} over budget)`,
    suggestedActions: [
      {
        icon: 'search',
        label: 'Show similar vehicles within my budget',
        description: `Find alternatives under $${cmsp.toLocaleString()}`,
      },
      {
        icon: 'chart',
        label: 'What price would make this car work?',
        description: `See what needs to change to afford this vehicle`,
      },
      {
        icon: 'car',
        label: 'Explore used or lower trims',
        description: 'Find the same model at a lower price point',
      },
    ],
  };
}

/**
 * Get the visual severity color for UI
 */
export function getAffordabilityColor(status: AffordabilityStatus): string {
  switch (status) {
    case 'fits_budget':
      return 'text-green-600 dark:text-green-400';
    case 'stretch_warning':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'outside_budget':
      return 'text-orange-600 dark:text-orange-400';
    case 'blocked':
      return 'text-red-600 dark:text-red-400';
  }
}

export function getAffordabilityBgColor(status: AffordabilityStatus): string {
  switch (status) {
    case 'fits_budget':
      return 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800';
    case 'stretch_warning':
      return 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800';
    case 'outside_budget':
      return 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800';
    case 'blocked':
      return 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800';
  }
}

export function getAffordabilityLabel(status: AffordabilityStatus): string {
  switch (status) {
    case 'fits_budget':
      return 'Fits Budget';
    case 'stretch_warning':
      return 'Budget Stretch';
    case 'outside_budget':
      return 'Outside Budget';
    case 'blocked':
      return 'Outside Budget';
  }
}

/**
 * Detect if a vehicle is likely a luxury brand
 */
export function isLuxuryBrand(make: string): boolean {
  const luxuryBrands = [
    'lexus', 'bmw', 'mercedes', 'mercedes-benz', 'audi', 'porsche', 
    'jaguar', 'land rover', 'range rover', 'maserati', 'bentley', 
    'rolls-royce', 'ferrari', 'lamborghini', 'aston martin', 'tesla',
    'cadillac', 'lincoln', 'infiniti', 'acura', 'genesis', 'alfa romeo',
    'lucid', 'rivian', 'lotus', 'mclaren', 'bugatti'
  ];
  return luxuryBrands.includes(make.toLowerCase());
}
