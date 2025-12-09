// DuoDrive Score V3 - Comprehensive Car Deal Evaluation Engine

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
  
  // V3 Metrics
  trueMarketPrice: number;
  dealPriceGap: number;
  dealPriceGapPercent: number;
  customerMaxSafePrice: number;
  customerFitGap: number;
  customerFitGapPercent: number;
  paymentBurdenPercent: number;
  operatingCostBurden: number;
  totalMonthlyCost: number;
}

interface PillarResult {
  score: number;
  details: string;
}

// Calculate monthly payment using standard amortization formula
export function calculateMonthlyPayment(principal: number, apr: number, termMonths: number): number {
  if (apr === 0) return principal / termMonths;
  const monthlyRate = apr / 100 / 12;
  return (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / 
         (Math.pow(1 + monthlyRate, termMonths) - 1);
}

// FORMULA 1: True Market Price (TMP)
// Uses AI-estimated market value with adjustments for mileage and trim
export function calculateTrueMarketPrice(
  estimatedMarketValue: number,
  year: number,
  mileage: number,
  trim?: string
): number {
  const currentYear = new Date().getFullYear();
  const age = currentYear - year;
  
  // Expected mileage: ~12,000 miles per year
  const expectedMileage = age * 12000;
  const mileageDiff = mileage - expectedMileage;
  
  // Mileage penalty: $0.10 per excess mile, bonus for low miles
  const mileageAdjustment = -mileageDiff * 0.10;
  
  // Trim premium (rough estimates)
  let trimPremium = 0;
  if (trim) {
    const trimLower = trim.toLowerCase();
    if (trimLower.includes('limited') || trimLower.includes('platinum') || trimLower.includes('touring')) {
      trimPremium = estimatedMarketValue * 0.08;
    } else if (trimLower.includes('sport') || trimLower.includes('premium') || trimLower.includes('ex-l')) {
      trimPremium = estimatedMarketValue * 0.05;
    } else if (trimLower.includes('base') || trimLower.includes('s') || trimLower.includes('lx')) {
      trimPremium = -estimatedMarketValue * 0.03;
    }
  }
  
  return Math.max(0, estimatedMarketValue + mileageAdjustment + trimPremium);
}

// FORMULA 2: Deal Price Gap (DPG)
export function calculateDealPriceGap(dealerAskingPrice: number, trueMarketPrice: number): {
  gap: number;
  gapPercent: number;
  score: number;
} {
  const gap = dealerAskingPrice - trueMarketPrice;
  const gapPercent = trueMarketPrice > 0 ? (gap / trueMarketPrice) * 100 : 0;
  
  let score = 100;
  if (gapPercent <= 0) {
    score = 100; // At or below market - great deal
  } else if (gapPercent <= 5) {
    score = 90; // Slightly above - good deal
  } else if (gapPercent <= 10) {
    score = 70; // Fair deal
  } else if (gapPercent <= 15) {
    score = 55; // Needs negotiation
  } else if (gapPercent <= 20) {
    score = 40; // Overpriced
  } else if (gapPercent <= 30) {
    score = 20; // Very overpriced
  } else {
    score = 10; // Reject
  }
  
  return { gap, gapPercent, score };
}

// FORMULA 3: Customer Max Safety Price (CMSP)
// Based on 12% of take-home income rule
export function calculateCustomerMaxSafePrice(
  monthlyIncome: number,
  apr: number,
  termMonths: number
): number {
  const maxMonthlyPayment = monthlyIncome * 0.12;
  const monthlyRate = apr / 100 / 12;
  
  if (apr === 0) {
    return maxMonthlyPayment * termMonths;
  }
  
  // Reverse the amortization formula to get max principal
  const maxPrincipal = maxMonthlyPayment * 
    (Math.pow(1 + monthlyRate, termMonths) - 1) / 
    (monthlyRate * Math.pow(1 + monthlyRate, termMonths));
  
  return maxPrincipal;
}

// FORMULA 4: Customer Fit Gap (CFG)
export function calculateCustomerFitGap(dealerAskingPrice: number, customerMaxSafePrice: number): {
  gap: number;
  gapPercent: number;
  score: number;
} {
  const gap = dealerAskingPrice - customerMaxSafePrice;
  const gapPercent = customerMaxSafePrice > 0 ? (gap / customerMaxSafePrice) * 100 : 0;
  
  let score = 100;
  if (gapPercent <= 0) {
    score = 100; // Within safe range - great fit
  } else if (gapPercent <= 10) {
    score = 70; // Borderline
  } else if (gapPercent <= 25) {
    score = 40; // Risky
  } else if (gapPercent <= 50) {
    score = 15; // Very risky
  } else {
    score = 0; // Reject - cannot afford
  }
  
  return { gap, gapPercent, score };
}

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

// Deal Health score (V3 - incorporates DPG)
function calcDealHealth(
  dpgScore: number,
  docFee: number,
  dealerFee: number,
  addOns: number,
  askingPrice: number,
  apr: number,
  creditScore: string
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
  
  // Combine DPG score (50%) and fee score (50%)
  const score = Math.round(dpgScore * 0.50 + feeScore * 0.50);
  
  let details = "";
  if (dpgScore < 50) details = "The dealer is asking significantly above market value. Negotiate hard or walk away.";
  else if (addOns > 500) details = "High dealer add-ons detected. These are often overpriced—negotiate to remove them.";
  else if (dealerFee > 500) details = "Dealer fee seems high. Try to negotiate it down or off.";
  else if (docFee > 700) details = "Doc fee exceeds typical range. Some states cap this fee.";
  else if (apr > expected + 2) details = "APR seems high for your credit range. Shop for better rates.";
  else if (dpgScore >= 80) details = "Price is at or below market value. This is a well-priced deal.";
  else details = "Deal structure looks reasonable. Always verify final numbers before signing.";
  
  return { score, details };
}

// Affordability score (V3 - incorporates CFG and burdens)
function calcAffordability(
  cfgScore: number,
  monthlyPayment: number,
  insurance: number,
  fuelCost: number,
  maintenance: number,
  monthlyIncome: number
): PillarResult {
  const totalMonthlyCost = monthlyPayment + insurance + fuelCost + maintenance;
  const paymentBurden = (monthlyPayment / monthlyIncome) * 100;
  const totalBurden = (totalMonthlyCost / monthlyIncome) * 100;
  
  let burdenScore = 100;
  
  // Payment burden (should be under 10-15%)
  if (paymentBurden > 20) burdenScore = 30;
  else if (paymentBurden > 15) burdenScore = 50;
  else if (paymentBurden > 12) burdenScore = 70;
  else if (paymentBurden > 10) burdenScore = 85;
  
  // Total operating burden penalty
  if (totalBurden > 25) burdenScore -= 20;
  else if (totalBurden > 20) burdenScore -= 10;
  
  burdenScore = Math.max(0, Math.min(100, burdenScore));
  
  // Combine CFG score (40%) and burden score (60%)
  const score = Math.round(cfgScore * 0.40 + burdenScore * 0.60);
  
  let details = "";
  if (cfgScore === 0) details = `This car is far above your safe buying range. It could severely strain your finances.`;
  else if (cfgScore < 40) details = `This car exceeds your safe budget by a significant margin. Consider a less expensive option.`;
  else if (totalBurden > 25) details = `Total car costs (${totalBurden.toFixed(0)}% of income) are dangerously high. This could strain your budget.`;
  else if (paymentBurden > 15) details = `Payment alone is ${paymentBurden.toFixed(0)}% of income. This is higher than recommended.`;
  else if (score >= 80) details = `Car fits comfortably within your budget. Total cost is ${totalBurden.toFixed(0)}% of income.`;
  else details = `At ${totalBurden.toFixed(0)}% of income, this is manageable but be mindful of other expenses.`;
  
  return { score, details };
}

function generateRecommendation(overall: number, pillars: ScoreResult['pillars'], dpgPercent: number, cfgPercent: number): string {
  const warnings: string[] = [];
  
  if (dpgPercent > 15) warnings.push("significantly overpriced");
  if (cfgPercent > 25) warnings.push("beyond your safe budget");
  if (pillars.affordability.score < 40) warnings.push("could strain your finances");
  if (pillars.reliability.score < 60) warnings.push("reliability concerns");
  
  if (overall >= 80) {
    return "This looks like a solid deal! The numbers check out well across all five pillars. The price is fair, and it fits your budget. If it feels right, you can move forward with confidence.";
  } else if (overall >= 60) {
    const weakest = Object.entries(pillars).sort((a, b) => a[1].score - b[1].score)[0];
    return `This deal is okay but has room for improvement. Focus on ${weakest[0].replace(/([A-Z])/g, ' $1').toLowerCase().trim()}—it's pulling your score down. Consider negotiating or shopping around.`;
  } else if (overall >= 40) {
    return `Caution advised. This deal has concerns: ${warnings.join(", ")}. We recommend getting additional quotes or considering different vehicles before committing.`;
  } else {
    return `This deal has significant red flags: ${warnings.join(", ")}. We strongly recommend walking away and exploring better options. Your financial health is more important than any single car.`;
  }
}

// Main scoring function
export function calculateDuoDriveScore(input: DealInput): ScoreResult {
  const effectivePrice = (input.negotiatedPrice || input.askingPrice) - input.downPayment - input.tradeIn;
  const totalFees = input.docFee + input.dealerFee + input.addOns + input.taxes + input.registration;
  const loanAmount = Math.max(0, effectivePrice + totalFees);
  
  // Calculate payments
  const monthlyPayment = calculateMonthlyPayment(loanAmount, input.apr, input.term);
  const totalPaid = monthlyPayment * input.term;
  const totalInterest = totalPaid - loanAmount;
  const interestRatio = loanAmount > 0 ? (totalInterest / loanAmount) * 100 : 0;
  const totalCost = totalPaid + input.downPayment + input.tradeIn;
  
  // V3 Calculations
  const trueMarketPrice = input.estimatedMarketValue 
    ? calculateTrueMarketPrice(input.estimatedMarketValue, input.year, input.mileage, input.trim)
    : input.askingPrice * 0.9; // Fallback: assume 10% markup if no estimate
  
  const dpg = calculateDealPriceGap(input.askingPrice, trueMarketPrice);
  const customerMaxSafePrice = calculateCustomerMaxSafePrice(input.monthlyIncome, input.apr, input.term);
  const cfg = calculateCustomerFitGap(input.askingPrice, customerMaxSafePrice);
  
  // Calculate costs
  const totalMonthlyCost = monthlyPayment + input.insurance + input.fuelCost + input.maintenance;
  const paymentBurdenPercent = (monthlyPayment / input.monthlyIncome) * 100;
  const operatingCostBurden = (totalMonthlyCost / input.monthlyIncome) * 100;
  
  // Calculate pillars
  const depreciation = calcDepreciation(input.year, input.mileage);
  const reliability = calcReliability(input.make, input.mileage);
  const safety = calcSafety(input.year, input.make);
  const dealHealth = calcDealHealth(
    dpg.score,
    input.docFee,
    input.dealerFee,
    input.addOns,
    input.askingPrice,
    input.apr,
    input.creditScore
  );
  const affordability = calcAffordability(
    cfg.score,
    monthlyPayment,
    input.insurance,
    input.fuelCost,
    input.maintenance,
    input.monthlyIncome
  );
  
  // Calculate overall score (weighted average)
  const overall = Math.round(
    depreciation.score * 0.15 +
    reliability.score * 0.20 +
    safety.score * 0.15 +
    dealHealth.score * 0.25 +
    affordability.score * 0.25
  );
  
  const pillars = {
    depreciation,
    reliability,
    safety,
    dealHealth,
    affordability,
  };
  
  return {
    overall,
    pillars,
    recommendation: generateRecommendation(overall, pillars, dpg.gapPercent, cfg.gapPercent),
    monthlyPayment: Math.round(monthlyPayment),
    totalCost: Math.round(totalCost),
    loanAmount: Math.round(loanAmount),
    totalInterest: Math.round(totalInterest),
    interestRatio: Math.round(interestRatio * 10) / 10,
    trueMarketPrice: Math.round(trueMarketPrice),
    dealPriceGap: Math.round(dpg.gap),
    dealPriceGapPercent: Math.round(dpg.gapPercent * 10) / 10,
    customerMaxSafePrice: Math.round(customerMaxSafePrice),
    customerFitGap: Math.round(cfg.gap),
    customerFitGapPercent: Math.round(cfg.gapPercent * 10) / 10,
    paymentBurdenPercent: Math.round(paymentBurdenPercent * 10) / 10,
    operatingCostBurden: Math.round(operatingCostBurden * 10) / 10,
    totalMonthlyCost: Math.round(totalMonthlyCost),
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
  return "Overpriced";
}
