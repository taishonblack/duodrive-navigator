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
  keyPrefix: "extract-deal-text",
};

const extractionPrompt = `You are DuoDrive's deal extraction AI. The user will paste messy text from a dealer offer, quote, listing, or notes. Your job is to extract ALL deal information into a structured format.

Accept ANY format: bullet points, paragraphs, copy-pasted emails, messy handwritten notes, dealer worksheets, etc.

Extract the following fields. Return ONLY a JSON object with these exact keys (use null for any field you can't find):

{
  "year": "vehicle year as string",
  "make": "vehicle make/brand",
  "model": "vehicle model",
  "trim": "trim level if shown",
  "mileage": "mileage as number string without commas",
  "vin": "VIN number if visible",
  "askingPrice": "total asking/sale price as number string without $ or commas",
  "negotiatedPrice": "negotiated price if different from asking",
  "downPayment": "down payment amount as number string",
  "tradeIn": "trade-in value as number string",
  "apr": "APR/interest rate as number string (just the number, no %)",
  "term": "loan term in months as string",
  "docFee": "documentation fee as number string",
  "dealerFee": "dealer fee/admin fee as number string",
  "addOns": "total add-ons/accessories as number string",
  "taxes": "estimated taxes as number string",
  "registration": "registration/title fees as number string",
  "monthlyPayment": "monthly payment if shown as number string",
  "monthlyIncome": "buyer's monthly income if mentioned",
  "creditScore": "credit score or range if mentioned (return as: excellent, good, fair, or poor)"
}

Common patterns to recognize:
- "OTD" or "out the door" = total price including all fees
- "TTL" = taxes, title, license fees
- "Down" = down payment
- "Monthly" or "per month" = monthly payment
- "APR" or "rate" = interest rate
- Various fee names: doc fee, dealer fee, admin fee, acquisition fee, destination, etc.

Important:
- Extract numbers WITHOUT currency symbols or commas (e.g., "32500" not "$32,500")
- If a field is not visible or unclear, use null
- The APR should be just the number (e.g., "6.5" not "6.5%")
- Be thorough - look for ALL numbers that could be relevant
- If they mention a price range, use the higher number as askingPrice

Return ONLY the JSON object, no explanation or additional text.`;

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

    const { text } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!text || typeof text !== "string") {
      throw new Error("No text provided");
    }

    // Limit text length
    const trimmedText = text.slice(0, 5000);

    console.log("Processing text extraction, length:", trimmedText.length);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: extractionPrompt },
          { role: "user", content: `Extract deal information from this text:\n\n${trimmedText}` },
        ],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI service error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    console.log("Raw AI response:", content);

    // Parse the JSON from the response
    let extractedData;
    try {
      // Try to find JSON in the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      return new Response(JSON.stringify({ 
        error: "Could not parse the deal information. Please try rephrasing.",
        raw: content 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Count how many fields were extracted
    const extractedCount = Object.values(extractedData).filter(v => v !== null && v !== undefined && v !== "").length;
    console.log("Extracted data:", extractedData, "fields:", extractedCount);

    return new Response(JSON.stringify({ 
      data: extractedData,
      extractedCount,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Text extraction error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
