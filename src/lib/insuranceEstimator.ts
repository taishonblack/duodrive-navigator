/**
 * Insurance Cost Estimator
 * Estimates monthly auto insurance based on vehicle characteristics and credit score
 */

interface InsuranceEstimateInput {
  make?: string;
  model?: string;
  year?: string;
  askingPrice?: string;
  creditScore?: string;
  isNew?: boolean;
}

interface InsuranceEstimate {
  monthly: number;
  annual: number;
  confidence: 'low' | 'medium' | 'high';
  factors: string[];
}

// Luxury/premium brands typically have higher insurance
const LUXURY_MAKES = [
  'lexus', 'bmw', 'mercedes', 'mercedes-benz', 'audi', 'porsche', 'jaguar',
  'land rover', 'range rover', 'infiniti', 'acura', 'cadillac', 'lincoln',
  'volvo', 'genesis', 'alfa romeo', 'maserati', 'bentley', 'rolls-royce',
  'ferrari', 'lamborghini', 'aston martin', 'tesla', 'lucid', 'rivian'
];

// Sports/performance models have higher insurance
const SPORTS_KEYWORDS = [
  'mustang', 'camaro', 'corvette', 'challenger', 'charger', 'supra', 'wrx',
  'sti', 'type r', 'type-r', 'gt-r', 'gtr', 'm3', 'm4', 'm5', 'amg', 'rs',
  'hellcat', 'demon', 'shelby', '911', 'cayman', 'boxster', 'z4', 'miata',
  'mx-5', '370z', '400z', 'brz', 'gr86', '86', 'scat pack'
];

// SUVs and trucks typically have moderate insurance
const SUV_TRUCK_KEYWORDS = [
  'suv', 'crossover', 'truck', 'pickup', 'f-150', 'f150', 'silverado', 
  'ram', 'tundra', 'tacoma', 'colorado', 'ranger', 'frontier', 'gladiator',
  'explorer', 'expedition', 'tahoe', 'suburban', 'yukon', '4runner',
  'highlander', 'pilot', 'pathfinder', 'telluride', 'palisade', 'santa fe',
  'tucson', 'rav4', 'cr-v', 'crv', 'cx-5', 'cx5', 'cx-50', 'cx-90',
  'wrangler', 'bronco', 'defender', 'grand cherokee'
];

function getVehicleCategory(make?: string, model?: string): 'luxury' | 'sports' | 'suv_truck' | 'standard' {
  const makeLower = (make || '').toLowerCase();
  const modelLower = (model || '').toLowerCase();
  const combined = `${makeLower} ${modelLower}`;

  // Check for luxury brand
  if (LUXURY_MAKES.some(lux => makeLower.includes(lux))) {
    return 'luxury';
  }

  // Check for sports/performance
  if (SPORTS_KEYWORDS.some(sport => combined.includes(sport))) {
    return 'sports';
  }

  // Check for SUV/truck
  if (SUV_TRUCK_KEYWORDS.some(suv => combined.includes(suv))) {
    return 'suv_truck';
  }

  return 'standard';
}

function getCreditMultiplier(creditScore?: string): number {
  if (!creditScore) return 1.0;
  
  const score = parseInt(creditScore, 10);
  
  // Handle text-based credit tiers
  const creditLower = creditScore.toLowerCase();
  if (creditLower.includes('excellent') || score >= 740) return 0.85;
  if (creditLower.includes('good') || score >= 680) return 1.0;
  if (creditLower.includes('fair') || score >= 620) return 1.15;
  if (creditLower.includes('poor') || creditLower.includes('building') || score < 620) return 1.35;
  
  return 1.0;
}

function getVehicleAgeMultiplier(year?: string): number {
  if (!year) return 1.0;
  
  const vehicleYear = parseInt(year, 10);
  const currentYear = new Date().getFullYear();
  const age = currentYear - vehicleYear;
  
  if (age <= 1) return 1.15; // New cars cost more to insure
  if (age <= 3) return 1.05;
  if (age <= 5) return 1.0;
  if (age <= 8) return 0.90;
  if (age <= 12) return 0.80;
  return 0.70; // Older cars are cheaper to insure
}

