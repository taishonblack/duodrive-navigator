import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { 
  checkRateLimit, 
  getClientIP, 
  rateLimitExceededResponse 
} from "../_shared/rate-limit.ts";
import { getCorsWithSecurityHeaders } from "../_shared/security-headers.ts";

const corsHeaders = getCorsWithSecurityHeaders();

// Rate limit: 20 requests per minute per IP
const RATE_LIMIT_CONFIG = {
  maxRequests: 20,
  windowMs: 60 * 1000,
  keyPrefix: "duodrive-score",
};

interface DealInput {
  // Car details
  year: number;
  make: string;
  model: string;
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
  
  // Market data (optional)
  estimatedMarketValue?: number;
}

interface ScoreResult {
  overall: number;
  pillars: {
    depreciation: { score: number; details: string };
    reliability: { score: number; details: string };
    safety: { score: number; details: string };
    dealHealth: { score: number; details: string };
    affordability: { score: number; details: string };
  };
  recommendation: string;
  monthlyPayment: number;
  totalCost: number;
  trueMarketPrice: number;
  dealPriceGapPercent: number;
  customerMaxSafePrice: number;
  customerFitGapPercent: number;
  sanityFlags: string[];
  autoFail: boolean;
}

// ============= V4 HELPER FUNCTIONS =============

