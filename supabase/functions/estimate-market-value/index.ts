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

// Rate limit: 15 requests per minute per IP
const RATE_LIMIT_CONFIG = {
  maxRequests: 15,
  windowMs: 60 * 1000,
  keyPrefix: "estimate-market-value",
};

interface VehicleInfo {
  year: number;
  make: string;
  model: string;
  trim?: string;
  mileage: number;
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
    console.log("Estimating market value for:", JSON.stringify(vehicle));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const prompt = `You are an expert automotive appraiser. Estimate the current fair market value for this vehicle:

Year: ${vehicle.year}
Make: ${vehicle.make}
Model: ${vehicle.model}
${vehicle.trim ? `Trim: ${vehicle.trim}` : ''}
Mileage: ${vehicle.mileage.toLocaleString()} miles

Consider:
- Current market conditions (December 2024)
- Average private party and dealer prices
- Vehicle age and typical depreciation
- Mileage compared to average (12,000 miles/year)
- Brand reputation and demand

Respond ONLY with a JSON object in this exact format:
{
  "estimatedValue": <number>,
  "confidence": "<low|medium|high>",
  "priceRange": { "low": <number>, "high": <number> },
  "reasoning": "<brief 1-2 sentence explanation>"
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
          { role: "system", content: "You are an automotive market value expert. Always respond with valid JSON only, no markdown or extra text." },
          { role: "user", content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
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
    let result;
    try {
      // Clean the response - remove markdown code blocks if present
      const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
      result = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      // Fallback estimation based on simple depreciation
      const age = new Date().getFullYear() - vehicle.year;
      const basePrices: Record<string, number> = {
        'toyota': 35000,
        'honda': 32000,
        'ford': 38000,
        'chevrolet': 36000,
        'nissan': 30000,
        'hyundai': 28000,
        'kia': 27000,
        'mazda': 30000,
        'subaru': 32000,
        'jeep': 35000,
        'dodge': 33000,
        'ram': 45000,
        'bmw': 55000,
        'mercedes': 60000,
        'audi': 50000,
        'lexus': 50000,
      };
      
      const basePrice = basePrices[vehicle.make.toLowerCase()] || 32000;
      const depreciationRate = 0.15; // 15% per year, diminishing
      let value = basePrice;
      for (let i = 0; i < age; i++) {
        value *= (1 - depreciationRate * Math.pow(0.85, i));
      }
      
      // Mileage adjustment
      const expectedMileage = age * 12000;
      const mileageDiff = vehicle.mileage - expectedMileage;
      value -= mileageDiff * 0.08;
      
      value = Math.max(3000, Math.round(value));
      
      result = {
        estimatedValue: value,
        confidence: "low",
        priceRange: { low: Math.round(value * 0.85), high: Math.round(value * 1.15) },
        reasoning: "Fallback estimate based on depreciation curves. AI parsing failed."
      };
    }

    console.log("Final estimate:", JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error estimating market value:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
