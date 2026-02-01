import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { 
  checkRateLimit, 
  getClientIP, 
  rateLimitExceededResponse 
} from "../_shared/rate-limit.ts";
import { getCorsWithSecurityHeaders } from "../_shared/security-headers.ts";

const corsHeaders = getCorsWithSecurityHeaders();

// Rate limit: 15 requests per minute per IP
const RATE_LIMIT_CONFIG = {
  maxRequests: 15,
  windowMs: 60 * 1000,
  keyPrefix: "pricing-confidence",
};

interface VehicleInfo {
  year: number;
  make: string;
  model: string;
  trim?: string;
  mileage: number;
  condition?: "excellent" | "good" | "fair" | "poor";
  zipCode?: string;
}

interface PricingResult {
  fairMarketValue: number;
  priceRanges: {
    steal: number;      // Amazing deal, grab it
    low: number;        // Good deal
    target: number;     // Fair negotiated price
    walkAway: number;   // Maximum you should pay
  };
  confidence: "low" | "medium" | "high";
  regionalAdjustment: number; // Percentage adjustment for region
  factors: {
    mileageImpact: string;
    ageImpact: string;
    demandLevel: string;
    seasonalTrend: string;
  };
  reasoning: string;
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

    const vehicle: VehicleInfo = await req.json();
    
    if (!vehicle.year || !vehicle.make || !vehicle.model) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: year, make, model" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Calculating pricing confidence for:", JSON.stringify(vehicle));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build regional context
    const regionContext = vehicle.zipCode 
      ? `Buyer ZIP code: ${vehicle.zipCode}. Consider regional market differences (coastal vs inland, urban vs rural, weather-related demand).`
      : "No ZIP code provided - use national average pricing.";

    const prompt = `You are an expert automotive market analyst. Provide comprehensive pricing guidance for this vehicle:

Vehicle Details:
- Year: ${vehicle.year}
- Make: ${vehicle.make}
- Model: ${vehicle.model}
${vehicle.trim ? `- Trim: ${vehicle.trim}` : ''}
- Mileage: ${vehicle.mileage?.toLocaleString() || 'Unknown'} miles
- Condition: ${vehicle.condition || 'Unknown'}

${regionContext}

Current Date: February 2026

Analyze and provide:
1. Fair Market Value (what the car is actually worth in private party/dealer retail)
2. Price ranges for negotiation:
   - "Steal" price (15-20% below market - exceptional deal)
   - "Low" price (5-10% below market - good deal)
   - "Target" price (at or slightly below market - fair negotiated price)
   - "Walk Away" price (5-10% above market - maximum to pay)
3. Confidence level based on data availability
4. Regional adjustment percentage (positive = higher in this region, negative = lower)
5. Key factors affecting price

Respond ONLY with valid JSON in this exact format:
{
  "fairMarketValue": <number>,
  "priceRanges": {
    "steal": <number>,
    "low": <number>,
    "target": <number>,
    "walkAway": <number>
  },
  "confidence": "<low|medium|high>",
  "regionalAdjustment": <number as percentage, e.g., 5 for +5% or -3 for -3%>,
  "factors": {
    "mileageImpact": "<brief description>",
    "ageImpact": "<brief description>",
    "demandLevel": "<low|moderate|high|very high>",
    "seasonalTrend": "<brief description>"
  },
  "reasoning": "<2-3 sentence explanation of the pricing>"
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { 
            role: "system", 
            content: "You are an automotive pricing expert. Always respond with valid JSON only, no markdown or extra text. Base estimates on real market data patterns and regional trends." 
          },
          { role: "user", content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error("Failed to get AI response");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("No content in AI response");
    }

    console.log("AI response:", content);

    // Parse the JSON response
    let result: PricingResult;
    try {
      // Clean the response - remove markdown code blocks if present
      const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
      result = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      
      // Fallback estimation based on depreciation curves
      const age = new Date().getFullYear() - vehicle.year;
      const basePrices: Record<string, number> = {
        'toyota': 35000, 'honda': 32000, 'ford': 38000, 'chevrolet': 36000,
        'nissan': 30000, 'hyundai': 28000, 'kia': 27000, 'mazda': 30000,
        'subaru': 32000, 'jeep': 35000, 'dodge': 33000, 'ram': 45000,
        'bmw': 55000, 'mercedes': 60000, 'audi': 50000, 'lexus': 50000,
        'volkswagen': 32000, 'gmc': 45000, 'buick': 35000, 'cadillac': 50000,
      };
      
      const basePrice = basePrices[vehicle.make.toLowerCase()] || 32000;
      
      // Calculate depreciation (diminishing returns)
      let value = basePrice;
      for (let i = 0; i < age; i++) {
        const depRate = i === 0 ? 0.20 : 0.15 * Math.pow(0.9, i);
        value *= (1 - depRate);
      }
      
      // Mileage adjustment
      const expectedMileage = age * 12000;
      const mileageDiff = (vehicle.mileage || expectedMileage) - expectedMileage;
      value -= mileageDiff * 0.08;
      
      // Condition adjustment
      const conditionMultipliers: Record<string, number> = {
        'excellent': 1.10, 'good': 1.0, 'fair': 0.90, 'poor': 0.75
      };
      value *= conditionMultipliers[vehicle.condition || 'good'] || 1.0;
      
      value = Math.max(3000, Math.round(value));
      
      result = {
        fairMarketValue: value,
        priceRanges: {
          steal: Math.round(value * 0.82),
          low: Math.round(value * 0.92),
          target: Math.round(value * 0.97),
          walkAway: Math.round(value * 1.08),
        },
        confidence: "low",
        regionalAdjustment: 0,
        factors: {
          mileageImpact: mileageDiff > 15000 ? "High mileage reducing value" : mileageDiff < -15000 ? "Low mileage adding value" : "Average mileage",
          ageImpact: age <= 3 ? "Recent model year" : age <= 7 ? "Moderate depreciation" : "Older vehicle",
          demandLevel: "moderate",
          seasonalTrend: "Typical market conditions"
        },
        reasoning: "Fallback estimate based on depreciation curves. AI parsing failed - consider these as rough estimates only."
      };
    }

    // Validate and sanitize the result
    if (!result.fairMarketValue || result.fairMarketValue < 1000) {
      result.fairMarketValue = 15000; // Reasonable fallback
    }
    
    // Ensure price ranges make sense
    if (!result.priceRanges || typeof result.priceRanges !== 'object') {
      result.priceRanges = {
        steal: Math.round(result.fairMarketValue * 0.82),
        low: Math.round(result.fairMarketValue * 0.92),
        target: Math.round(result.fairMarketValue * 0.97),
        walkAway: Math.round(result.fairMarketValue * 1.08),
      };
    }

    console.log("Final pricing result:", JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error calculating pricing confidence:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
