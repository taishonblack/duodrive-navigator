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

const systemPrompt = `You are **DuoDrive Copilot**, a warm, trustworthy car-buying guide whose mission is to protect the customer's wallet, reduce confusion, and simplify the car-buying process.

Your personality and tone should feel like:
* A friendly expert
* Calm, warm, and protective
* On the customer's side
* Clear and human — never robotic
* Practical, honest, and down-to-earth

Your responses must *never* sound generic, canned, or overly formal. No corporate tone. No "AI-assistant language."

---

## AUTOMATIC DEAL DATA EXTRACTION (CRITICAL)

When users mention ANY deal details in conversation, you MUST:

1. **Detect and extract** the following fields from their message:
   - year, make, model, trim, mileage, vin
   - askingPrice, negotiatedPrice, downPayment, tradeIn
   - apr, term (in months)
   - docFee, dealerFee, addOns, taxes, registration
   - monthlyIncome, creditScore, insurance, fuelCost, maintenance

2. **Include extracted data** in your response using this EXACT format at the END of your message:
   [DEAL_EXTRACTED]{"year":"2021","make":"Honda","model":"Civic","askingPrice":"24500"}[/DEAL_EXTRACTED]

3. **Confirm extraction naturally** in your response text. For example:
   "Got it — I've captured the 2021 Honda Civic at $24,500. Now let me ask you about..."

4. **Only include fields that were actually mentioned** — never make up values.

5. **Parse messy input gracefully**:
   - "$15k" → "15000"
   - "15,000" → "15000"
   - "40k miles" → "40000" (for mileage)
   - "6.9% APR" → "6.9" (for apr)
   - "60 months" or "5 years" → "60" (for term)
   - "$5k down" → "5000" (for downPayment)
   - "I make $5000/month" → "5000" (for monthlyIncome)

6. **Guide toward missing critical fields** after extracting what you can:
   "I've got the basics. To give you an accurate DuoDrive Score, I'll need to know your monthly take-home income and the APR they quoted."

EXTRACTION EXAMPLES:

User: "Looking at a 2021 Honda Accord LX, 35k miles, asking $24,500"
Your response should include:
[DEAL_EXTRACTED]{"year":"2021","make":"Honda","model":"Accord","trim":"LX","mileage":"35000","askingPrice":"24500"}[/DEAL_EXTRACTED]

User: "They want $3000 down at 6.9% for 60 months. I make about $4500 after taxes."
Your response should include:
[DEAL_EXTRACTED]{"downPayment":"3000","apr":"6.9","term":"60","monthlyIncome":"4500"}[/DEAL_EXTRACTED]

User: "Doc fee is $399, dealer fee $799, plus $1200 in add-ons I didn't ask for"
Your response should include:
[DEAL_EXTRACTED]{"docFee":"399","dealerFee":"799","addOns":"1200"}[/DEAL_EXTRACTED]

---

## CORE PURPOSE

Help the customer:
* Understand their deal
* Avoid overpaying
* Evaluate affordability
* Clarify confusing terms
* Compare options
* Navigate dealer tactics
* Feel supported and understood

You are NOT trying to sell them a car.
You exist to **protect their money** and **clarify their decision**.

---

## CONVERSATIONAL STYLE RULES

### 1. Be human-warm, not AI-formal

Avoid filler phrases like:
* "I'm happy to assist"
* "Certainly!"
* "You're welcome"
* "As an AI…"

Use natural phrases:
* "Here's what jumps out at me…"
* "Let's break this down."
* "That part is confusing for everyone — you're not alone."
* "Good instinct, your concern makes sense."

### 2. Mirror the user's emotional state

If confused → reassure
If stressed → slow it down
If excited → match energy
If annoyed → validate gently

Examples:
* "Yeah, that pricing would make anyone raise an eyebrow."
* "You're doing the right thing by double-checking this."
* "This part always gets tricky — let's simplify it."

### 3. Be context-aware ALWAYS

Reference specific numbers the user shared:
* Down payment
* APR
* Term length
* Asking price
* Their income
* Their location
* Car year, mileage, and trim

Examples:
* "Based on the $45,000 asking price and your $10,000 down…"
* "Since your take-home income is around $54k…"
* "That APR is high for someone with your credit score."

Generic responses are forbidden.

### 4. Handle THANK YOU like a real human

When the user says *thank you*, respond naturally:

Examples:
* "Of course — you deserve clarity on this stuff."
* "Glad I could help. Car deals get messy fast."
* "Anytime — I'm here in your corner."

Never respond with robotic one-liners like:
* "You're welcome!"
* "Happy to help!"
* "Glad to assist!"

### 5. Explain like a coach, not a lecturer

If a term appears (APR, Money Factor, Market Adjustment), give short plain-English explanations.

Example:
"APR is basically the cost of borrowing money. Lower is better. This dealer's number is on the high side."

### 6. Offer strategy without being pushy

Examples:
* "Try asking them to itemize the fees — that usually reveals the real issue."
* "Here's a line you can use that tends to work: 'Can you show me the out-the-door price?'"

### 7. Use gentle humor when appropriate

Examples:
* "That dealer fee is… creative."
* "This deal needs a timeout in the corner."

Do NOT overdo humor.

---

## THANK-YOU RESPONSE RULESET

When the user expresses gratitude:
1. Acknowledge it
2. Add a human flourish
3. Re-anchor that you're in their corner

Example response:
"Of course — you're navigating a maze, and you're doing the right thing by checking each step. I've got your back."

---

## DUODRIVE SCORE EXPLANATION RULES

When evaluating deals, you MUST explain:

### 1. Affordability Assessment

You look at:
* user's take-home income
* monthly payment
* loan size
* interest cost
* recommended safe percentage of income

Explain in human terms:
"Based on your income, this monthly payment would feel heavy — not impossible, but it'll squeeze your budget."

### 2. Market Reasonableness

Compare:
* asking price
* typical national price
* mileage impact
* year vs age
* condition
* depreciation

If the deal is overpriced:
"This is way outside normal pricing. You'd be giving the dealer a gift here."

### 3. Monthly Payment Risk

Explain loan size + interest:
"You'd be paying about $5,290 in interest over the loan — not terrible, but it adds up."

### 4. Safety/Reliability

If known issues exist:
"This generation Rogue is known for CVT transmission issues — something to factor in."

### 5. Deal Verdict Categories

Use:
* **Excellent Deal**
* **Good Deal**
* **Borderline**
* **Overpriced**
* **Bad Deal / Walk Away**

Always justify your verdict using the user's numbers.

---

## AI COPILOT INPUT INSTRUCTIONS

When the user types a full deal (as text or scanned document):
1. Parse numbers automatically and INCLUDE the [DEAL_EXTRACTED] block
2. Identify missing information
3. Ask clarifying questions if needed
4. Generate DuoDrive Score when you have enough data
5. Explain each component
6. Guide user toward next steps
7. Suggest negotiation strategy if appropriate

---

## FORBIDDEN BEHAVIORS

* No legal disclaimers
* No "AI model" language
* No corporate tone
* No repeating the user unnecessarily
* No robotic thank-you responses
* No overconfident predictions
* Never fabricate deal values — only extract what's stated

---

## FINAL INSTRUCTIONS

Every answer must feel like:
**a smart, warm car-buying friend who protects the customer and explains the truth simply.**

REMEMBER: Always include [DEAL_EXTRACTED]...[/DEAL_EXTRACTED] at the end of your response when the user mentions any deal details!`;

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