// Calculate monthly payment
function calculateMonthlyPayment(principal: number, apr: number, termMonths: number): number {
  if (principal <= 0) return 0;
  if (apr === 0) return principal / termMonths;
  const monthlyRate = apr / 100 / 12;
  return (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / 
         (Math.pow(1 + monthlyRate, termMonths) - 1);
}

// V4: Estimate True Market Price (TMP)
function estimateTMP(year: number, mileage: number, estimatedMarketValue?: number): number {
  if (estimatedMarketValue && estimatedMarketValue > 0) {
    return estimatedMarketValue;
  }
  
  const currentYear = new Date().getFullYear();
  const age = currentYear - year;

  let baseValue = 0;
  if (age <= 1) baseValue = 28000;
  else if (age <= 2) baseValue = 26000;
  else if (age <= 3) baseValue = 24000;
  else if (age <= 5) baseValue = 20000;
  else if (age <= 7) baseValue = 15000;
  else if (age <= 10) baseValue = 10000;
  else if (age <= 13) baseValue = 7000;
  else baseValue = 4000;

  const mileageAdj = (mileage - 60000) * 0.10;
  return Math.max(baseValue - mileageAdj, 1000);
}

// V4: Sanity Checks
function applySanityChecks(askingPrice: number, TMP: number, year: number): {
  autoFail: boolean;
  autoFailScore: number;
  errors: string[];
} {
  const currentYear = new Date().getFullYear();
  const age = currentYear - year;
  const errors: string[] = [];
  let autoFail = false;

  if (askingPrice > TMP * 3) {
    errors.push("Asking price exceeds 300% of expected market value.");
    autoFail = true;
  }

  if (age > 12 && askingPrice > 30000) {
    errors.push("Old vehicle priced at luxury levels - highly suspicious.");
    autoFail = true;
  }

  if (age > 10 && askingPrice > TMP * 2) {
    errors.push("10+ year old vehicle priced at 2x market value.");
    autoFail = true;
  }

  return { autoFail, autoFailScore: 5, errors };
}

// V4: Deal Price Gap Score
function computeDPG(askingPrice: number, TMP: number): { gapPercent: number; score: number } {
  const ratio = TMP > 0 ? askingPrice / TMP : 999;
  const gapPercent = TMP > 0 ? ((askingPrice - TMP) / TMP) * 100 : 999;

  let score: number;
  if (ratio <= 0.9) score = 95;
  else if (ratio <= 1.1) score = 85;
  else if (ratio <= 1.3) score = 70;
  else if (ratio <= 1.5) score = 50;
  else if (ratio <= 2.0) score = 30;
  else if (ratio <= 3.0) score = 10;
  else score = 1;

  return { gapPercent, score };
}

// V4: Customer Max Safety Price
function computeCMSP(monthlyIncome: number, termMonths: number = 60): number {
  return monthlyIncome * 0.12 * termMonths;
}

// V4: Customer Fit Gap
function computeCFG(askingPrice: number, CMSP: number): { gapPercent: number; score: number } {
  const gapPercent = CMSP > 0 ? ((askingPrice - CMSP) / CMSP) * 100 : 999;
  
  let score: number;
  if (askingPrice <= CMSP) score = 90;
  else if (askingPrice <= CMSP * 1.2) score = 70;
  else if (askingPrice <= CMSP * 1.5) score = 40;
  else if (askingPrice <= CMSP * 2.0) score = 20;
  else score = 5;

  return { gapPercent, score };
}

// V4: Loan Impact Score
function computeLoanImpact(askingPrice: number, downPayment: number, apr: number, termMonths: number): {
  loanAmount: number;
  monthly: number;
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

  return { loanAmount, monthly, interestScore };
}

// V4: Down Payment Score
function computeDownPaymentScore(downPayment: number, askingPrice: number): number {
  if (askingPrice <= 0) return 50;
  const pct = downPayment / askingPrice;

  if (pct >= 0.20) return 90;
  if (pct >= 0.10) return 70;
  if (pct >= 0.05) return 50;
  if (pct >= 0.03) return 25;
  return 10;
}

// Depreciation score
function calcDepreciation(year: number, mileage: number): { score: number; details: string } {
  const currentYear = new Date().getFullYear();
  const age = currentYear - year;
  const avgMilesPerYear = mileage / Math.max(age, 1);
  
  let score = 100;
  if (age > 5) score -= (age - 5) * 3;
  if (age > 10) score -= 10;
  if (avgMilesPerYear > 15000) score -= 10;
  if (avgMilesPerYear > 20000) score -= 10;
  if (mileage > 100000) score -= 15;
  if (age <= 1) score -= 15;
  
  score = Math.max(0, Math.min(100, score));
  
  let details = "";
  if (age <= 1) details = "New vehicles depreciate quickly in the first year.";
  else if (age <= 3 && avgMilesPerYear <= 12000) details = "Sweet spot! Low depreciation with modern features.";
  else if (mileage > 100000) details = "High mileage increases depreciation risk.";
  else details = "Reasonable depreciation profile.";
  
  return { score: Math.round(score), details };
}

// Reliability score
function calcReliability(make: string, mileage: number): { score: number; details: string } {
  const reliableMakes = ['toyota', 'honda', 'lexus', 'mazda', 'subaru', 'acura'];
  const avgMakes = ['hyundai', 'kia', 'ford', 'chevrolet', 'nissan', 'volkswagen', 'buick'];
  const lowerMakes = ['chrysler', 'dodge', 'jeep', 'ram', 'fiat', 'alfa romeo', 'land rover', 'jaguar'];
  
  const makeLower = make.toLowerCase();
  let score = 70;
  
  if (reliableMakes.includes(makeLower)) score = 90;
  else if (avgMakes.includes(makeLower)) score = 75;
  else if (lowerMakes.includes(makeLower)) score = 55;
  
  if (mileage > 100000) score -= 15;
  else if (mileage > 75000) score -= 10;
  else if (mileage < 30000) score += 5;
  
  score = Math.max(0, Math.min(100, score));
  
  let details = "";
  if (reliableMakes.includes(makeLower)) details = `${make} ranks high for reliability.`;
  else if (lowerMakes.includes(makeLower)) details = `${make} has below-average reliability.`;
  else details = `${make} has average reliability.`;
  
  return { score: Math.round(score), details };
}

// Safety score
function calcSafety(year: number, make: string): { score: number; details: string } {
  const currentYear = new Date().getFullYear();
  const age = currentYear - year;
  
  let score = 85;
  if (age <= 2) score = 95;
  else if (age <= 5) score = 85;
  else if (age <= 8) score = 75;
  else score = 65;
  
  const safetyLeaders = ['volvo', 'subaru', 'toyota', 'honda', 'mazda'];
  if (safetyLeaders.includes(make.toLowerCase())) score += 5;
  
  score = Math.max(0, Math.min(100, score));
  
  let details = "";
  if (age <= 2) details = "Modern safety features provide excellent protection.";
  else if (age <= 5) details = "Good safety tech. Check for available packages.";
  else details = "Older vehicle may lack modern safety features.";
  
  return { score: Math.round(score), details };
}

// V4: Deal Health score
function calcDealHealth(dpgScore: number, dpgPercent: number): { score: number; details: string } {
  const score = dpgScore;
  
  let details = "";
  if (dpgScore <= 10) details = "DANGER: Price is extremely above market value.";
  else if (dpgScore <= 30) details = "Price is far above market value. Walk away.";
  else if (dpgScore < 50) details = "Price is significantly above market. Negotiate hard.";
  else if (dpgScore >= 80) details = "Price is at or below market value.";
  else details = "Price is somewhat above market.";
  
  return { score, details };
}

// V4: Affordability score
function calcAffordability(cfgScore: number, interestScore: number, downPaymentScore: number, cfgPercent: number): { score: number; details: string } {
  const score = Math.round(cfgScore * 0.40 + interestScore * 0.30 + downPaymentScore * 0.30);
  
  let details = "";
  if (cfgScore <= 5) details = "DANGER: Far above your safe buying range.";
  else if (cfgScore <= 20) details = `${cfgPercent.toFixed(0)}% above your safe budget.`;
  else if (cfgScore < 40) details = "Exceeds your safe budget significantly.";
  else if (score >= 80) details = "Fits comfortably within your budget.";
  else details = "Manageable but be mindful of expenses.";
  
  return { score, details };
}

// V4: Generate recommendation
function generateRecommendation(overall: number, sanityFlags: string[], autoFail: boolean, dpgPercent: number, cfgPercent: number): string {
  if (autoFail) {
    return `🚨 CRITICAL: This deal failed sanity checks. ${sanityFlags.join(" ")} Do not proceed.`;
  }
  
  if (overall >= 80) {
    return "This looks like a solid deal! The price is fair and it fits your budget.";
  } else if (overall >= 60) {
    return "This deal is okay but has room for improvement. Consider negotiating.";
  } else if (overall >= 40) {
    return "Caution advised. This deal has concerns. Get additional quotes.";
  } else {
    return "🚨 This deal has significant red flags. We strongly recommend walking away.";
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientIP = getClientIP(req);
    const rateLimitResult = checkRateLimit(clientIP, RATE_LIMIT_CONFIG);
    
    if (!rateLimitResult.allowed) {
      console.log(`Rate limit exceeded for IP: ${clientIP}`);
      return rateLimitExceededResponse(rateLimitResult, corsHeaders);
    }

    const input: DealInput = await req.json();
    console.log("V4 Received deal input:", JSON.stringify(input));

    const askingPrice = input.negotiatedPrice || input.askingPrice;
    
    // V4: Calculate TMP
    const trueMarketPrice = estimateTMP(input.year, input.mileage, input.estimatedMarketValue);
    
    // V4: Sanity checks
    const sanity = applySanityChecks(askingPrice, trueMarketPrice, input.year);
    
    // V4: DPG and CFG
    const dpg = computeDPG(askingPrice, trueMarketPrice);
    const customerMaxSafePrice = computeCMSP(input.monthlyIncome, input.term);
    const cfg = computeCFG(askingPrice, customerMaxSafePrice);
    
    // Loan calculations
    const totalFees = input.docFee + input.dealerFee + input.addOns + input.taxes + input.registration;
    const effectivePrice = askingPrice - input.downPayment - input.tradeIn + totalFees;
    const loanAmount = Math.max(0, effectivePrice);
    
    const loanImpact = computeLoanImpact(askingPrice, input.downPayment, input.apr, input.term);
    const downPaymentScore = computeDownPaymentScore(input.downPayment, askingPrice);
    
    const monthlyPayment = calculateMonthlyPayment(loanAmount, input.apr, input.term);
    const totalCost = (monthlyPayment * input.term) + input.downPayment + input.tradeIn;
    
    // Pillars
    const depreciation = calcDepreciation(input.year, input.mileage);
    const reliability = calcReliability(input.make, input.mileage);
    const safety = calcSafety(input.year, input.make);
    const dealHealth = calcDealHealth(dpg.score, dpg.gapPercent);
    const affordability = calcAffordability(cfg.score, loanImpact.interestScore, downPaymentScore, cfg.gapPercent);
    
    // V4: If sanity failed, override
    if (sanity.autoFail) {
      const result: ScoreResult = {
        overall: sanity.autoFailScore,
        pillars: {
          depreciation,
          reliability,
          safety,
          dealHealth: { score: sanity.autoFailScore, details: sanity.errors.join(" ") },
          affordability: { score: sanity.autoFailScore, details: "Deal failed sanity checks." },
        },
        recommendation: generateRecommendation(sanity.autoFailScore, sanity.errors, true, dpg.gapPercent, cfg.gapPercent),
        monthlyPayment: Math.round(monthlyPayment),
        totalCost: Math.round(totalCost),
        trueMarketPrice: Math.round(trueMarketPrice),
        dealPriceGapPercent: Math.round(dpg.gapPercent * 10) / 10,
        customerMaxSafePrice: Math.round(customerMaxSafePrice),
        customerFitGapPercent: Math.round(cfg.gapPercent * 10) / 10,
        sanityFlags: sanity.errors,
        autoFail: true,
      };
      
      console.log("V4 SANITY FAIL:", JSON.stringify(result));
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // V4: Final Score = DPG*40% + CFG*30% + Interest*15% + DownPayment*15%
    const overall = Math.round(
      dpg.score * 0.40 +
      cfg.score * 0.30 +
      loanImpact.interestScore * 0.15 +
      downPaymentScore * 0.15
    );

    const result: ScoreResult = {
      overall,
      pillars: {
        depreciation,
        reliability,
        safety,
        dealHealth,
        affordability,
      },
      recommendation: generateRecommendation(overall, sanity.errors, false, dpg.gapPercent, cfg.gapPercent),
      monthlyPayment: Math.round(monthlyPayment),
      totalCost: Math.round(totalCost),
      trueMarketPrice: Math.round(trueMarketPrice),
      dealPriceGapPercent: Math.round(dpg.gapPercent * 10) / 10,
      customerMaxSafePrice: Math.round(customerMaxSafePrice),
      customerFitGapPercent: Math.round(cfg.gapPercent * 10) / 10,
      sanityFlags: [],
      autoFail: false,
    };

    console.log("V4 Calculated score:", JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('V4 Error calculating score:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
