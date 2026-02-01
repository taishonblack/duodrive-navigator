// DuoDrive Score V4 - Robust, Conservative, Scam-Proof Scoring Engine

export interface DealInput {
  // Car details
  year: number;
  make: string;
  model: string;
  trim?: string;
  mileage: number;
  
  // Pricing
  askingPrice: number;
  negotiatedPrice?: number;
  downPayment: number;
  tradeIn: number;
  apr: number;
  term: number;
  
  // Fees
  docFee: number;
  dealerFee: number;
  addOns: number;
  taxes: number;
  registration: number;
  
  // Buyer profile
  monthlyIncome: number;
  creditScore: string;
  insurance: number;
  fuelCost: number;
  maintenance: number;
  
  // Market data (from AI estimation)
  estimatedMarketValue?: number;
}

export type AffordabilityStatus = 'fits_budget' | 'stretch_warning' | 'outside_budget' | 'blocked';

export interface ScoreResult {
  overall: number;
  pillars: {
    depreciation: PillarResult;
    reliability: PillarResult;
    safety: PillarResult;
    dealHealth: PillarResult;
    affordability: PillarResult;
  };
  recommendation: string;
  
  // Financial metrics
  monthlyPayment: number;
  totalCost: number;
  loanAmount: number;
  totalInterest: number;
  interestRatio: number;
  
  // V4 Metrics
  trueMarketPrice: number;
  dealPriceGap: number;
  dealPriceGapPercent: number;
  customerMaxSafePrice: number;
  customerFitGap: number;
  customerFitGapPercent: number;
  paymentBurdenPercent: number;
  operatingCostBurden: number;
  totalMonthlyCost: number;
  
  // V4 Affordability Rules A-D
  priceToIncomeRatio: number;
  affordabilityStatus: AffordabilityStatus;
  
  // V4 Sanity flags
  sanityFlags: string[];
  autoFail: boolean;
}

interface PillarResult {
  score: number;
  details: string;
}

// ============= V4 HELPER FUNCTIONS =============

