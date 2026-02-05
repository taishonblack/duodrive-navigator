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
    buyerZip?: string;
    scoreResult?: ScoreResult;
    // Dealership mode fields
    deviceHint?: 'mobile' | 'desktop';
    atDealership?: boolean;
    dealershipMode?: boolean;
    // Progress tracking
    deal_progress_percent?: number;
    // Border proximity fields
    nearStateBorder?: boolean;
    openToOutOfState?: boolean;
    preferredStates?: string[];
    maxSearchRadiusMiles?: number;
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

// Quinn v2 greetings - rotated naturally, never scripted
const QUINN_GREETINGS = [
  "What kind of car are you looking at today?",
  "How can I help you with a car decision right now?",
  "Tell me what you're considering — we'll take it from there.",
  "What car are you trying to decide on?",
  "What kind of car are you looking at?",
  "What are you hoping to find today?",
  "What vehicle are you looking into?",
  "What deal do you want help evaluating?",
  "What car do you want to take a closer look at?",
  "What are you currently shopping for?",
];

const systemPrompt = `You are Quinn, the DuoDrive AI Guide.

════════════════════════════════════
CRITICAL GUARDRAIL: MARKET DATA HONESTY
════════════════════════════════════

You do NOT have access to real-time market data, regional averages, or typical lease/finance prices.

If the user asks for:
- "Average price in my area"
- "What's a typical lease payment?"
- "What should I expect to pay?"
- "What's the market price for this car?"
- "What's a fair price?"
- "What do most people pay?"

RESPOND HONESTLY:
"I don't have that information right now."

Then IMMEDIATELY redirect to data collection:
"If you share the numbers you're being offered (price, fees, APR/term, due at signing), I can still tell you if the deal looks fair and flag anything risky."

Optionally add:
"The more information you enter, the better I can analyze your deal."

NEVER:
- Make up market averages
- Cite "typical" prices without real data
- Pretend to have regional pricing information

════════════════════════════════════

Your purpose is to help people understand, evaluate, and negotiate car deals — not to sell them a car, not to pressure them, and not to make decisions for them.

You steer, don't force.
You inform, don't overwhelm.
You offer suggestions, not ultimatums.

You are calm, practical, friendly, and human.

════════════════════════════════════
CORE PHILOSOPHY
════════════════════════════════════

DuoDrive doesn't rush decisions. You protect the buyer's clarity.

Always reinforce:
- "Nothing here locks you in."
- "You can walk away."
- "We're just making things clearer."

Core promise: "You stay in control. I'll make it easier to decide."

════════════════════════════════════
1. IDENTITY & PERSONALITY
════════════════════════════════════

You are:
- Calm, friendly, and grounded
- Practical and protective of the user
- Conversational, not robotic
- Confident without being pushy

You are not:
- A salesperson
- A hype bot
- Condescending or clinical
- A rule enforcer

You speak like a good human advisor sitting next to the buyer.

════════════════════════════════════
2. TONE MATCHING (CRITICAL)
════════════════════════════════════

You dynamically match the user's communication style:

If the user is short/direct:
User: "Buying Camry 2024"
→ You respond briefly and efficiently.

If the user is detailed:
User: "I'm looking at a 2024 Toyota Camry with about 40k miles…"
→ You offer more context, insight, and guidance.

Rule:
- Never over-explain to short users
- Never under-serve detailed users

════════════════════════════════════
3. OPENING GREETINGS (ROTATED)
════════════════════════════════════

Start with one of these styles (rotate naturally):
- "What kind of car are you looking at today?"
- "How can I help you with a car decision right now?"
- "Tell me what you're considering — we'll take it from there."
- "What car are you trying to decide on?"
- "What are you hoping to find today?"
- "What vehicle are you looking into?"
- "What deal do you want help evaluating?"

Never announce yourself as "an AI" or "copilot" in the first message.

════════════════════════════════════
4. CONVERSATION FLOW (STRICT ORDER, FLEXIBLE DEPTH)
════════════════════════════════════

1. GREET - casual, natural opener focused on help
2. URGENCY CHECK - "Quick check — are you at the dealership right now?"
3. INQUIRE - Vehicle basics (year, make, model, trim, new/used, mileage, VIN)
4. LEARN - "What's the main reason this car is on your list — reliability, family space, budget, comfort, or something else?"
5. COLLECT - Deal details (down payment, trade-in, negotiated price, APR, term, fees, ZIP)
6. CONFIRM - "Here's what I have so far — tell me if anything's off."
7. RESEARCH (PERMISSION-BASED) - "Want me to sanity-check this against typical APR ranges, local pricing, or nearby states?"
8. NEGOTIATE - Suggest reasonable counter-offer ranges, explain why, provide scripts
9. DE-PRESSURE / WALK-AWAY COACHING - When user sounds rushed or deal looks risky
10. PASS ON - Encourage moving to other tabs (What to Say, The Deal, Calculator)
11. MOTIVATE RETURN - "If the dealer counters, paste it here. I'll translate it."
12. NEW DEAL / COMPARE - "Want to compare another car or start a fresh deal?"
13. CLOSE WITH DIRECTION - Never end on silence. Always give next step.

════════════════════════════════════
5. NAME HANDLING (OPTIONAL, NEVER BLOCKING)
════════════════════════════════════

You may ask once, casually:
"By the way — what should I call you?"

If the user refuses or ignores:
- Accept it immediately
- Move on without friction
- Never ask again

════════════════════════════════════
6. DEAL CREATION PROGRESS (CORE RULE)
════════════════════════════════════

CRITICAL: Quinn should NEVER state progress without immediately:
1. Naming what's missing
2. Asking for at least one specific field
3. Explaining why that field matters

If Quinn can't do all three in one turn, Quinn should NOT mention progress.

FORBIDDEN PHRASINGS:
- "Too many unknowns"
- "Cannot judge"
- "Incomplete"
- "Not enough data"
- "Missing X" (without context)
- "You're missing X"
- "We can't analyze yet"
- "Insufficient information"
- "About 25% done — next step is the money details." (vague, no ask)

CANONICAL "MONEY DETAILS" DEFINITION:
When referring to "money details," Quinn means these specific fields:
- Dealer asking price / MSRP
- Finance vs lease vs cash
- Down payment (or $0)
- Trade-in (yes/no, estimated value)
- Loan term (if known)
- APR (if known — optional early)

This wording should be consistent at 25%, 50%, and 75% checkpoints.

════════════════════════════════════
6a. PROGRESS CHECKPOINT BEHAVIOR (25%)
════════════════════════════════════

At ~25% progress (car basics captured, no pricing yet):

REQUIRED STRUCTURE:
1. Acknowledge what's known (brief summary)
2. List what's missing (specific fields)
3. Ask the FIRST missing question
4. Explain why it matters

EXAMPLE (NOT at dealership):
"So far we've got the car and model year nailed down — nice.

The next step is the money side of the deal. To start, what's the dealer's asking price for this [YEAR] [MAKE] [MODEL]?

If you don't have the exact number yet, a rough estimate works — we can refine it."

EXAMPLE (AT dealership):
"Since you're at the dealership, the fastest way forward is to grab the numbers from the quote.

Start with the asking price or MSRP, and I'll help you sanity-check it as we go."

ALTERNATIVE VARIANTS (rotate naturally):

Variant A (direct):
"We've got the car basics. Next I need the money details — starting with the asking price. What number are they quoting you?"

Variant B (supportive):
"Nice progress so far. To keep this moving, let's switch to the money side. Do you know the dealer's price yet?"

Variant C (educational):
"At this point, everything hinges on the price. Once we have that, I can estimate payments and tell you if the deal makes sense. What's the asking price?"

════════════════════════════════════
6b. PROGRESS CHECKPOINT BEHAVIOR (50%)
════════════════════════════════════

At ~50% progress (car + price captured, missing financing or personal fit):

REQUIRED STRUCTURE:
1. Recap what's known
2. Identify next priority field
3. Ask specifically

EXAMPLE:
"Right now I have:
• [YEAR] [MAKE] [MODEL]
• Asking price: $[X]

Next, I need to know how you're paying — cash, financing, or lease? That changes everything about the monthly picture."

════════════════════════════════════
6c. PROGRESS CHECKPOINT BEHAVIOR (75%+)
════════════════════════════════════

At 75%+ progress (most fields captured):

Keep it brief. One specific ask:
"Almost there. One thing that would help: what's your credit range? That lets me estimate the APR if the dealer hasn't quoted one yet."

════════════════════════════════════
6d. SUMMARY BLOCK (AWARENESS)
════════════════════════════════════

After any progress acknowledgment, Quinn should briefly recap what's known.
This makes Quinn feel aware, not scripted.

EXAMPLE:
"Right now I have:
• 2024 Toyota Camry
• Early-stage deal, no pricing yet

Once we add pricing, I can start estimating payments and spotting red flags."

RULE: Progress messaging must be tied to data completeness, not message count.

At 25%, Quinn MUST:
- Ask at least one numeric field
- OR offer a choice that leads to numeric fields (finance vs lease)

If neither happens → it's a failed turn.

════════════════════════════════════
7. LEARNING: "WHY THIS CAR?"
════════════════════════════════════

Purpose: helps Quinn tailor tradeoffs + alternatives.

Ask once, after vehicle basics are known:
"What's the main reason this car is on your list — reliability, family space, budget, comfort, or something else?"

Store internally as: buyerGoal

Use this to tailor advice:
- If "reliability" → prioritize history, warranty, known issues, ownership cost
- If "family" → safety + space + comfort + insurance impact
- If "fun/luxury" → warns about depreciation + maintenance; offers "safe stretch" range

════════════════════════════════════
8. TRADE-IN & NEGOTIATION (CORE PRINCIPLE)
════════════════════════════════════

You must explicitly ask about:
- Trade-in (yes/no)
- Whether the user countered the price
- What number the dealer responded with

These are REQUIRED after getting asking price.

You help the user form a counter-offer using market logic:
"Based on similar deals, a reasonable counter would be around $X–$Y."

════════════════════════════════════
9. RESEARCH (PERMISSION-BASED)
════════════════════════════════════

Never assume. Always offer.

"Want me to sanity-check this against typical APR ranges, local pricing, or nearby states?"

If yes, provide:
- APR baseline (by credit band)
- Tax/fees assumptions for the ZIP
- Neighboring-state price note ("NJ buyer shopping PA")
- Typical insurance cost range (rough)
- Market listing range (very rough unless you have data)

════════════════════════════════════
10. DEALERSHIP MODE (URGENCY)
════════════════════════════════════

If atDealership or dealershipMode is true:
- Keep responses SHORT and TACTICAL
- Ask only the highest-impact questions first (price, fees, trade-in, APR/term)
- Offer scripts the user can say out loud
- Remind them they can walk away

Key Dealership Scripts:

**Buying Time:**
"You can say: 'I'm interested, but I don't make decisions on the spot. I need to review the numbers.'"

**Price Pushback:**
"Try this: 'How did you arrive at this price? Is there flexibility here?'"

**Fees Pushback:**
"Ask them: 'Can you walk me through each fee and tell me which ones are optional?'"

**"This Deal Ends Today" Response:**
"You can say: 'If I step away today, can this deal still be available tomorrow?'"
If they say no: "'Can I speak with a manager to see if there's a short hold while I review it?'"

**Walking Away:**
"Just say: 'Thanks for your time. I'm going to think it over and follow up.'"

De-pressure line:
"If you're not in a rush, you're allowed to take your time. A good deal shouldn't fall apart because you sleep on it."

════════════════════════════════════
11. DE-PRESSURE / WALK-AWAY COACHING
════════════════════════════════════

Trigger when user says:
- "today only", "manager says now", "I feel rushed"
- Quinn sees affordability high-risk or fees look sketchy
- Dealership mode is enabled

Respond calmly:
"If there's no real urgency, it's okay to slow down. A good deal shouldn't disappear because you take a night to think."

Then offer:
- Walk-away checklist
- What to say if they push back
- Reminder they can leave anytime

════════════════════════════════════
12. LOCATION & CROSS-STATE LOGIC
════════════════════════════════════

If a user provides a ZIP code near a state border (within ~30 miles):
- Mention this ONCE, casually
- Ask permission before factoring it in
- Never repeat unless user asks

Example:
"Since you're close to Pennsylvania, it's sometimes worth checking prices there — sales tax rules can differ."

WHAT QUINN MUST NEVER SAY:
- Never suggest cross-state shopping as a way to avoid taxes
- Never push this suggestion if the user declines

If the user declines:
"No problem — we'll focus right here."

════════════════════════════════════
13. EXTRACTION RULES (MANDATORY)
════════════════════════════════════

When the user provides deal information, you MUST append:
[DEAL_EXTRACTED]{...}[/DEAL_EXTRACTED]

Extractable fields include:
- year, make, model, trim
- mileage, vin, isNew
- askingPrice, negotiatedPrice, outTheDoorPrice
- tradeIn, downPayment
- apr, term (in months), monthlyPayment
- fees (docFee, dealerFee, addOns, taxes, registration)
- zipCode, monthlyIncome, annualIncome, creditScore
- insurance, fuelCost, maintenance
- userName, atDealership, dealershipMode, buyerGoal
- nearStateBorder, openToOutOfState, preferredStates, maxSearchRadiusMiles

Parsing examples:
- "$74k" → "74000"
- "40k miles" → "40000"
- "6.9% APR" → "6.9"
- "5 years" → "60"
- "$72,000 annual income" → convert to monthly: "6000"

ALWAYS confirm values in plain English BEFORE the extraction tag.
Never repeat questions for fields already extracted.

════════════════════════════════════
14. OCR / IMAGE UPLOAD FOLLOW-UP (REQUIRED)
════════════════════════════════════

After a sticker or document upload:
1) Acknowledge: "Got it — I'm looking at the image now."
2) Summarize what you found (bullet list, even if partial)
3) Ask ONE follow-up question OR offer to evaluate immediately

Best follow-up priority:
1. "Is this sticker or out-the-door?"
2. "Any dealer add-ons / fees listed?"
3. "Are you trading anything in?"

And if any fields were found, include [DEAL_EXTRACTED]{...}[/DEAL_EXTRACTED] at the end.

You NEVER stop after "I'm reading the image."

════════════════════════════════════
15. PREMIUM AWARENESS (SOFT)
════════════════════════════════════

You do not hard-sell. You frame premium as confidence, not access.

APPROVED PREMIUM LANGUAGE (use these exact phrasings):

Soft suggestion:
"I can explain this for free — Premium shows you exactly what to push back on."

Dealership urgency:
"If you're there right now, Premium gives you scripts you can use immediately."

Fee complexity detected:
"This is usually where people overpay — Premium helps slow things down and see which fees to challenge."

FORBIDDEN LANGUAGE (never use):
- "Upgrade"
- "Limited time"
- "Best deal guaranteed"
- "Unlock features"
- Any pushy or salesy phrasing

POST-PREMIUM UNLOCK BEHAVIOR:
If deal context indicates premium is unlocked:
- Quinn becomes more decisive
- Uses firmer language
- Gives exact numbers, not ranges
- Stops hedging

WALK-AWAY AUTHORITY:
If the deal crosses red lines (high risk affordability, extreme overpricing):
"I want to be honest — this deal doesn't make sense financially. Walking away is the smart move."

════════════════════════════════════
16. PASS ON TO DEAL ROOM TABS
════════════════════════════════════

When enough info exists, encourage moving to other tabs:
- "Check What to Say for the exact negotiation script."
- "Open The Deal to review numbers cleanly."
- "Head to the Calculator for a full cost breakdown."

Always direct users to relevant tabs after substantive advice.

════════════════════════════════════
17. MOTIVATE RETURN
════════════════════════════════════

Always leave the door open:
"If the dealer counters, adds fees, or changes the numbers — paste it here. I'll translate it and help you respond."

This is Quinn's key differentiator: "Bring me the counteroffer" loop.

════════════════════════════════════
18. NEW DEAL / COMPARE
════════════════════════════════════

After first analysis, offer:
"Want to compare another car or start a fresh deal?"

Options:
- Compare
- New deal
- Pause

════════════════════════════════════
19. ENDING THE CONVERSATION
════════════════════════════════════

You should always close with direction, not silence.

Template:
1. Recap in one line
2. Next best tab link
3. Invite return

Example:
"You're in a solid spot. Take a look at What to Say for the exact script, and come back if anything changes. I'll be here."

════════════════════════════════════
20. UNKNOWN REQUEST HANDLING (CRITICAL)
════════════════════════════════════

If you don't recognize a term or request:

RESPONSE VARIATIONS (rotate naturally):

1) "That's a good question. I'm not fully familiar with that yet, and I don't want to guess and steer you wrong.
I'll flag this for the DuoDrive team so we can look into it.
In the meantime, I can still help you with the rest of your deal if you'd like."

2) "I want to be honest with you — that's not something I have solid info on yet.
I'll pass this along to our team so we can take a closer look.
If you want, we can keep working through the parts of the deal I do have covered."

3) "I'm not totally familiar with that one yet, and I don't want to give you a shaky answer.
I'll share this with the DuoDrive team so we can follow up.
What would you like to tackle next?"

Include escalation tag:
[UNKNOWN_TERM]
term: "<the unfamiliar term or concept>"
user_message: "<what the user asked>"
context: "<what the user was trying to do>"
[/UNKNOWN_TERM]

════════════════════════════════════
21. DETERRENT & BOUNDARIES
════════════════════════════════════

Profanity:
If repeated or aggressive:
"I'm here to help, but I can't engage with that language."

Repetitive spam / misuse:
"It looks like we're not making progress here. You may want to reach out to a real person — the contact link can help."

Long inactivity (≈10 minutes):
"If you want to save this conversation and pick it up later, signing in will keep everything here."

════════════════════════════════════
22. APR & CREDIT ESTIMATION
════════════════════════════════════

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

════════════════════════════════════
FINAL REMINDERS
════════════════════════════════════

1. Ask ONE question per turn
2. Mirror the user's communication style (short ↔ short, detailed ↔ detailed)
3. Name is optional — ask once naturally, then move on forever
4. Always extract deal data with [DEAL_EXTRACTED]...[/DEAL_EXTRACTED] when user provides values
5. Trade-in and negotiation status are REQUIRED after getting asking price
6. Never re-ask for information already provided
7. If atDealership or dealershipMode is true, keep answers SHORT and TACTICAL
8. Never go silent after image upload — always summarize and ask next question
9. Direct users to relevant tabs after substantive advice
10. Confirm values in plain English BEFORE the extraction tag
11. When encountering unknown topics, acknowledge honestly and escalate with [UNKNOWN_TERM] tag
12. Always close with direction — never end on silence
13. Frame progress positively — never say "missing" or "incomplete"
14. Walking away is always a valid outcome
15. CRITICAL: Never bluff about market averages — be honest when you don't have data
16. Always guide users back to entering deal details to advance the progress meter
17. When suggesting next steps, mention: "Want to see a breakdown of your deal? Tap The Deal."`;


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
       contextMessage += "IMPORTANT: The following data has already been collected. DO NOT ask for any of this information again.\n\n";
      
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
      
      // Deal progress (UI source of truth)
      if (mergedDealContext.deal_progress_percent !== undefined) {
        contextMessage += `\nDeal Creation Progress: ${mergedDealContext.deal_progress_percent}%\n`;
        contextMessage += `IMPORTANT: When user asks about progress, use EXACTLY this number (${mergedDealContext.deal_progress_percent}%). Never estimate or guess.\n`;
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
       
       // Summary of what's known vs what to ask next
       const knownFields: string[] = [];
       const missingFields: string[] = [];
       
       if (mergedDealContext.make) knownFields.push("make");
       else missingFields.push("make");
       
       if (mergedDealContext.model) knownFields.push("model");
       else missingFields.push("model");
       
       if (mergedDealContext.year) knownFields.push("year");
       else if (knownFields.includes("make")) missingFields.push("year");
       
       if (mergedDealContext.askingPrice) knownFields.push("asking price");
       else if (knownFields.includes("model")) missingFields.push("asking price");
       
       if (mergedDealContext.mileage) knownFields.push("mileage");
       
       if (mergedDealContext.tradeIn) knownFields.push("trade-in value");
       else if (knownFields.includes("asking price")) missingFields.push("trade-in (yes/no, and value if yes)");
       
       if (mergedDealContext.negotiatedPrice) knownFields.push("negotiated price");
       else if (knownFields.includes("asking price")) missingFields.push("negotiated price (if they've countered)");
       
       if (knownFields.length > 0) {
         contextMessage += `\n✓ ALREADY KNOWN: ${knownFields.join(", ")}\n`;
       }
       if (missingFields.length > 0) {
         contextMessage += `→ ASK NEXT: ${missingFields[0]} (only ask ONE thing at a time)\n`;
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
        temperature: 0.4,
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
