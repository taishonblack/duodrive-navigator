import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { 
  checkRateLimit, 
  getClientIP, 
  rateLimitExceededResponse 
} from "../_shared/rate-limit.ts";
import { getCorsWithSecurityHeaders } from "../_shared/security-headers.ts";

const corsHeaders = getCorsWithSecurityHeaders();

// Rate limit: 30 requests per minute per IP
const RATE_LIMIT_CONFIG = {
  maxRequests: 30,
  windowMs: 60 * 1000,
  keyPrefix: "ai-copilot",
};

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ScoreResult {
  overall: number;
  pillars: Record<string, { score: number; details: string }>;
  recommendation: string;
  monthlyPayment: number;
  totalCost: number;
  loanAmount?: number;
  totalInterest?: number;
  interestRatio?: number;
  trueMarketPrice?: number;
  dealPriceGap?: number;
  dealPriceGapPercent?: number;
  customerMaxSafePrice?: number;
  customerFitGap?: number;
  customerFitGapPercent?: number;
  paymentBurdenPercent?: number;
  operatingCostBurden?: number;
  totalMonthlyCost?: number;
}

interface RequestBody {
  messages: Message[];
  dealContext?: {
    year?: string;
    make?: string;
    model?: string;
    trim?: string;
    mileage?: string;
    vin?: string;
    vinDecoded?: boolean;
    vinSource?: 'user' | 'ocr' | 'pdf_text';
    askingPrice?: string;
    negotiatedPrice?: string;
    downPayment?: string;
    tradeIn?: string;
    apr?: string;
    aprSource?: 'dealer' | 'estimated';
    term?: string;
    monthlyIncome?: string;
    creditScore?: string;
    insurance?: string;
    fuelCost?: string;
    maintenance?: string;
    scoreResult?: ScoreResult;
    // Dealership mode fields
    deviceHint?: 'mobile' | 'desktop';
    atDealership?: boolean;
    dealershipMode?: boolean;
  };
}

// VIN utilities
function normalizeVin(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function isValidVin(vin: string): boolean {
  if (!vin) return false;
  if (vin.length !== 17) return false;
  if (/[IOQ]/.test(vin)) return false;
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin);
}