// Calculate monthly payment using standard amortization formula
export function calculateMonthlyPayment(principal: number, apr: number, termMonths: number): number {
  if (principal <= 0) return 0;
  if (apr === 0) return principal / termMonths;
  const monthlyRate = apr / 100 / 12;
  return (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / 
         (Math.pow(1 + monthlyRate, termMonths) - 1);
}

// V4 FORMULA 1: Estimate True Market Price (TMP)
// Uses age-based depreciation curve for mass-market vehicles with mileage adjustment
export function estimateTMP(year: number, mileage: number, estimatedMarketValue?: number): number {
  // If we have an AI-estimated value, use it as a baseline
  if (estimatedMarketValue && estimatedMarketValue > 0) {
    return estimatedMarketValue;
  }
  
  const currentYear = new Date().getFullYear();
  const age = currentYear - year;

  // Base value curve for mass-market SUVs/sedans
  // New: ~30k, drops quickly after year 5
  let baseValue = 0;

  if (age <= 1) baseValue = 28000;
  else if (age <= 2) baseValue = 26000;
  else if (age <= 3) baseValue = 24000;
  else if (age <= 5) baseValue = 20000;
  else if (age <= 7) baseValue = 15000;
  else if (age <= 10) baseValue = 10000;
  else if (age <= 13) baseValue = 7000;
  else baseValue = 4000;

  // Mileage adjustment: ~$0.10 per mile over 60k baseline
  const mileageAdj = (mileage - 60000) * 0.10;
  const tmp = Math.max(baseValue - mileageAdj, 1000); // Floor for junk value

  return tmp;
}

// V4 FORMULA 2: Sanity Checks (absolute deal killers)
export function applySanityChecks(askingPrice: number, TMP: number, year: number): {
  autoFail: boolean;
  autoFailScore: number;
  errors: string[];
} {
  const currentYear = new Date().getFullYear();
  const age = currentYear - year;

  const errors: string[] = [];
  let autoFail = false;
  const autoFailScore = 5;

  // Unrealistic overpricing > 300% of TMP
  if (askingPrice > TMP * 3) {
    errors.push("Asking price exceeds 300% of expected market value.");
    autoFail = true;
  }

  // Old car priced like a new luxury model
  if (age > 12 && askingPrice > 30000) {
    errors.push("Old vehicle priced at luxury levels - highly suspicious.");
    autoFail = true;
  }

  // Very old car with unrealistic price
  if (age > 10 && askingPrice > TMP * 2) {
    errors.push("10+ year old vehicle priced at 2x market value.");
    autoFail = true;
  }

  return { autoFail, autoFailScore, errors };
}

// V4 FORMULA 3: Deal Price Gap Score (DPG)
export function computeDPG(askingPrice: number, TMP: number): {
  gap: number;
  gapPercent: number;
  score: number;
} {
  const gap = askingPrice - TMP;
  const ratio = TMP > 0 ? askingPrice / TMP : 999;
  const gapPercent = TMP > 0 ? ((askingPrice - TMP) / TMP) * 100 : 999;

  let score: number;
  if (ratio <= 0.9) score = 95;      // Underpriced - great deal
  else if (ratio <= 1.1) score = 85; // Fair
  else if (ratio <= 1.3) score = 70; // Mildly overpriced
  else if (ratio <= 1.5) score = 50; // Overpriced
  else if (ratio <= 2.0) score = 30; // Very overpriced
  else if (ratio <= 3.0) score = 10; // Extremely overpriced
  else score = 1;                     // Scam / absurd

  return { gap, gapPercent, score };
}

// V4 FORMULA 4: Customer Max Safety Price (CMSP)
// CORRECTED FORMULA:
// Max Monthly Payment = Gross Monthly Income × 0.12 (12% rule)
// Loan Amount = Max Monthly Payment / LoanFactor(APR, Term)
// CMSP = Loan Amount + Down Payment
//
// This gives the actual max vehicle price, NOT an inflated number.
function calculateLoanFactor(apr: number, termMonths: number): number {
  if (apr === 0) return 1 / termMonths;
  const monthlyRate = apr / 100 / 12;
  return (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / 
         (Math.pow(1 + monthlyRate, termMonths) - 1);
}

export function computeCMSP(
  monthlyIncome: number, 
  downPayment: number = 0,
  apr: number = 7,
  termMonths: number = 60
): number {
  const maxMonthlyPayment = monthlyIncome * 0.12; // 12% of gross monthly income
  const loanFactor = calculateLoanFactor(apr, termMonths);
  const maxLoanAmount = loanFactor > 0 ? maxMonthlyPayment / loanFactor : 0;
  const cmsp = maxLoanAmount + downPayment;
  return Math.round(cmsp);
}

// V4 FORMULA 5: Customer Fit Gap (CFG)
// CORRECTED FORMULA:
// CFG = CMSP - Actual Vehicle Price (plain dollars)
// CFG < 0 → Outside Budget
// CFG > 0 → Fits Budget
export function computeCFG(askingPrice: number, CMSP: number): {
  gap: number;
  gapPercent: number;
  score: number;
} {
  // CFG is CMSP minus price (positive = under budget, negative = over budget)
  const gap = CMSP - askingPrice;
  // For display, show how much over/under budget as percent of CMSP
  const gapPercent = CMSP > 0 ? ((askingPrice - CMSP) / CMSP) * 100 : 999;

  // Score based on how well the price fits within CMSP
  let score: number;
  if (askingPrice <= CMSP * 0.8) score = 95;  // Well under budget - great
  else if (askingPrice <= CMSP) score = 85;   // Under or at budget - good
  else if (askingPrice <= CMSP * 1.1) score = 65; // Slightly over - caution
  else if (askingPrice <= CMSP * 1.3) score = 40; // Moderately over - warning
  else if (askingPrice <= CMSP * 1.5) score = 20; // Significantly over - danger
  else score = 5; // Way over budget - blocked

  return { gap, gapPercent, score };
}

// V4 FORMULA 6: Loan Burden & Interest Penalty
export function computeLoanImpact(askingPrice: number, downPayment: number, apr: number, termMonths: number): {
  loanAmount: number;
  monthly: number;
  totalInterest: number;
  interestRatio: number;
  interestScore: number;
} {
  const loanAmount = Math.max(0, askingPrice - downPayment);
  const monthly = calculateMonthlyPayment(loanAmount, apr, termMonths);
  const totalInterest = (monthly * termMonths) - loanAmount;
  const interestRatio = loanAmount > 0 ? totalInterest / loanAmount : 0;

  let interestScore = 90;
  if (interestRatio > 0.25) interestScore = 60;
  if (interestRatio > 0.50) interestScore = 40;
  if (interestRatio > 0.75) interestScore = 20;
  if (interestRatio > 1.00) interestScore = 5;

  return { loanAmount, monthly, totalInterest, interestRatio, interestScore };
}

// V4 FORMULA 7: Down Payment Safety Score
export function computeDownPaymentScore(downPayment: number, askingPrice: number): number {
  if (askingPrice <= 0) return 50;
  const pct = downPayment / askingPrice;

  if (pct >= 0.20) return 90;
  if (pct >= 0.10) return 70;
  if (pct >= 0.05) return 50;
  if (pct >= 0.03) return 25;
  return 10;
}

// ============= PILLAR CALCULATIONS =============

// Depreciation score (based on age, mileage)
function calcDepreciation(year: number, mileage: number): PillarResult {
  const currentYear = new Date().getFullYear();
  const age = currentYear - year;
  const avgMilesPerYear = mileage / Math.max(age, 1);
  
  let score = 100;
  
  // Age penalty
  if (age > 5) score -= (age - 5) * 3;
  if (age > 10) score -= 10;
  
  // High mileage penalty
  if (avgMilesPerYear > 15000) score -= 10;
  if (avgMilesPerYear > 20000) score -= 10;
  if (mileage > 100000) score -= 15;
  
  // New car premium depreciation
  if (age <= 1) score -= 15;
  
  score = Math.max(0, Math.min(100, score));
  
  let details = "";
  if (age <= 1) details = "New vehicles depreciate quickly in the first year. Consider a 1-2 year old model.";
  else if (age <= 3 && avgMilesPerYear <= 12000) details = "Sweet spot! Low depreciation with modern features.";
  else if (mileage > 100000) details = "High mileage increases depreciation risk and repair costs.";
  else details = "Reasonable depreciation profile for this vehicle age.";
  
  return { score: Math.round(score), details };
}

// Reliability score (based on make reputation)
function calcReliability(make: string, mileage: number): PillarResult {
  const reliableMakes = ['toyota', 'honda', 'lexus', 'mazda', 'subaru', 'acura'];
  const avgMakes = ['hyundai', 'kia', 'ford', 'chevrolet', 'nissan', 'volkswagen', 'buick'];
  const lowerMakes = ['chrysler', 'dodge', 'jeep', 'ram', 'fiat', 'alfa romeo', 'land rover', 'jaguar', 'maserati'];
  
  const makeLower = make.toLowerCase();
  let score = 70;
  
  if (reliableMakes.includes(makeLower)) score = 90;
  else if (avgMakes.includes(makeLower)) score = 75;
  else if (lowerMakes.includes(makeLower)) score = 55;
  
  // Mileage adjustment
  if (mileage > 100000) score -= 15;
  else if (mileage > 75000) score -= 10;
  else if (mileage < 30000) score += 5;
  
  score = Math.max(0, Math.min(100, score));
  
  let details = "";
  if (reliableMakes.includes(makeLower)) details = `${make} consistently ranks high for reliability.`;
  else if (lowerMakes.includes(makeLower)) details = `${make} has below-average reliability. Budget extra for repairs.`;
  else details = `${make} has average reliability ratings.`;
  
  return { score: Math.round(score), details };
}

// Safety score (newer = safer, generally)
function calcSafety(year: number, make: string): PillarResult {
  const currentYear = new Date().getFullYear();
  const age = currentYear - year;
  
  let score = 85;
  
  if (age <= 2) score = 95;
  else if (age <= 5) score = 85;
  else if (age <= 8) score = 75;
  else score = 65;
  
  // Brands known for safety
  const safetyLeaders = ['volvo', 'subaru', 'toyota', 'honda', 'mazda'];
  if (safetyLeaders.includes(make.toLowerCase())) score += 5;
  
  score = Math.max(0, Math.min(100, score));
  
  let details = "";
  if (age <= 2) details = "Modern safety features and crash standards provide excellent protection.";
  else if (age <= 5) details = "Good safety tech. Check for available safety packages.";
  else details = "Older vehicle may lack modern safety features like automatic emergency braking.";
  
  return { score: Math.round(score), details };
}

// V4 Deal Health score - now uses DPG as primary factor
function calcDealHealth(
  dpgScore: number,
  docFee: number,
  dealerFee: number,
  addOns: number,
  askingPrice: number,
  apr: number,
  creditScore: string,
  dpgPercent: number
): PillarResult {
  let feeScore = 100;
  
  // Doc fee penalty (avg is $300-500)
  if (docFee > 700) feeScore -= 15;
  else if (docFee > 500) feeScore -= 5;
  
  // Dealer fee is a red flag
  if (dealerFee > 0) feeScore -= Math.min(20, dealerFee / 50);
  
  // Add-ons are usually overpriced
  if (addOns > 0) {
    const addOnPercent = (addOns / askingPrice) * 100;
    if (addOnPercent > 5) feeScore -= 20;
    else if (addOnPercent > 2) feeScore -= 10;
  }
  
  // APR check based on credit
  const expectedAPR: Record<string, number> = {
    excellent: 5.5,
    good: 7.0,
    fair: 10.0,
    poor: 15.0,
  };
  const expected = expectedAPR[creditScore] || 8.0;
  if (apr > expected + 2) feeScore -= 15;
  else if (apr > expected) feeScore -= 5;
  else if (apr < expected) feeScore += 5;
  
  feeScore = Math.max(0, Math.min(100, feeScore));
  
  // V4: DPG is now 60% of deal health, fees 40%
  const score = Math.round(dpgScore * 0.60 + feeScore * 0.40);
  
  let details = "";
  if (dpgScore <= 10) details = "DANGER: Price is extremely above market value. This deal is a scam or severe ripoff.";
  else if (dpgScore <= 30) details = "The dealer is asking far above market value. Walk away or negotiate aggressively.";
  else if (dpgScore < 50) details = "The dealer is asking significantly above market value. Negotiate hard.";
  else if (addOns > 500) details = "High dealer add-ons detected. These are often overpriced—negotiate to remove them.";
  else if (dealerFee > 500) details = "Dealer fee seems high. Try to negotiate it down or off.";
  else if (docFee > 700) details = "Doc fee exceeds typical range. Some states cap this fee.";
  else if (apr > expected + 2) details = "APR seems high for your credit range. Shop for better rates.";
  else if (dpgScore >= 80) details = "Price is at or below market value. This is a well-priced deal.";
  else details = "Deal structure looks reasonable. Always verify final numbers before signing.";
  
  return { score, details };
}

// V4 Affordability score - uses CFG, interest, and down payment
// Now incorporates Rules A-D from the affordability spec
function calcAffordability(
  cfgScore: number,
  interestScore: number,
  downPaymentScore: number,
  monthlyPayment: number,
  totalMonthlyCost: number,
  monthlyIncome: number,
  cfgPercent: number,
  askingPrice: number,
  annualIncome: number
): PillarResult {
  const paymentBurden = (monthlyPayment / monthlyIncome) * 100;
  const totalBurden = (totalMonthlyCost / monthlyIncome) * 100;
  const priceToIncomeRatio = (askingPrice / annualIncome) * 100;
  
  // Rule penalties
  let rulePenalty = 0;
  const violations: string[] = [];
  
  // Rule A: Price-to-Income (recommended max 50-60%, hard stop at 70%)
  if (priceToIncomeRatio > 70) {
    rulePenalty += 40; // Severe penalty
    violations.push(`price is ${priceToIncomeRatio.toFixed(0)}% of annual income (max: 60%)`);
  } else if (priceToIncomeRatio > 60) {
    rulePenalty += 20;
    violations.push(`price is ${priceToIncomeRatio.toFixed(0)}% of annual income`);
  }
  
  // Rule B: Monthly Payment Burden (target ≤12%, warning 12-15%, unsafe >15%)
  if (paymentBurden > 15) {
    rulePenalty += 25;
    violations.push(`payment is ${paymentBurden.toFixed(0)}% of monthly income (max: 12%)`);
  } else if (paymentBurden > 12) {
    rulePenalty += 10;
  }
  
  // Rule C: Total Transportation Burden (target ≤20%)
  if (totalBurden > 25) {
    rulePenalty += 20;
    violations.push(`total costs are ${totalBurden.toFixed(0)}% of income`);
  } else if (totalBurden > 20) {
    rulePenalty += 10;
  }
  
  // Base score from CFG, interest, down payment
  let baseScore = Math.round(
    cfgScore * 0.40 +
    interestScore * 0.30 +
    downPaymentScore * 0.30
  );
  
  // Apply rule penalties
  const score = Math.max(5, baseScore - rulePenalty);
  
  // Generate details message based on violations
  let details = "";
  if (violations.length > 0) {
    if (priceToIncomeRatio > 70) {
      details = `This vehicle may be outside a comfortable budget range. The ${violations[0]} which is significantly higher than recommended.`;
    } else if (violations.length >= 2) {
      details = `Multiple affordability concerns: ${violations.join("; ")}. Consider a less expensive option.`;
    } else {
      details = `Affordability concern: ${violations[0]}. This may strain your finances.`;
    }
  } else if (score >= 80) {
    details = `Car fits comfortably within your budget. Total cost is ${totalBurden.toFixed(0)}% of income.`;
  } else if (score >= 60) {
    details = `At ${totalBurden.toFixed(0)}% of income, this is manageable but be mindful of other expenses.`;
  } else {
    details = `This car exceeds recommended affordability thresholds. Consider alternatives.`;
  }
  
  return { score, details };
}

// V4 Recommendation generator
function generateRecommendation(
  overall: number, 
  pillars: ScoreResult['pillars'], 
  dpgPercent: number, 
  cfgPercent: number,
  sanityFlags: string[],
  autoFail: boolean
): string {
  if (autoFail) {
    return `🚨 CRITICAL: This deal failed basic sanity checks. ${sanityFlags.join(" ")} This deal is financially unsafe and priced far above market norms. Do not proceed under any circumstances.`;
  }
  
  const warnings: string[] = [];
  
  if (dpgPercent > 50) warnings.push("massively overpriced");
  else if (dpgPercent > 30) warnings.push("severely overpriced");
  else if (dpgPercent > 15) warnings.push("significantly overpriced");
  
  if (cfgPercent > 50) warnings.push("way beyond your safe budget");
  else if (cfgPercent > 25) warnings.push("beyond your safe budget");
  
  if (pillars.affordability.score < 30) warnings.push("could devastate your finances");
  else if (pillars.affordability.score < 50) warnings.push("could strain your finances");
  
  if (pillars.reliability.score < 60) warnings.push("reliability concerns");
  
  if (overall >= 80) {
    return "This looks like a solid deal! The numbers check out well across all pillars. The price is fair, and it fits your budget. If it feels right, you can move forward with confidence.";
  } else if (overall >= 60) {
    const weakest = Object.entries(pillars).sort((a, b) => a[1].score - b[1].score)[0];
    return `This deal is okay but has room for improvement. Focus on ${weakest[0].replace(/([A-Z])/g, ' $1').toLowerCase().trim()}—it's pulling your score down. Consider negotiating or shopping around.`;
  } else if (overall >= 40) {
    return `Caution advised. This deal has concerns: ${warnings.length > 0 ? warnings.join(", ") : "multiple red flags"}. We recommend getting additional quotes or considering different vehicles before committing.`;
  } else {
    return `🚨 This deal has significant red flags: ${warnings.length > 0 ? warnings.join(", ") : "major financial concerns"}. We strongly recommend walking away and exploring better options. Your financial health is more important than any single car.`;
  }
}

// ============= MAIN SCORING FUNCTION =============

export function calculateDuoDriveScore(input: DealInput): ScoreResult {
  const askingPrice = input.negotiatedPrice || input.askingPrice;
  
  // V4: Calculate True Market Price
  const trueMarketPrice = estimateTMP(input.year, input.mileage, input.estimatedMarketValue);
  
  // V4: Apply sanity checks FIRST
  const sanity = applySanityChecks(askingPrice, trueMarketPrice, input.year);
  
  // V4: Calculate DPG (Deal Price Gap)
  const dpg = computeDPG(askingPrice, trueMarketPrice);
  
  // V4: Calculate CMSP and CFG with CORRECTED formula
  // CMSP now uses: maxPayment / loanFactor + downPayment (gives actual max price, not inflated)
  const customerMaxSafePrice = computeCMSP(input.monthlyIncome, input.downPayment, input.apr, input.term);
  const cfg = computeCFG(askingPrice, customerMaxSafePrice);
  
  // Calculate loan details
  const totalFees = input.docFee + input.dealerFee + input.addOns + input.taxes + input.registration;
  const effectivePrice = askingPrice - input.downPayment - input.tradeIn + totalFees;
  const loanAmount = Math.max(0, effectivePrice);
  
  // V4: Loan impact and down payment scores
  const loanImpact = computeLoanImpact(askingPrice, input.downPayment, input.apr, input.term);
  const downPaymentScore = computeDownPaymentScore(input.downPayment, askingPrice);
  
  // Calculate monthly costs
  const monthlyPayment = calculateMonthlyPayment(loanAmount, input.apr, input.term);
  const totalPaid = monthlyPayment * input.term;
  const totalInterest = totalPaid - loanAmount;
  const interestRatio = loanAmount > 0 ? totalInterest / loanAmount : 0;
  const totalCost = totalPaid + input.downPayment + input.tradeIn;
  const totalMonthlyCost = monthlyPayment + input.insurance + input.fuelCost + input.maintenance;
  const paymentBurdenPercent = (monthlyPayment / input.monthlyIncome) * 100;
  const operatingCostBurden = (totalMonthlyCost / input.monthlyIncome) * 100;
  
  // Calculate traditional pillars
  const depreciation = calcDepreciation(input.year, input.mileage);
  const reliability = calcReliability(input.make, input.mileage);
  const safety = calcSafety(input.year, input.make);
  
  // V4: Updated deal health using DPG
  const dealHealth = calcDealHealth(
    dpg.score,
    input.docFee,
    input.dealerFee,
    input.addOns,
    askingPrice,
    input.apr,
    input.creditScore,
    dpg.gapPercent
  );
  
  // V4: Updated affordability using CFG, interest, down payment, and Rules A-D
  const affordability = calcAffordability(
    cfg.score,
    loanImpact.interestScore,
    downPaymentScore,
    monthlyPayment,
    totalMonthlyCost,
    input.monthlyIncome,
    cfg.gapPercent,
    askingPrice,
    input.monthlyIncome * 12 // annual income
  );
  
  const pillars = {
    depreciation,
    reliability,
    safety,
    dealHealth,
    affordability,
  };
  
  // Calculate price-to-income ratio for Rules A-D
  const annualIncome = input.monthlyIncome * 12;
  const priceToIncomeRatio = annualIncome > 0 ? (askingPrice / annualIncome) * 100 : 999;
  
  // Determine affordability status based on Rules A-D
  function determineAffordabilityStatus(): AffordabilityStatus {
    // Rule A violation (price > 70% of annual income) = blocked
    if (priceToIncomeRatio > 70) return 'blocked';
    // Price > 60% or CFG negative by more than 15% = outside budget
    if (priceToIncomeRatio > 60 || cfg.gapPercent > 15) return 'outside_budget';
    // Payment burden > 15% or CFG negative = stretch warning
    if (paymentBurdenPercent > 15 || cfg.gap < 0) return 'stretch_warning';
    // All good
    return 'fits_budget';
  }
  
  const affordabilityStatus = determineAffordabilityStatus();
  
  // V4: If sanity checks failed, override score
  if (sanity.autoFail) {
    return {
      overall: sanity.autoFailScore,
      pillars: {
        depreciation,
        reliability,
        safety,
        dealHealth: { score: sanity.autoFailScore, details: sanity.errors.join(" ") },
        affordability: { score: sanity.autoFailScore, details: "Deal failed sanity checks - do not proceed." },
      },
      recommendation: generateRecommendation(sanity.autoFailScore, pillars, dpg.gapPercent, cfg.gapPercent, sanity.errors, true),
      monthlyPayment: Math.round(monthlyPayment),
      totalCost: Math.round(totalCost),
      loanAmount: Math.round(loanAmount),
      totalInterest: Math.round(totalInterest),
      interestRatio: Math.round(interestRatio * 100) / 100,
      trueMarketPrice: Math.round(trueMarketPrice),
      dealPriceGap: Math.round(dpg.gap),
      dealPriceGapPercent: Math.round(dpg.gapPercent * 10) / 10,
      customerMaxSafePrice: Math.round(customerMaxSafePrice),
      customerFitGap: Math.round(cfg.gap),
      customerFitGapPercent: Math.round(cfg.gapPercent * 10) / 10,
      paymentBurdenPercent: Math.round(paymentBurdenPercent * 10) / 10,
      operatingCostBurden: Math.round(operatingCostBurden * 10) / 10,
      totalMonthlyCost: Math.round(totalMonthlyCost),
      priceToIncomeRatio: Math.round(priceToIncomeRatio * 10) / 10,
      affordabilityStatus: 'blocked',
      sanityFlags: sanity.errors,
      autoFail: true,
    };
  }
  
  // V4: Final Score Weighting
  // DPG: 40% (biggest factor - is the price sane?)
  // CFG: 30% (can buyer afford it?)
  // Interest: 15% (long-term safety)
  // Down Payment: 15% (buyer equity)
  const overall = Math.round(
    dpg.score * 0.40 +
    cfg.score * 0.30 +
    loanImpact.interestScore * 0.15 +
    downPaymentScore * 0.15
  );
  
  return {
    overall,
    pillars,
    recommendation: generateRecommendation(overall, pillars, dpg.gapPercent, cfg.gapPercent, sanity.errors, false),
    monthlyPayment: Math.round(monthlyPayment),
    totalCost: Math.round(totalCost),
    loanAmount: Math.round(loanAmount),
    totalInterest: Math.round(totalInterest),
    interestRatio: Math.round(interestRatio * 100) / 100,
    trueMarketPrice: Math.round(trueMarketPrice),
    dealPriceGap: Math.round(dpg.gap),
    dealPriceGapPercent: Math.round(dpg.gapPercent * 10) / 10,
    customerMaxSafePrice: Math.round(customerMaxSafePrice),
    customerFitGap: Math.round(cfg.gap),
    customerFitGapPercent: Math.round(cfg.gapPercent * 10) / 10,
    paymentBurdenPercent: Math.round(paymentBurdenPercent * 10) / 10,
    operatingCostBurden: Math.round(operatingCostBurden * 10) / 10,
    totalMonthlyCost: Math.round(totalMonthlyCost),
    priceToIncomeRatio: Math.round(priceToIncomeRatio * 10) / 10,
    affordabilityStatus,
    sanityFlags: sanity.errors,
    autoFail: false,
  };
}

// Helper to get Deal Health color
export function getDealHealthColor(score: number): string {
  if (score >= 80) return "text-green-500";
  if (score >= 60) return "text-yellow-500";
  if (score >= 40) return "text-orange-500";
  return "text-red-500";
}

export function getDealHealthLabel(score: number): string {
  if (score >= 80) return "Great Deal";
  if (score >= 60) return "Fair Deal";
  if (score >= 40) return "Needs Negotiation";
  if (score >= 20) return "Overpriced";
  return "Walk Away";
}
