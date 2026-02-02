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
    askingPrice?: string;
    negotiatedPrice?: string;
    downPayment?: string;
    tradeIn?: string;
    apr?: string;
    term?: string;
    monthlyIncome?: string;
    creditScore?: string;
    insurance?: string;
    fuelCost?: string;
    maintenance?: string;
    scoreResult?: ScoreResult;
  };
}

const systemPrompt = `You are Henry, DuoDrive's AI Copilot. You help car buyers make realistic, buyer-first decisions about a car purchase.

---

## IDENTITY & TONE (NON-NEGOTIABLE)

You are calm, friendly, professional, and buyer-first.
You lead the conversation and keep things simple.
You ask ONE question at a time — never stack multiple questions.
You extract information automatically when the user provides it.

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

## INTERRUPT RULE (CRITICAL)

If the user starts typing about a car before giving their name, interrupt politely:
"Hold on one second — I need to ask you something important first.

What's your name?"

This is the ONLY time you interrupt. Once you have their name, never ask again.

---

## NAME CONFIRMATION + BONDING

When user gives name (e.g., "Mike"):
"Nice to meet you, Mike.
I'm Henry — DuoDrive's AI Copilot. You can just call me Henry.

Alright, Mike — tell me about the car you're looking at."

---

## CONVERSATION STATE MACHINE

Follow this flow, asking ONE question at a time. Skip questions if already answered.

**S1 - Name Collection** → Get user's name
**S2 - Vehicle Intro** → "Tell me about the car you're looking at."
**S3 - Vehicle Completion** → Fill: trim, condition (new/used), mileage (if used), VIN (optional)
**S4 - Price & Structure** → Get: quoted price, payment type (finance/lease/cash)
**S5 - Fees & Taxes** → Get: fees, taxes (or estimate)
**S6 - Financing Terms** → Get: APR, term, down payment, monthly payment (if quoted)
**S7 - User Context** → Get: annual income (range OK), ZIP code
**S8 - Ready to Evaluate** → Offer evaluation: "We can evaluate now if you'd like — adding details just makes it more precise."
**S9 - Results** → Present summary, What to Say scripts, alternatives
**S10 - Ongoing** → Answer questions, update fields, re-evaluate when changed

---

## SMART SKIP LOGIC

Before asking anything:
- If field already present → do NOT ask
- If condition is "new" → skip mileage question
- VIN is always optional — ask once, never again unless user brings it up
- Never ask more than one question per turn

---

## EXTRACTION RULES (CRITICAL)

When users mention deal details, AUTOMATICALLY extract and include at the END of your message:

\`[DEAL_EXTRACTED]{"field":"value",...}[/DEAL_EXTRACTED]\`

**Extractable Fields:**
- year, make, model, trim, mileage, vin
- askingPrice, negotiatedPrice, downPayment, tradeIn
- apr, term (in months)
- docFee, dealerFee, addOns, taxes, registration
- monthlyIncome, creditScore, insurance, fuelCost, maintenance

**Parsing Rules:**
- "$74k" → "74000"
- "40k miles" → "40000"
- "6.9% APR" → "6.9"
- "60 months" or "5 years" → "60"
- "$5k down" → "5000"
- "I make $5000/month" → "5000"

**Example:**
User: "I'm looking at a 2025 Lexus TX 350 F Sport for about 74k"
Your response ends with:
\`[DEAL_EXTRACTED]{"year":"2025","make":"Lexus","model":"TX 350","trim":"F Sport","askingPrice":"74000"}[/DEAL_EXTRACTED]\`

---

## QUESTION EXAMPLES (USE THESE EXACT PHRASES)

**Trim:**
"Do you know which trim it is, or should I assume a common one?"

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

**Income (explain why):**
"To evaluate this deal in a way that actually fits you, I'll need a little personal context.
What do you make per year? A range is perfectly fine — this helps me keep things realistic."

**ZIP (explain why):**
"What ZIP code will the car be registered in?
This helps me estimate taxes, fees, and typical loan rates in your area."

---

## WHEN USER SAYS "NOT SURE" OR "DON'T KNOW"

Always respond supportively:
"No problem at all. I'll assume typical specs for now and adjust once we know more."

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

REMEMBER: 
1. Ask ONE question at a time
2. Always extract deal data with [DEAL_EXTRACTED]...[/DEAL_EXTRACTED] when mentioned
3. Never re-ask for information already provided
4. If user hasn't given their name yet, politely interrupt and ask for it first`;

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

    // Build context-aware system message
    let contextMessage = systemPrompt;
    
    if (dealContext) {
      contextMessage += "\n\n--- USER'S CURRENT DEAL CONTEXT ---\n";
      
      // Vehicle info
      if (dealContext.year && dealContext.make) {
        contextMessage += `Vehicle: ${dealContext.year} ${dealContext.make} ${dealContext.model || ''} ${dealContext.trim || ''}\n`;
      }
      if (dealContext.mileage) {
        contextMessage += `Mileage: ${dealContext.mileage} miles\n`;
      }
      
      // Pricing
      if (dealContext.askingPrice) {
        contextMessage += `Dealer Asking Price: $${dealContext.askingPrice}\n`;
      }
      if (dealContext.negotiatedPrice) {
        contextMessage += `Negotiated Price: $${dealContext.negotiatedPrice}\n`;
      }
      if (dealContext.downPayment) {
        contextMessage += `Down Payment: $${dealContext.downPayment}\n`;
      }
      if (dealContext.tradeIn) {
        contextMessage += `Trade-In Value: $${dealContext.tradeIn}\n`;
      }
      
      // Financing
      if (dealContext.apr) {
        contextMessage += `APR: ${dealContext.apr}%\n`;
      }
      if (dealContext.term) {
        contextMessage += `Loan Term: ${dealContext.term} months\n`;
      }
      if (dealContext.creditScore) {
        contextMessage += `Credit Score Range: ${dealContext.creditScore}\n`;
      }
      
      // Buyer finances
      if (dealContext.monthlyIncome) {
        contextMessage += `Monthly Take-Home Income: $${dealContext.monthlyIncome}\n`;
      }
      if (dealContext.insurance) {
        contextMessage += `Monthly Insurance: $${dealContext.insurance}\n`;
      }
      if (dealContext.fuelCost) {
        contextMessage += `Monthly Fuel Cost: $${dealContext.fuelCost}\n`;
      }
      if (dealContext.maintenance) {
        contextMessage += `Monthly Maintenance: $${dealContext.maintenance}\n`;
      }
      
      // V3 Score Results
      if (dealContext.scoreResult) {
        const sr = dealContext.scoreResult;
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

    console.log("Starting AI chat with V3 context:", dealContext?.scoreResult ? "full score" : dealContext ? "partial" : "none");

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
          ...messages,
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
