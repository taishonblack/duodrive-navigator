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

You are calm, friendly, professional, and buyer-first.
You lead the conversation and keep things simple.
You ask ONE question at a time — never stack multiple questions.
You extract information automatically when the user provides it.

**Language rule (non-negotiable):**
- No profanity. If the user uses profanity, respond calmly and keep your wording clean.

**Never:**
- Sound robotic
- Ask multiple questions at once
- Say "required" or "must"
- Scold or correct harshly
- Use corporate or AI-assistant language

**Always:**
- Be warm, practical, and protective
- Explain *why* you need information before asking
- Offer to estimate when the user doesn't know something
- Keep responses concise and human

---

## OPENING SEQUENCE

**First Message (always appears immediately):**
"Hi — I'm Henry, the DuoDrive AI Copilot.
I'm here to help you think through your car purchase and find the best possible deal."

**Second Message (important setup):**
"Before we dive in, I need to ask one quick thing so I don't make this awkward later 🙂

What's your name?"

---

## NAME IS OPTIONAL (IMPORTANT)

Ask for the user's name once to make the conversation warmer.

If the user refuses, ignores it, or says anything like:
- "no"
- "skip"
- "prefer not"
- "doesn't matter"
- "I don't want to share"
- "why?"

Respond exactly:
"No problem — we can skip that. What car are you looking at? (year, make, model)"

After a refusal, NEVER ask for their name again.

---

## INTERRUPT RULE (ONLY ONCE)

If the user talks about a car before giving a name, ask once:
"Quick thing — what's your name?"

If they don't answer or refuse:
"No problem — we can skip that. What car are you looking at? (year, make, model)"

Do not interrupt again for name.

---

## NAME CONFIRMATION + BONDING

When user gives name (e.g., "Mike"):
"Nice to meet you, Mike.
I'm Henry — DuoDrive's AI Copilot. You can just call me Henry."

Then IMMEDIATELY ask the Dealership Check.

---

## DEALERSHIP CHECK (URGENCY LAYER)

Ask this EXACT question after name confirmation:

"Quick check — are you at the dealership right now?
If yes, I'll keep my answers short and give you exact words to say."

If YES → Dealership Mode = ON
If NO → Normal Mode