function getValueMultiplier(askingPrice?: string): number {
  if (!askingPrice) return 1.0;
  
  const price = parseInt(askingPrice.replace(/[^0-9]/g, ''), 10);
  
  if (price >= 80000) return 1.25;
  if (price >= 60000) return 1.15;
  if (price >= 45000) return 1.05;
  if (price >= 30000) return 1.0;
  if (price >= 20000) return 0.90;
  return 0.80;
}

export function estimateInsurance(input: InsuranceEstimateInput): InsuranceEstimate {
  const factors: string[] = [];
  
  // Base monthly insurance (national average for full coverage is ~$180/month)
  let baseMonthly = 165;
  
  // Vehicle category adjustment
  const category = getVehicleCategory(input.make, input.model);
  switch (category) {
    case 'luxury':
      baseMonthly *= 1.35;
      factors.push('Luxury vehicle (+35%)');
      break;
    case 'sports':
      baseMonthly *= 1.45;
      factors.push('Sports/performance vehicle (+45%)');
      break;
    case 'suv_truck':
      baseMonthly *= 1.10;
      factors.push('SUV/truck (+10%)');
      break;
    default:
      factors.push('Standard vehicle category');
  }
  
  // Credit score adjustment
  const creditMultiplier = getCreditMultiplier(input.creditScore);
  if (creditMultiplier !== 1.0) {
    baseMonthly *= creditMultiplier;
    if (creditMultiplier < 1.0) {
      factors.push(`Excellent credit (-${Math.round((1 - creditMultiplier) * 100)}%)`);
    } else if (creditMultiplier > 1.0) {
      factors.push(`Credit adjustment (+${Math.round((creditMultiplier - 1) * 100)}%)`);
    }
  }
  
  // Vehicle age adjustment
  const ageMultiplier = getVehicleAgeMultiplier(input.year);
  if (ageMultiplier !== 1.0) {
    baseMonthly *= ageMultiplier;
    if (ageMultiplier > 1.0) {
      factors.push(`Newer vehicle (+${Math.round((ageMultiplier - 1) * 100)}%)`);
    } else {
      factors.push(`Older vehicle (-${Math.round((1 - ageMultiplier) * 100)}%)`);
    }
  }
  
  // Value adjustment
  const valueMultiplier = getValueMultiplier(input.askingPrice);
  if (valueMultiplier !== 1.0) {
    baseMonthly *= valueMultiplier;
    if (valueMultiplier > 1.0) {
      factors.push(`Higher value vehicle (+${Math.round((valueMultiplier - 1) * 100)}%)`);
    } else {
      factors.push(`Lower value vehicle (-${Math.round((1 - valueMultiplier) * 100)}%)`);
    }
  }
  
  // Round to nearest $5
  const monthly = Math.round(baseMonthly / 5) * 5;
  const annual = monthly * 12;
  
  // Determine confidence level based on available data
  let confidence: 'low' | 'medium' | 'high' = 'low';
  const hasVehicle = input.make && input.model;
  const hasYear = !!input.year;
  const hasPrice = !!input.askingPrice;
  const hasCredit = !!input.creditScore;
  
  const dataPoints = [hasVehicle, hasYear, hasPrice, hasCredit].filter(Boolean).length;
  if (dataPoints >= 3) confidence = 'high';
  else if (dataPoints >= 2) confidence = 'medium';
  
  return {
    monthly,
    annual,
    confidence,
    factors
  };
}

/**
 * Get a simple insurance estimate for display purposes
 * Returns a formatted string like "$185/mo (estimated)"
 */
export function getInsuranceEstimateDisplay(input: InsuranceEstimateInput): string {
  const estimate = estimateInsurance(input);
  return `$${estimate.monthly}/mo (estimated)`;
}