function extractVin(text: string): string | null {
  if (!text) return null;

  const candidates = text
    .toUpperCase()
    .replace(/[^A-Z0-9:\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  for (const token of candidates) {
    const t = token.replace(/^VIN:$/, "").trim();
    const maybe = normalizeVin(t);
    if (maybe.length === 17 && isValidVin(maybe)) return maybe;
  }

  const match = text.toUpperCase().match(/[A-HJ-NPR-Z0-9]{17}/g);
  if (match) {
    for (const m of match) {
      const vin = normalizeVin(m);
      if (isValidVin(vin)) return vin;
    }
  }

  return null;
}

type NhtsaDecodeResult = Record<string, string>;

async function decodeVinWithNhtsa(vin: string): Promise<NhtsaDecodeResult | null> {
  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${vin}?format=json`;
  
  try {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) return null;

    const json = await res.json();
    const row = json?.Results?.[0];
    if (!row) return null;

    return row as NhtsaDecodeResult;
  } catch (e) {
    console.error("NHTSA decode error:", e);
    return null;
  }
}

function applyVinDecodeToDealContext(
  dealContext: RequestBody["dealContext"] | undefined,
  vin: string,
  decoded: NhtsaDecodeResult
): RequestBody["dealContext"] {
  const next = { ...(dealContext || {}) };

  next.vin = next.vin || vin;
  next.vinDecoded = true;
  next.year = next.year || decoded.ModelYear || undefined;
  next.make = next.make || decoded.Make || undefined;
  next.model = next.model || decoded.Model || undefined;

  // Only set trim if NHTSA provided something non-empty AND user hasn't provided trim
  const decodedTrim = (decoded.Trim || decoded.Trim2 || "").trim();
  if (!next.trim && decodedTrim) next.trim = decodedTrim;

  return next;
}

// Message de-duplication to prevent repeated dialogue
function dedupeMessages(messages: Message[]): Message[] {
  return messages.filter((m, idx, arr) => {
    if (idx === 0) return true;
    const prev = arr[idx - 1];
    return !(prev.role === m.role && prev.content.trim() === m.content.trim());
  });
}

const systemPrompt = `You are Henry, DuoDrive's AI Copilot. You help car buyers make realistic, buyer-first decisions about a car purchase.

---

## IDENTITY & TONE (NON-NEGOTIABLE)

- Calm, friendly, practical, buyer-first.
- Ask ONE question at a time (never stack questions).
- Keep answers concise. Use bullets when helpful.
- No profanity or crude language (even if the user uses it).
- Never shame the user. Never pressure them.
- If you don't know or it's outside scope, say:
  "I might not have enough info to answer that directly — I'm here to help you evaluate the deal and what to ask the dealer. If you share the numbers you have, I can guide you."

---

## DEVICE CONTEXT

You may receive device hints via deal context:
- deviceHint: "mobile" | "desktop"
- atDealership: true | false
If deviceHint is missing, proceed normally.

---

## OPENING

First message:
"Hi — I'm Henry, the DuoDrive AI Copilot. I'm here to help you think through your car purchase and find the best possible deal."

Second message:
"Before we dive in, what should I call you? (Totally optional.)"

---

## NAME IS OPTIONAL (CRITICAL)

Ask once only.
If the user skips, refuses, or ignores:
Respond exactly:
"No problem — we can skip that."
Then continue immediately. Never ask their name again.

---

## MOBILE DEALERSHIP CHECK (ASK ONCE)

If deviceHint === "mobile" AND atDealership is unknown/not set:
Ask once, after the name step:
"Quick check — are you at the dealership right now?"

If YES:
- Set atDealership = true via extraction
- Enter Dealership Mode

If NO:
- Set atDealership = false
- Continue normal flow

On desktop:
- Do NOT force this question.
- If the user mentions being at a dealer, set atDealership = true.

---

## DEALERSHIP MODE (WHEN atDealership = true OR dealershipMode = true)

Goal: fast, tactical, low-pressure help.

Rules:
- Short responses (1–3 paragraphs max, prefer bullets).
- After guidance, ask ONE next best question.
- Regular reminders:
  - "You can always negotiate."
  - "You're never trapped — you can pause or walk away."
- State clearly:
  "Dealers often have markup room — price, fees, and add-ons are negotiable."
- If the dealer says "this ends today":
  "Ask for the offer in writing and request a 24-hour extension. If needed, ask to speak with a manager. Trust your instincts."

Term help in Dealership Mode:
- When terms like APR, fees, residual, money factor appear (or every ~3–4 turns), add:
  "If any term is confusing (APR, fees, money factor), tell me and I'll define it fast."

Photo capture reminder (in Dealership Mode):
Ask early:
"If it's easy, snap a photo of the window sticker or buyer's order. That's the fastest way for me to spot fees and red flags."

---

## ALWAYS-ON TERM HELP (ALL MODES)

Periodically (every ~4–6 turns or when new terms appear), add one line:
"Any term confusing — like APR, doc fee, or residual? Ask and I'll explain it in plain English."

---

## VOICE / MIC MODE

If the user speaks or mentions using the mic:
- Acknowledge:
  "I'm listening — say the numbers you see (price, APR, term, fees)."
- Disclose once:
  "Your voice is transcribed and sent to me so I can help."
- In a public dealership context:
  "Share only what you're comfortable with."

---

## IMAGE UPLOAD & OCR HANDLING (CRITICAL)

If the user uploads an image or provides OCR text wrapped in:
[IMAGE_TEXT] ... [/IMAGE_TEXT]

You MUST:
1) Confirm: "Got it — I pulled key details from the photo."
2) Summarize findings (2–6 short bullets).
3) Extract fields using [DEAL_EXTRACTED]{...}[/DEAL_EXTRACTED]
4) Ask exactly ONE next best question.

If OCR text is missing, unreadable, or says OCR_FAILED:
Say:
"I couldn't read the photo clearly."
Then ask ONE question:
"Is this the window sticker or the buyer's order — and what selling price or out-the-door total are they offering?"

Default follow-up after a window sticker:
"Is that the selling price before taxes and fees, or do you have the out-the-door total?"

Never end a message with "I'm reading the image now" or similar placeholders.

---

## CORE CONVERSATION FLOW (ONE QUESTION AT A TIME)

Skip any step if already answered.

S1 Optional name  
S2 (Mobile only) Are you at the dealership?  
S3 Vehicle intro: "Tell me about the car you're looking at."  
S4 Vehicle completion: year, make, model, trim, condition, mileage (used only), VIN optional  
S5 Price & structure: selling price or out-the-door, finance vs lease vs cash  
S6 Personal Financial Context (PRIORITY): monthly income, credit score range, estimated insurance
S7 Financing: APR (or estimate from credit), term, down payment, monthly payment if quoted  
S8 Fees & taxes: doc fee, dealer fee, add-ons, taxes/registration (or estimate)  
S9 ZIP code for accurate tax/fee estimation
S10 Evaluation + negotiation scripts + alternatives  
S11 Ongoing updates

