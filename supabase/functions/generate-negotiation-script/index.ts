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
  keyPrefix: "negotiation-script",
};

interface DealData {
  year?: string;
  make?: string;
  model?: string;
  trim?: string;
  askingPrice?: string;
  negotiatedPrice?: string;
  apr?: string;
  term?: string;
  docFee?: string;
  dealerFee?: string;
  addOns?: string;
  monthlyIncome?: string;
}

interface ScoreResult {
  overall?: number;
  trueMarketPrice?: number;
  dealPriceGap?: number;
  dealPriceGapPercent?: number;
  monthlyPayment?: number;
  recommendation?: string;
}

interface RequestBody {
  scriptType: "counter" | "fees" | "buyrate" | "walkaway";
  dealData: DealData;
  scoreResult?: ScoreResult | null;
}

const getScriptPrompt = (
  scriptType: string,
  dealData: DealData,
  scoreResult: ScoreResult | null | undefined
) => {
  const vehicle = [dealData.year, dealData.make, dealData.model, dealData.trim]
    .filter(Boolean)
    .join(" ");
  
  const askingPrice = dealData.askingPrice ? parseInt(dealData.askingPrice.replace(/[^0-9]/g, '')) : 0;
  const marketPrice = scoreResult?.trueMarketPrice || askingPrice;
  const priceGap = scoreResult?.dealPriceGap || 0;
  const priceGapPercent = scoreResult?.dealPriceGapPercent || 0;
  
  const docFee = dealData.docFee ? parseInt(dealData.docFee.replace(/[^0-9]/g, '')) : 0;
  const dealerFee = dealData.dealerFee ? parseInt(dealData.dealerFee.replace(/[^0-9]/g, '')) : 0;
  const addOns = dealData.addOns ? parseInt(dealData.addOns.replace(/[^0-9]/g, '')) : 0;
  const totalFees = docFee + dealerFee + addOns;
  
  const apr = dealData.apr ? parseFloat(dealData.apr) : 0;

  const baseContext = `
Vehicle: ${vehicle || "Unknown vehicle"}
Asking Price: $${askingPrice.toLocaleString()}
${scoreResult?.trueMarketPrice ? `Estimated Market Value: $${marketPrice.toLocaleString()}` : ''}
${priceGap !== 0 ? `Price Gap: ${priceGap >= 0 ? '+' : ''}$${priceGap.toLocaleString()} (${priceGapPercent}% ${priceGapPercent > 0 ? 'over' : 'under'} market)` : ''}
${docFee ? `Doc Fee: $${docFee}` : ''}
${dealerFee ? `Dealer Fee: $${dealerFee}` : ''}
${addOns ? `Add-Ons: $${addOns}` : ''}
${apr ? `Quoted APR: ${apr}%` : ''}
`;

  const prompts: Record<string, string> = {
    counter: `Generate a confident but polite counter-offer script for this car deal:
${baseContext}

The script should:
1. Reference the specific vehicle and numbers
2. Propose a fair counter-offer price (aim for market value or 3-5% below asking)
3. Be firm but leave room for negotiation
4. Sound natural and confident, not aggressive
5. Be 2-4 sentences max

Also provide 3 short tips for delivering this counter-offer effectively.`,

    fees: `Generate a script to challenge and remove unnecessary fees from this car deal:
${baseContext}

Total fees to address: $${totalFees.toLocaleString()}

The script should:
1. Politely but firmly question the fees
2. ${docFee > 500 ? 'Challenge the high doc fee' : docFee > 0 ? 'Accept reasonable doc fee but question others' : ''}
3. ${dealerFee ? 'Ask for the dealer fee to be removed or reduced' : ''}
4. ${addOns ? 'Decline the add-ons you didn\'t ask for' : ''}
5. Be professional and specific about which fees are unacceptable
6. Be 2-4 sentences max

Also provide 3 short tips for negotiating fees effectively.`,

    buyrate: `Generate a script to ask for the dealer's "buy rate" on financing for this deal:
${baseContext}

The script should:
1. Ask what buy rate they received from the lender
2. Explain you understand dealers can mark up rates
3. Request they match or come closer to the buy rate
4. Be 2-4 sentences max

Also provide 3 short tips about dealer financing and buy rates.`,

    walkaway: `Generate a polite but firm walk-away script for this car deal:
${baseContext}

The script should:
1. Thank them for their time
2. Explain the numbers don't work for you
3. Leave the door open for them to call if things change
4. Be confident and not apologetic
5. Be 2-3 sentences max

Also provide 3 short tips for walking away effectively (hint: they often call back).`,
  };

  return prompts[scriptType] || prompts.counter;
};

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

    const { scriptType, dealData, scoreResult }: RequestBody = await req.json();
    
    if (!scriptType || !dealData) {
      return new Response(
        JSON.stringify({ error: "Missing scriptType or dealData" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const prompt = getScriptPrompt(scriptType, dealData, scoreResult);

    console.log(`Generating ${scriptType} script for:`, dealData.year, dealData.make, dealData.model);

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
            content: `You are an expert car negotiation coach. Generate scripts that are:
- Natural and conversational (not robotic)
- Confident but polite
- Specific to the deal details provided
- Ready to use word-for-word

IMPORTANT: Respond ONLY with valid JSON in this exact format:
{
  "script": "The exact words to say to the dealer...",
  "tips": ["Tip 1", "Tip 2", "Tip 3"]
}

Do not include any markdown, code blocks, or extra text. Just the JSON object.`
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
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("Failed to generate script");
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
      // Fallback: try to extract script from text
      result = {
        script: content.substring(0, 500),
        tips: [
          "Stay calm and confident",
          "Be prepared to walk away",
          "Get everything in writing"
        ]
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error('Error generating script:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
