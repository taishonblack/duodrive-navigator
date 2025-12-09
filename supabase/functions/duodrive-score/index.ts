import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { 
  checkRateLimit, 
  getClientIP, 
  rateLimitExceededResponse 
} from "../_shared/rate-limit.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
}

// Calculate monthly payment
function calculateMonthlyPayment(principal: number, apr: number, termMonths: number): number {
  if (apr === 0) return principal / termMonths;
  const monthlyRate = apr / 100 / 12;
  return (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / 
         (Math.pow(1 + monthlyRate, termMonths) - 1);
}

// Depreciation score (based on age, mileage)
function calcDepreciation(year: number, mileage: number, askingPrice: number): { score: number; details: string } {
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
  if (age <= 1) score -= 15; // New cars depreciate fast
  
  score = Math.max(0, Math.min(100, score));
  
  let details = "";
  if (age <= 1) details = "New vehicles depreciate quickly in the first year. Consider a 1-2 year old model.";
  else if (age <= 3 && avgMilesPerYear <= 12000) details = "Sweet spot! Low depreciation with modern features.";
  else if (mileage > 100000) details = "High mileage increases depreciation risk and repair costs.";
  else details = "Reasonable depreciation profile for this vehicle age.";
  
  return { score: Math.round(score), details };
}

// Reliability score (based on make reputation)
function calcReliability(make: string, year: number, mileage: number): { score: number; details: string } {
  const reliableMakes = ['toyota', 'honda', 'lexus', 'mazda', 'subaru'];
  const avgMakes = ['hyundai', 'kia', 'ford', 'chevrolet', 'nissan', 'volkswagen'];
  const lowerMakes = ['chrysler', 'dodge', 'jeep', 'ram', 'fiat', 'alfa romeo', 'land rover', 'jaguar'];
  
  const makeLower = make.toLowerCase();
  let score = 70; // Base score
  
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
function calcSafety(year: number, make: string): { score: number; details: string } {
  const currentYear = new Date().getFullYear();
  const age = currentYear - year;
  
  let score = 85; // Base modern car score
  
  // Newer cars have better safety tech
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

// Deal Health score (based on fees, markup)
function calcDealHealth(
  askingPrice: number,
  docFee: number,
  dealerFee: number,
  addOns: number,
  apr: number,
  creditScore: string
): { score: number; details: string } {
  let score = 80;
  
  // Doc fee penalty (avg is $300-500)
  if (docFee > 700) score -= 15;
  else if (docFee > 500) score -= 5;
  
  // Dealer fee is a red flag
  if (dealerFee > 0) score -= Math.min(20, dealerFee / 50);
  
  // Add-ons are usually overpriced
  if (addOns > 0) {
    const addOnPercent = (addOns / askingPrice) * 100;
    if (addOnPercent > 5) score -= 20;
    else if (addOnPercent > 2) score -= 10;
  }
  
  // APR check based on credit
  const expectedAPR: Record<string, number> = {
    excellent: 5.5,
    good: 7.0,
    fair: 10.0,
    poor: 15.0,
  };
  const expected = expectedAPR[creditScore] || 8.0;
  if (apr > expected + 2) score -= 15;
  else if (apr > expected) score -= 5;
  else if (apr < expected) score += 5;
  
  score = Math.max(0, Math.min(100, score));
  
  let details = "";
  if (addOns > 500) details = "High dealer add-ons detected. These are often overpriced—negotiate to remove them.";
  else if (dealerFee > 500) details = "Dealer fee seems high. Try to negotiate it down or off.";
  else if (docFee > 700) details = "Doc fee exceeds typical range. Some states cap this fee.";
  else if (apr > expected + 2) details = "APR seems high for your credit range. Shop for better rates.";
  else details = "Deal structure looks reasonable. Always verify final numbers before signing.";
  
  return { score: Math.round(score), details };
}

// Affordability score
function calcAffordability(
  monthlyPayment: number,
  insurance: number,
  fuelCost: number,
  maintenance: number,
  monthlyIncome: number
): { score: number; details: string } {
  const totalMonthlyCost = monthlyPayment + insurance + fuelCost + maintenance;
  const costRatio = (totalMonthlyCost / monthlyIncome) * 100;
  
  let score = 100;
  
  // 10-15% of income is recommended
  if (costRatio > 25) score = 30;
  else if (costRatio > 20) score = 50;
  else if (costRatio > 15) score = 70;
  else if (costRatio > 10) score = 85;
  
  score = Math.max(0, Math.min(100, score));
  
  let details = "";
  if (costRatio > 25) details = `Car costs ${costRatio.toFixed(0)}% of income. This is too high and may strain your budget.`;
  else if (costRatio > 20) details = `At ${costRatio.toFixed(0)}% of income, this is on the high side. Consider a less expensive option.`;
  else if (costRatio > 15) details = `${costRatio.toFixed(0)}% of income is manageable but higher than ideal.`;
  else details = `${costRatio.toFixed(0)}% of income is a healthy car budget. Nice!`;
  
  return { score: Math.round(score), details };
}

function generateRecommendation(overall: number, pillars: ScoreResult['pillars']): string {
  if (overall >= 80) {
    return "This looks like a solid deal! The numbers check out well across all five pillars. If it feels right, you can move forward with confidence.";
  } else if (overall >= 60) {
    const weakest = Object.entries(pillars).sort((a, b) => a[1].score - b[1].score)[0];
    return `This deal is okay but has room for improvement. Focus on ${weakest[0].replace(/([A-Z])/g, ' $1').toLowerCase().trim()}—it's pulling your score down. Consider negotiating or shopping around.`;
  } else if (overall >= 40) {
    return "Caution advised. Multiple aspects of this deal raise concerns. We recommend getting additional quotes or considering different vehicles before committing.";
  } else {
    return "This deal has significant red flags. We strongly recommend walking away and exploring better options. Your financial health is more important than any single car.";
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check rate limit
    const clientIP = getClientIP(req);
    const rateLimitResult = checkRateLimit(clientIP, RATE_LIMIT_CONFIG);
    
    if (!rateLimitResult.allowed) {
      console.log(`Rate limit exceeded for IP: ${clientIP}`);
      return rateLimitExceededResponse(rateLimitResult, corsHeaders);
    }

    const input: DealInput = await req.json();
    console.log("Received deal input:", JSON.stringify(input));

    // Calculate effective price
    const effectivePrice = (input.negotiatedPrice || input.askingPrice) - input.downPayment - input.tradeIn;
    const totalFees = input.docFee + input.dealerFee + input.addOns + input.taxes + input.registration;
    const loanAmount = effectivePrice + totalFees;
    
    // Calculate monthly payment
    const monthlyPayment = calculateMonthlyPayment(loanAmount, input.apr, input.term);
    const totalCost = monthlyPayment * input.term + input.downPayment + input.tradeIn;

    // Calculate each pillar
    const depreciation = calcDepreciation(input.year, input.mileage, input.askingPrice);
    const reliability = calcReliability(input.make, input.year, input.mileage);
    const safety = calcSafety(input.year, input.make);
    const dealHealth = calcDealHealth(
      input.askingPrice,
      input.docFee,
      input.dealerFee,
      input.addOns,
      input.apr,
      input.creditScore
    );
    const affordability = calcAffordability(
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

    const result: ScoreResult = {
      overall,
      pillars,
      recommendation: generateRecommendation(overall, pillars),
      monthlyPayment: Math.round(monthlyPayment),
      totalCost: Math.round(totalCost),
    };

    console.log("Calculated score:", JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error calculating score:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
