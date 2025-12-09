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

// Rate limit: 10 requests per minute per IP (more restrictive for OCR)
const RATE_LIMIT_CONFIG = {
  maxRequests: 10,
  windowMs: 60 * 1000,
  keyPrefix: "extract-quote",
};

const extractionPrompt = `You are a car deal quote extraction assistant. Analyze this dealer quote image/document and extract ALL the following information. Return ONLY a JSON object with these exact keys (use null for any field you can't find):

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
  "monthlyPayment": "monthly payment if shown as number string"
}

Important:
- Extract numbers WITHOUT currency symbols or commas (e.g., "32500" not "$32,500")
- If a field is not visible or unclear, use null
- Look for common fee names: doc fee, dealer fee, admin fee, acquisition fee, etc.
- The APR should be just the number (e.g., "6.5" not "6.5%")
- Be thorough - dealer quotes often hide fees in fine print

Return ONLY the JSON object, no explanation.`;

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

    const { imageBase64, mimeType } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!imageBase64) {
      throw new Error("No image data provided");
    }

    // Basic validation of image data
    if (typeof imageBase64 !== "string" || imageBase64.length > 10 * 1024 * 1024) {
      throw new Error("Invalid or oversized image data");
    }

    console.log("Processing quote extraction, mime type:", mimeType);

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
            role: "user",
            content: [
              { type: "text", text: extractionPrompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                },
              },
            ],
          },
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
        error: "Could not parse quote data. Please try a clearer image.",
        raw: content 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Extracted data:", extractedData);

    return new Response(JSON.stringify({ data: extractedData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Quote extraction error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
