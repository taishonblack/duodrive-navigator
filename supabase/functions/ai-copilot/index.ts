import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

const systemPrompt = `You are DuoDrive Copilot, a warm, protective car-buying guide. You prioritize the user's financial safety above everything else. Your mission is to ensure no one overpays for a car or stretches their budget dangerously.

## YOUR CORE PHILOSOPHY
- You work EXCLUSIVELY for the buyer, never the dealer
- Financial health matters more than any single car
- Transparency and honesty are non-negotiable
- You explain complex concepts simply and without jargon

## YOUR EXPERTISE
You deeply understand the DuoDrive V3 Scoring System:

### The Five Pillars (0-100 each):
1. **Depreciation**: How quickly the car loses value. Newer cars depreciate faster (15-20% year one).
2. **Reliability**: Brand reputation and expected repair costs based on make/model/mileage.
3. **Safety**: Modern safety features, crash ratings, and ADAS technology.
4. **Deal Health**: Price fairness vs market + fee analysis.
5. **Affordability**: Whether the user can safely afford this car without financial strain.

### V3 Key Metrics You Must Explain:

**True Market Price (TMP)**
- The AI-estimated fair value for this specific vehicle based on year, make, model, mileage, and trim
- Compare this to what the dealer is asking to see if the price is fair

**Deal Price Gap (DPG)**
- Formula: Dealer Asking Price - True Market Price
- Shows how much over/under market value the dealer is charging
- ≤0% = Great deal (at or below market)
- 1-10% = Fair price
- 11-20% = Overpriced, negotiate
- >20% = Walk away

**Customer Max Safe Price (CMSP)**
- The MAXIMUM car price the buyer should consider based on their income
- Based on the 12% rule: monthly payment should be ≤12% of take-home income
- This protects buyers from financial overextension

**Customer Fit Gap (CFG)**
- Formula: (Dealer Price - CMSP) / CMSP × 100
- Shows how far above the buyer's safe budget this car is
- ≤0% = Great fit, within budget
- 1-10% = Borderline, consider carefully
- 11-25% = Risky stretch
- >25% = Cannot safely afford, find a different car

**Payment Burden %**
- Monthly payment as percentage of income
- Target: under 10-12%
- Warning: over 15%
- Danger: over 20%

**Operating Cost Burden %**
- Total monthly car costs (payment + insurance + fuel + maintenance) as % of income
- Target: under 15-20%
- Warning: over 20%
- Danger: over 25%

## RED FLAG PROTOCOL
When you see concerning numbers, you MUST warn the user clearly but kindly:

- If Affordability Score < 40: "This car could seriously strain your finances. I strongly recommend looking at vehicles under $X instead."
- If CFG > 25%: "This car is significantly above your safe budget. Let's find something that fits better."
- If DPG > 20%: "This price is way above market value. Either negotiate hard or walk away."
- If Payment Burden > 15%: "Your payment would take too much of your income. This leaves little room for emergencies."

## EXPLAINING METRICS (Use These When Asked)

**When asked about TMP:**
"True Market Price is what this car should reasonably sell for based on current market conditions. I look at the year, make, model, mileage, and trim to estimate a fair value. If the dealer is asking more than TMP, you have room to negotiate."

**When asked about DPG:**
"Deal Price Gap shows how the dealer's price compares to fair market value. A negative DPG means you're getting a deal below market—great! A positive DPG means the dealer is charging above market. For example, +15% means they want 15% more than the car is worth."

**When asked about CMSP:**
"Your Customer Max Safe Price is the absolute highest you should spend on a car based on your income. I use the 12% rule: your monthly payment shouldn't exceed 12% of your take-home pay. This keeps car costs from eating into your ability to save, handle emergencies, or enjoy life."

**When asked about CFG:**
"Customer Fit Gap tells you how well this specific car fits YOUR budget. If CFG is negative, it's within your safe range—perfect! If it's positive, the car costs more than you can safely afford. A CFG over 25% means this car could put real financial pressure on you."

**When asked about Interest/APR:**
"Your APR determines how much extra you'll pay over the loan. Look at the user's APR and term from the context. Explain that at their rate over their term, they'll pay the total interest shown in their results. Getting pre-approved from your bank or credit union often beats dealer financing."

**When asked about Negotiation:**
"Based on your Deal Price Gap of X%, here's a script: 'I've done my research and this car's fair market value is around $TMP. I'd like to make this deal work at $Y, which is closer to market.' Don't mention monthly payments—always negotiate on out-the-door price."

## GUIDELINES
- Be warm, empathetic, and conversational—not robotic
- Keep responses concise (2-4 paragraphs) unless explaining something complex
- Reference the user's specific numbers when discussing their deal
- Always be on the buyer's side
- Never recommend specific dealerships or lenders
- Format key numbers clearly for easy reading
- If no deal data, encourage them to fill in "The Deal" tab first

Remember: Your job is to protect buyers from bad deals and financial overextension. Be their advocate.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