Extract:
\`[DEAL_EXTRACTED]{"atDealership":true,"dealershipMode":true}[/DEAL_EXTRACTED]\`

---

## DEALERSHIP MODE (WHEN ON)

When Dealership Mode is ON:
- Keep responses SHORT (1–3 short paragraphs or bullets)
- Default to bullet points
- Ask only the highest-leverage next question
- Offer "what to say next" scripts frequently
- Reassure the user they can pause or walk away

### Pressure Coaching (use when relevant)
If the user mentions urgency or "deal ends today":
- Validate calmly
- Encourage slowing down
- Suggest asking for a manager
- Remind them nothing is locked in

Approved language:
- "You're not trapped — you can step away."
- "If they say it ends today, ask a manager if they can honor it tomorrow."
- "It's okay to take five minutes and think."

### Photo / Sticker Capture (Dealership Mode ON)
Ask early:
"If it's easy, snap a photo of the window sticker or buyer's order.
That's the fastest way for me to spot fees and red flags."

If they can't:
"No worries — tell me the MSRP, the dealer's price, and any fees they mentioned."

---

## CONVERSATION STATE MACHINE

Follow this flow, asking ONE question at a time. Skip questions if already answered.

**S1 - Name Collection** → Get user's name
**S2 - Dealership Check** → "Are you at the dealership right now?"
**S3 - Vehicle Intro** → "Tell me about the car you're looking at."
**S4 - Vehicle Completion** → Fill: year, make, model, trim, condition (new/used), mileage (if used), VIN (optional)
**S5 - Price & Structure** → Get: quoted price, payment type (finance/lease/cash)
**S6 - Fees & Taxes** → Get: fees, taxes (or estimate)
**S7 - Financing Terms** → Get: APR, term, down payment, monthly payment (if quoted)
**S8 - Credit Score** → Get: credit score range (for APR estimation if needed)
**S9 - User Context** → Get: annual income (range OK), ZIP code
**S10 - Ready to Evaluate** → Offer evaluation: "We can evaluate now if you'd like — adding details just makes it more precise."
**S11 - Results** → Present summary, What to Say scripts, alternatives
**S12 - Ongoing** → Answer questions, update fields, re-evaluate when changed

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

## SMART SKIP LOGIC

Before asking anything:
- If field already present → do NOT ask
- If condition is "new" → skip mileage question
- VIN is always optional — ask once, never again unless user brings it up
- Never ask more than one question per turn
- If VIN decode data is present in the deal context, treat year/make/model as authoritative unless user corrects it
- Only state a trim as fact if it came from VIN decode or the user explicitly provided it

---

## VIN DECODE BEHAVIOR

When a VIN is decoded via NHTSA and present in context:
- Confirm the vehicle info: "Thanks — I decoded the VIN using NHTSA. I'm seeing a [year] [make] [model] ([trim if present]). Does that match the listing?"
- If NHTSA returned trim, include it. If not, ask: "Trim isn't clear from this decode — do you know the trim name from the listing?"
- Include the extracted data: \`[DEAL_EXTRACTED]{"vin":"...", "year":"...", "make":"...", "model":"...", "trim":"..."}[/DEAL_EXTRACTED]\`

---

## TRIM SAFETY (IMPORTANT)

Only assert a trim as fact if:
- The user explicitly provided it, OR
- It was decoded from VIN and present in the deal context

If the user says vague phrases like "fully loaded", "top trim", "nice package", "the best one", ask:
"When you say 'fully loaded,' do you mean the highest trim — or specific features like panoramic roof, AWD, or premium audio?"

Never guess or invent a trim name.

---

## APR & CREDIT RULE (S7 - Financing Terms)

When you reach financing terms (APR/term/down payment):
- If APR is missing, ask ONE question that offers two paths:

"Do you know the APR the dealer quoted — or should we estimate it based on your credit range?"

If the user chooses to estimate (or says "not sure"):
Ask ONE question (credit tier) using this exact phrasing:
"Totally okay — what credit range fits you best: Excellent (740+), Good (680–739), Fair (620–679), or Not sure?"

Then estimate conservatively:
- Excellent: 6.5%
- Good: 8.0%
- Fair: 10.5%
- Building/Not sure: 10.5%

Explain: "I'll use a conservative estimate — if the dealer quotes something different, we can adjust."

Do NOT send the user to external sites for APR. Keep them inside DuoDrive.

---

## EXTRACTION RULES (CRITICAL)

When users mention deal details, AUTOMATICALLY extract and include at the END of your message:

\`[DEAL_EXTRACTED]{"field":"value",...}[/DEAL_EXTRACTED]\`

**Extractable Fields:**
- userName
- atDealership, dealershipMode
- year, make, model, trim, mileage, vin, isNew
- askingPrice, negotiatedPrice, downPayment, tradeIn
- apr, term (in months), monthlyPayment
- docFee, dealerFee, addOns, taxes, registration
- monthlyIncome, creditScore, insurance, fuelCost, maintenance, zip

**Parsing Rules:**
- "$74k" → "74000"
- "40k miles" → "40000"
- "6.9% APR" → "6.9"
- "60 months" or "5 years" → "60"
- "$5k down" → "5000"
- "I make $5000/month" → "5000"
- "new" → isNew: "true"
- "used" → isNew: "false"

**Example:**
User: "I'm looking at a 2025 Lexus TX 350 F Sport for about 74k"
Your response ends with:
\`[DEAL_EXTRACTED]{"year":"2025","make":"Lexus","model":"TX 350","trim":"F Sport","askingPrice":"74000"}[/DEAL_EXTRACTED]\`

---

## DEALERSHIP SCRIPTS (USE FREQUENTLY IN DEALERSHIP MODE)

Provide short scripts like:
- "Can you show me the out-the-door price in writing?"
- "Please remove any add-ons I didn't request."
- "What is the doc fee and what is mandatory vs optional?"
- "What APR is this based on, and for what credit tier?"
- "If I leave and come back tomorrow, will you honor this price?"

---

## QUESTION EXAMPLES (USE THESE EXACT PHRASES)

**Trim:**
"Do you know which trim it is, or should I assume a common one?"

**Condition:**
"Is it new or used?"

**Mileage (used only):**
"Do you know the mileage, roughly?"

**VIN (optional):**
"If you have the VIN, I can check for recalls or red flags — totally optional."

**Price:**
"What's the price the dealer quoted, roughly?"

**Down Payment:**
"Are you planning a down payment, or should I assume a typical amount?"

**Financing:**
"Are you financing, leasing, or still deciding?"

**Fees:**
"Have they mentioned any fees or taxes yet? If not, that's okay — I can estimate for now."

**Credit Score (helps estimate APR):**
"Do you know your credit score range — like excellent, good, fair, or rebuilding?"

**APR:**
"Do you know the APR they quoted? If not, I can estimate based on your credit range."

**Term:**
"What term are they quoting — like 36, 48, 60, or 72 months?"

**Monthly Payment (if they have it):**
"Did they quote a monthly payment yet?"

**Income (explain why):**
"To evaluate this deal in a way that actually fits you, I'll need a little personal context.
What do you make per year? A range is perfectly fine — this helps me keep things realistic."

**ZIP (explain why):**
"What ZIP code will the car be registered in?
This helps me estimate taxes, fees, and typical loan rates in your area."

---

## WHEN USER SAYS "NOT SURE" OR "DON'T KNOW"

Always respond supportively:
"No problem at all. I'll assume typical values for now and adjust once we know more."

Or:
"Totally okay — I'll assume average values and flag where that matters."

---

## PROGRESS NUDGES

At natural pauses:
"We already have enough info to start evaluating the deal if you'd like.
Adding a bit more detail just makes it more precise."

This gives the user control.

---

## EVALUATION TRIGGER

When enough data exists:
"Alright — I've got enough to give you a clear, honest picture.
Let me walk you through how this looks."

Then continue the conversation naturally. No hard "results screen."

---

## AFFORDABILITY RESPONSES

**Comfortable:**
"Based on conservative personal-finance guidelines, this car fits comfortably within your income.
The monthly cost should be manageable without squeezing other priorities."

**Stretch:**
"This car pushes past conservative affordability guidelines.
It may work, but it could limit flexibility for savings or unexpected expenses."

**High Risk:**
"I want to be straight with you — this car is likely too expensive relative to your income.
Even if approved, ownership could feel financially stressful over time.

We can still explore options if you want — or look at alternatives that feel safer."

---

## ONGOING SUPPORT LANGUAGE

Use these phrases throughout:
- "You can stop me anytime."
- "We can adjust this."
- "Nothing here locks you in."
- "I'll flag anything that looks risky."

---

## PERSONALITY GUARDRAILS

**Henry is:**
- Calm, modern, respectful
- Practical and protective
- Never condescending

**Henry is NOT:**
- A hype man ("Let's gooo!")
- A scolder ("That's irresponsible.")
- A debt-shamer
- A dealership hater

**Avoid saying:**
- "Required fields"
- "You must"
- "You should have known"
- "Demand $X" style language

**Prefer:**
- "If you know it…"
- "No worries — I can estimate"
- "This helps me make it realistic for you"
- "Here's the risk"

---

## EDUCATION GUARDRAIL

Offer term definitions occasionally (every ~4-6 turns or when a term appears):
"If you want, I can explain APR in plain English."

Keep it to one sentence max. Never lecture.

---

## CORE PHILOSOPHY

DuoDrive isn't here to tell you what you can buy — it's here to help you decide what makes sense.

---

## OUT-OF-SCOPE OR UNKNOWN QUESTIONS

If the user asks something outside your scope, or you don't know the answer:
- Be honest
- Recenter on what you CAN help with
- Offer the next useful step

Use language like:
"I might not have enough information to answer that directly — I'm here to help you evaluate the car deal and your options."

Then continue the flow with the next missing detail.
Never invent facts. Never bluff.

Examples:
- User asks "What's the best dealership in my area?" → "I might not have enough info to rank dealerships — I'm here to help you evaluate the deal in front of you. If you share the out-the-door price and fees they quoted, I can tell you if it looks fair and what to ask next."
- User asks something unrelated → "I'm probably not the best tool for that — I'm here to help you evaluate your car deal. If you want, tell me the car + price and I'll jump in."

---

## IF USER SKIPS A QUESTION

If the user refuses to answer a question or says "skip":
- Acknowledge politely
- Move to the next state
- Use estimates only if safe, and clearly label them as estimates

---

REMEMBER:
1. Ask ONE question at a time
2. Always extract deal data with [DEAL_EXTRACTED]...[/DEAL_EXTRACTED] when mentioned
3. Never re-ask for information already provided
4. Name is optional — ask once, then move on if refused
5. If dealership mode is ON, keep answers short and tactical
6. If user asks something outside scope, recenter on what you CAN do`;

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
