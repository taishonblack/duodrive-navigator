 // Common car makes for fuzzy matching
 const MAKES = [
   "Acura", "Alfa Romeo", "Aston Martin", "Audi", "Bentley", "BMW", "Buick",
   "Cadillac", "Chevrolet", "Chrysler", "Dodge", "Ferrari", "Fiat", "Ford",
   "Genesis", "GMC", "Honda", "Hyundai", "Infiniti", "Jaguar", "Jeep", "Kia",
   "Lamborghini", "Land Rover", "Lexus", "Lincoln", "Lucid", "Maserati",
   "Mazda", "McLaren", "Mercedes-Benz", "Mini", "Mitsubishi", "Nissan",
   "Polestar", "Porsche", "Ram", "Rivian", "Rolls-Royce", "Subaru", "Tesla",
   "Toyota", "Volkswagen", "Volvo",
 ];
 
 // Common aliases people use
 const MAKE_ALIASES: Record<string, string> = {
   "merc": "Mercedes-Benz",
   "mercedes": "Mercedes-Benz",
   "benz": "Mercedes-Benz",
   "chevy": "Chevrolet",
   "vw": "Volkswagen",
   "land": "Land Rover",
   "range": "Land Rover",
   "rover": "Land Rover",
   "alfa": "Alfa Romeo",
   "aston": "Aston Martin",
   "rolls": "Rolls-Royce",
   "lambo": "Lamborghini",
 };
 
 // Levenshtein distance for fuzzy matching
 function levenshtein(a: string, b: string): number {
   const m = a.length;
   const n = b.length;
   const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
   
   for (let i = 0; i <= m; i++) dp[i][0] = i;
   for (let j = 0; j <= n; j++) dp[0][j] = j;
   
   for (let i = 1; i <= m; i++) {
     for (let j = 1; j <= n; j++) {
       dp[i][j] = Math.min(
         dp[i - 1][j] + 1,
         dp[i][j - 1] + 1,
         dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
       );
     }
   }
   return dp[m][n];
 }
 
 // Normalize a string for comparison
 function normalize(s: string): string {
   return s.toLowerCase().replace(/[^a-z0-9]/g, "");
 }
 
 export interface NormalizeMakeResult {
   make: string | null;
   suggestion: string | null;
   confidence: "exact" | "alias" | "fuzzy" | "none";
 }
 
 /**
  * Attempts to normalize a car make from user input.
  * Returns exact match, alias match, or fuzzy suggestion.
  */
 export function normalizeMake(raw: string): NormalizeMakeResult {
   const s = raw.trim();
   if (!s) return { make: null, suggestion: null, confidence: "none" };
   
   const normalized = normalize(s);
   
   // Check aliases first (merc → Mercedes-Benz)
   const aliasKey = Object.keys(MAKE_ALIASES).find(
     alias => normalize(alias) === normalized
   );
   if (aliasKey) {
     return { make: MAKE_ALIASES[aliasKey], suggestion: null, confidence: "alias" };
   }
   
   // Exact match (case-insensitive)
   const exact = MAKES.find(m => normalize(m) === normalized);
   if (exact) return { make: exact, suggestion: null, confidence: "exact" };
   
   // Fuzzy match with Levenshtein distance
   const scored = MAKES.map(m => ({
     make: m,
     distance: levenshtein(normalized, normalize(m)),
   })).sort((a, b) => a.distance - b.distance);
   
   const best = scored[0];
   
   // Threshold: allow up to 3 character differences for longer names
   // or 2 for shorter names
   const threshold = normalized.length > 5 ? 3 : 2;
   
   if (best && best.distance <= threshold) {
     return { make: null, suggestion: best.make, confidence: "fuzzy" };
   }
   
   return { make: null, suggestion: null, confidence: "none" };
 }
 
 /**
  * Extract vehicle info from a user message.
  * Returns partial data that can be merged with deal state.
  */
 export interface ExtractedVehicleInfo {
   make?: string;
   makeSuggestion?: string;
   model?: string;
   year?: string;
   condition?: "new" | "used";
   price?: string;
   mileage?: string;
 }
 
 // Common model patterns by make
 const MODEL_PATTERNS: Record<string, string[]> = {
   "Tesla": ["Model S", "Model 3", "Model X", "Model Y", "Cybertruck", "Roadster"],
   "Toyota": ["Camry", "Corolla", "RAV4", "Highlander", "Tacoma", "Tundra", "4Runner", "Prius", "Sienna", "Supra"],
   "Honda": ["Civic", "Accord", "CR-V", "Pilot", "Odyssey", "HR-V", "Passport", "Ridgeline"],
   "Ford": ["F-150", "Mustang", "Explorer", "Escape", "Bronco", "Ranger", "Edge", "Expedition", "Maverick"],
   "Chevrolet": ["Silverado", "Equinox", "Tahoe", "Camaro", "Corvette", "Traverse", "Blazer", "Colorado", "Suburban"],
   "BMW": ["3 Series", "5 Series", "7 Series", "X3", "X5", "X7", "M3", "M5", "i4", "iX"],
   "Mercedes-Benz": ["C-Class", "E-Class", "S-Class", "GLC", "GLE", "GLS", "A-Class", "CLA", "AMG GT"],
   "Lexus": ["ES", "IS", "LS", "RX", "NX", "GX", "LX", "LC", "RC"],
   "Audi": ["A3", "A4", "A6", "A8", "Q3", "Q5", "Q7", "Q8", "e-tron", "RS"],
   "Hyundai": ["Elantra", "Sonata", "Tucson", "Santa Fe", "Palisade", "Kona", "Ioniq", "Venue"],
   "Kia": ["Forte", "K5", "Sorento", "Sportage", "Telluride", "Soul", "Carnival", "EV6"],
   "Nissan": ["Altima", "Sentra", "Maxima", "Rogue", "Pathfinder", "Murano", "Frontier", "Titan", "Leaf", "Z"],
   "Subaru": ["Outback", "Forester", "Crosstrek", "Impreza", "Legacy", "Ascent", "WRX", "BRZ"],
   "Mazda": ["Mazda3", "Mazda6", "CX-5", "CX-9", "CX-30", "CX-50", "MX-5", "MX-30"],
   "Volkswagen": ["Jetta", "Passat", "Golf", "Tiguan", "Atlas", "ID.4", "Taos", "Arteon"],
   "Jeep": ["Wrangler", "Grand Cherokee", "Cherokee", "Compass", "Gladiator", "Renegade", "Wagoneer"],
 };
 
 export function extractVehicleInfo(message: string): ExtractedVehicleInfo {
   const result: ExtractedVehicleInfo = {};
   const lower = message.toLowerCase();
   const words = message.split(/\s+/);
   
   // Extract year (4-digit number between 1990-2030)
   const yearMatch = message.match(/\b(19[9]\d|20[0-2]\d|2030)\b/);
   if (yearMatch) {
     result.year = yearMatch[1];
   }
   
   // Extract condition
   if (/\b(used|pre-?owned|cpo|certified)\b/i.test(message)) {
     result.condition = "used";
   } else if (/\b(new|brand new)\b/i.test(message)) {
     result.condition = "new";
   }
   
   // Extract price (with $ or 'k' suffix)
   const priceMatch = message.match(/\$?\s*([\d,]+(?:\.\d{2})?)\s*k?\b/i);
   if (priceMatch) {
     let price = priceMatch[1].replace(/,/g, "");
     // Handle 'k' suffix (35k → 35000)
     if (/k\b/i.test(message.slice(priceMatch.index || 0, (priceMatch.index || 0) + priceMatch[0].length + 2))) {
       price = (parseFloat(price) * 1000).toString();
     }
     // Only store if it looks like a car price (> $1000)
     if (parseFloat(price) > 1000) {
       result.price = price;
     }
   }
   
   // Extract mileage
   const mileageMatch = message.match(/(\d{1,3}[,.]?\d{3})\s*(miles?|mi\.?|k\s*miles?)/i);
   if (mileageMatch) {
     result.mileage = mileageMatch[1].replace(/[,.]/g, "");
   }
   
   // Try to extract make from each word
   for (const word of words) {
     const cleaned = word.replace(/[^a-zA-Z]/g, "");
     if (cleaned.length < 2) continue;
     
     const makeResult = normalizeMake(cleaned);
     if (makeResult.make) {
       result.make = makeResult.make;
       break;
     } else if (makeResult.suggestion && !result.makeSuggestion) {
       result.makeSuggestion = makeResult.suggestion;
     }
   }
   
   // If we found a make, try to find the model
   if (result.make && MODEL_PATTERNS[result.make]) {
     for (const model of MODEL_PATTERNS[result.make]) {
       const modelNorm = normalize(model);
       if (lower.includes(modelNorm) || lower.includes(model.toLowerCase())) {
         result.model = model;
         break;
       }
     }
   }
   
   // Also check for common model mentions without make context
   if (!result.model) {
     // Check Tesla models specifically (common to just say "Model 3")
     if (/\bmodel\s*[3sxy]\b/i.test(message)) {
       const teslaMatch = message.match(/\bmodel\s*([3sxy])\b/i);
       if (teslaMatch) {
         result.model = `Model ${teslaMatch[1].toUpperCase()}`;
         if (!result.make) result.make = "Tesla";
       }
     }
   }
   
   return result;
 }
 
 /**
  * Determines what question to ask next based on known deal state.
  * Returns null if we have enough info to summarize.
  */
 export interface DealStateForNextQuestion {
   make?: string;
   model?: string;
   year?: string;
   condition?: string;
   mileage?: string;
   askingPrice?: string;
   atDealership?: string | boolean;
 }
 
 export function getNextQuestion(deal: DealStateForNextQuestion): string | null {
   if (!deal.make) return "Which brand are you looking at?";
   if (!deal.model) return `Which ${deal.make} model?`;
   if (!deal.condition && !deal.year) return "Is it new or used?";
   if (deal.condition === "used" && !deal.mileage) return "How many miles does it have?";
   if (!deal.askingPrice) return "What's the asking price?";
   if (deal.atDealership === undefined) return "Are you at the dealership right now?";
   return null; // We have enough to proceed
 }