---

## DEALERSHIP MODE QUESTION ORDER (OVERRIDES NORMAL FLOW)

When Dealership Mode is ON, follow this order (ask ONE question at a time; skip if already answered):

D1: "What car is it? (year, make, model — trim if you know it)"
D2: "Is it new or used?"
D3: "What's the dealer's selling price right now?"
D4: "Any fees or add-ons mentioned?"
D5: "Are you financing, leasing, or cash?"
D6: "What APR and term did they quote?"
D7: "Any down payment or trade-in?"
D8: "What ZIP will it be registered in?"

---

## EXTRACTION RULES (CRITICAL)

When users mention deal details, AUTOMATICALLY extract and include at the END of your message:

\`[DEAL_EXTRACTED]{"field":"value",...}[/DEAL_EXTRACTED]\`

**Extractable Fields:**
- userName
- atDealership (boolean), dealershipMode (boolean)
- year, make, model, trim, mileage, vin, isNew
- askingPrice, negotiatedPrice, outTheDoorPrice, downPayment, tradeIn
- apr, term (in months), monthlyPayment
- docFee, dealerFee, addOns, taxes, registration
- monthlyIncome, annualIncome, creditScore, insurance, fuelCost, maintenance, zipCode

**Parsing Rules:**
- "$74k" → "74000"
- "40k miles" → "40000"
- "6.9% APR" → "6.9"
- "60 months" or "5 years" → "60"
- "$5k down" → "5000"
- "I make $5000/month" → "5000"
- "new" → isNew: "true"
- "used" → isNew: "false"
- "yes I'm at the dealer" → atDealership: true
- "no not at the dealer" → atDealership: false

---

## DIRECTING USERS TO SEE THE ANALYSIS (IMPORTANT)

After providing advice, guidance, or wrapping up a conversation, ALWAYS direct the user to explore the analysis tabs:

**Standard guidance:**
- "Check out the **Calculator** tab to see the full cost breakdown — monthly payment, insurance, fuel, everything."
- "Head over to the **Overview** tab to see how this deal stacks up against market pricing and your budget."

**When user is ready to negotiate:**
"Before you head back in, check the **What To Say** tab — I've got scripts ready based on your specific deal."

**When wrapping up:**
"Good luck! The **Overview** tab has the full analysis, and **What To Say** has your negotiation scripts. I'm here anytime."

**NEVER end a substantive conversation without pointing to at least one tab.**

---

## APR & CREDIT ESTIMATION

When APR is missing, ask:
"Do you know the APR the dealer quoted — or should we estimate it based on your credit range?"

If user says "not sure", ask:
"What credit range fits you best: Excellent (740+), Good (680–739), Fair (620–679), or Not sure?"

Then estimate:
- Excellent: 6.5%
- Good: 8.0%
- Fair: 10.5%
- Building/Not sure: 10.5%

Say: "I'll use a conservative estimate — if the dealer quotes something different, we can adjust."

---

## INSURANCE ESTIMATION

When user doesn't know insurance cost, offer to estimate:
"I can estimate based on the vehicle type and your credit — usually that gives us a pretty close ballpark."

Provide a range like "$150–$200/mo for a vehicle like this with your credit."

---

## AFFORDABILITY RESPONSES

**Comfortable:**
"Based on conservative personal-finance guidelines, this car fits comfortably within your income."

**Stretch:**
"This car pushes past conservative affordability guidelines. It may work, but could limit flexibility."

**High Risk:**
"I want to be straight with you — this car is likely too expensive relative to your income. Even if approved, ownership could feel financially stressful. We can still explore options or look at alternatives."

---

## PERSONALITY GUARDRAILS

Henry IS: Calm, modern, respectful, practical, protective.
Henry is NOT: A hype man, scolder, debt-shamer, or dealership hater.

**Avoid:** "Required fields", "You must", "You should have known"
**Prefer:** "If you know it…", "No worries — I can estimate", "Here's the risk"

---

## OUT-OF-SCOPE QUESTIONS

If asked something outside scope:
"I might not have enough information to answer that directly — I'm here to help you evaluate the car deal and your options."
Then continue the flow.

Never invent facts. Never bluff.

---

## CHECK-IN PROMPT

After explaining or filling part of the deal, occasionally ask:
"Want me to explain or break down anything — like APR, fees, or how leasing works?"

---

REMEMBER:
1. Ask ONE question per turn
2. Always extract deal data with [DEAL_EXTRACTED]...[/DEAL_EXTRACTED] when mentioned
3. Never re-ask for information already provided
4. Name is optional — ask once, then move on
5. If atDealership or dealershipMode is true, keep answers short and tactical
6. Offer term definitions periodically
7. Always direct users to relevant tabs after substantive advice`;


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

    const { messages, dealContext }: RequestBody = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // De-duplicate messages to prevent repeated dialogue
    const dedupedMessages = dedupeMessages(messages);

    // Extract VIN from last user message and decode if present
    const lastUserMessage = [...dedupedMessages].reverse().find(m => m.role === "user")?.content || "";
    let mergedDealContext = dealContext;

    const existingVin = dealContext?.vin;
    const vinFromText = extractVin(lastUserMessage);
    const vin = existingVin || vinFromText;

    if (vin && isValidVin(vin) && !dealContext?.vinDecoded) {
      try {
        const decoded = await decodeVinWithNhtsa(vin);
        if (decoded) {
          mergedDealContext = applyVinDecodeToDealContext(mergedDealContext, vin, decoded);
          console.log("VIN decoded via NHTSA:", vin, decoded.Make, decoded.Model, decoded.ModelYear);
        }
      } catch (e) {
        console.log("VIN decode failed:", e);
      }
    }

    // Build context-aware system message
    let contextMessage = systemPrompt;
    
    if (mergedDealContext) {
      contextMessage += "\n\n--- USER'S CURRENT DEAL CONTEXT ---\n";
      
      // Device and dealership context
      if (mergedDealContext.deviceHint) {
        contextMessage += `Device: ${mergedDealContext.deviceHint}\n`;
      }
      if (mergedDealContext.atDealership !== undefined) {
        contextMessage += `At Dealership: ${mergedDealContext.atDealership ? 'YES - Use Dealership Mode (short, tactical responses)' : 'No'}\n`;
      }
      if (mergedDealContext.dealershipMode) {
        contextMessage += `Dealership Mode: ACTIVE - Keep responses short and tactical\n`;
      }
      
      // VIN info
      if (mergedDealContext.vin) {
        contextMessage += `VIN: ${mergedDealContext.vin}${mergedDealContext.vinDecoded ? ' (NHTSA decoded)' : ''}\n`;
      }
      
      // Vehicle info
      if (mergedDealContext.year && mergedDealContext.make) {
        contextMessage += `Vehicle: ${mergedDealContext.year} ${mergedDealContext.make} ${mergedDealContext.model || ''} ${mergedDealContext.trim || ''}\n`;
      }
      if (mergedDealContext.mileage) {
        contextMessage += `Mileage: ${mergedDealContext.mileage} miles\n`;
      }
      
      // Pricing
      if (mergedDealContext.askingPrice) {
        contextMessage += `Dealer Asking Price: $${mergedDealContext.askingPrice}\n`;
      }
      if (mergedDealContext.negotiatedPrice) {
        contextMessage += `Negotiated Price: $${mergedDealContext.negotiatedPrice}\n`;
      }
      if (mergedDealContext.downPayment) {
        contextMessage += `Down Payment: $${mergedDealContext.downPayment}\n`;
      }
      if (mergedDealContext.tradeIn) {
        contextMessage += `Trade-In Value: $${mergedDealContext.tradeIn}\n`;
      }
      
      // Financing
      if (mergedDealContext.apr) {
        contextMessage += `APR: ${mergedDealContext.apr}%${mergedDealContext.aprSource === 'estimated' ? ' (estimated)' : ''}\n`;
      }
      if (mergedDealContext.term) {
        contextMessage += `Loan Term: ${mergedDealContext.term} months\n`;
      }
      if (mergedDealContext.creditScore) {
        contextMessage += `Credit Score Range: ${mergedDealContext.creditScore}\n`;
      }
      
      // Buyer finances
      if (mergedDealContext.monthlyIncome) {
        contextMessage += `Monthly Take-Home Income: $${mergedDealContext.monthlyIncome}\n`;
      }
      if (mergedDealContext.insurance) {
        contextMessage += `Monthly Insurance: $${mergedDealContext.insurance}\n`;
      }
      if (mergedDealContext.fuelCost) {
        contextMessage += `Monthly Fuel Cost: $${mergedDealContext.fuelCost}\n`;
      }
      if (mergedDealContext.maintenance) {
        contextMessage += `Monthly Maintenance: $${mergedDealContext.maintenance}\n`;
      }
      
      // V3 Score Results
      if (mergedDealContext.scoreResult) {
        const sr = mergedDealContext.scoreResult;
        contextMessage += `\n--- DUODRIVE V3 SCORE RESULTS ---\n`;
        contextMessage += `Overall DuoDrive Score: ${sr.overall}/100\n`;
        
        // V3 Metrics
        if (sr.trueMarketPrice) {
          contextMessage += `\nTRUE MARKET PRICE (TMP): $${sr.trueMarketPrice.toLocaleString()}\n`;
        }
        if (sr.dealPriceGap !== undefined) {
          contextMessage += `DEAL PRICE GAP (DPG): ${sr.dealPriceGap >= 0 ? '+' : ''}$${sr.dealPriceGap.toLocaleString()} (${sr.dealPriceGapPercent}% ${sr.dealPriceGapPercent! > 0 ? 'over' : 'under'} market)\n`;
        }
        if (sr.customerMaxSafePrice) {
          contextMessage += `CUSTOMER MAX SAFE PRICE (CMSP): $${sr.customerMaxSafePrice.toLocaleString()}\n`;
        }
        if (sr.customerFitGap !== undefined) {
          contextMessage += `CUSTOMER FIT GAP (CFG): ${sr.customerFitGap >= 0 ? '+' : ''}$${sr.customerFitGap.toLocaleString()} (${sr.customerFitGapPercent}% ${sr.customerFitGapPercent! > 0 ? 'above' : 'below'} safe budget)\n`;
        }
        
        // Payment details
        contextMessage += `\nMonthly Payment: $${sr.monthlyPayment.toLocaleString()}\n`;
        if (sr.loanAmount) {
          contextMessage += `Loan Amount: $${sr.loanAmount.toLocaleString()}\n`;
        }
        if (sr.totalInterest) {
          contextMessage += `Total Interest: $${sr.totalInterest.toLocaleString()}\n`;
        }
        contextMessage += `Total Cost: $${sr.totalCost.toLocaleString()}\n`;
        
        // Burden analysis
        if (sr.paymentBurdenPercent) {
          contextMessage += `\nPayment Burden: ${sr.paymentBurdenPercent}% of income\n`;
        }
        if (sr.operatingCostBurden) {
          contextMessage += `Total Operating Cost Burden: ${sr.operatingCostBurden}% of income\n`;
        }
        if (sr.totalMonthlyCost) {
          contextMessage += `Total Monthly Car Cost: $${sr.totalMonthlyCost.toLocaleString()}\n`;
        }
        
        // Pillar scores
        contextMessage += `\n--- PILLAR SCORES ---\n`;
        for (const [pillar, data] of Object.entries(sr.pillars)) {
          const pillarName = pillar.replace(/([A-Z])/g, ' $1').trim();
          contextMessage += `• ${pillarName}: ${data.score}/100 - ${data.details}\n`;
        }
        
        contextMessage += `\nAI Recommendation: ${sr.recommendation}\n`;
        
        // Add warnings for concerning scores
        if (sr.pillars.affordability?.score < 40) {
          contextMessage += `\n⚠️ CRITICAL WARNING: Affordability score is very low (${sr.pillars.affordability.score}). This buyer may be at risk of financial strain.\n`;
        }
        if (sr.customerFitGapPercent && sr.customerFitGapPercent > 25) {
          contextMessage += `⚠️ WARNING: This car is ${sr.customerFitGapPercent}% above the buyer's safe budget.\n`;
        }
        if (sr.dealPriceGapPercent && sr.dealPriceGapPercent > 15) {
          contextMessage += `⚠️ WARNING: Dealer price is ${sr.dealPriceGapPercent}% above market value.\n`;
        }
      }
    }

    console.log("Starting AI chat with V3 context:", mergedDealContext?.scoreResult ? "full score" : mergedDealContext ? "partial" : "none");

    // Guard: If last user message was an image upload, force follow-up behavior
    const lastUserContent = lastUserMessage.toLowerCase();
    const isImageUpload = lastUserContent.includes("uploaded image") || 
                          lastUserContent.includes("window_sticker") || 
                          lastUserContent.includes("buyers_order") ||
                          lastUserContent.includes("[image_text]");
    
    if (isImageUpload) {
      contextMessage += `\n\n--- CRITICAL INSTRUCTION ---
The last user action was an image upload.
You MUST respond with:
1) A summary of what you can see (or acknowledge you can't read the content)
2) ONE next-step question (fees/OTD/selling price)
Do NOT end on "I'm reading it now" or any placeholder. Always ask a question.
--- END CRITICAL INSTRUCTION ---\n`;
      console.log("Image upload detected - adding guard instruction");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: contextMessage },
          ...dedupedMessages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("AI Copilot error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
