import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  messages: Message[];
  dealContext?: {
    year?: string;
    make?: string;
    model?: string;
    askingPrice?: string;
    apr?: string;
    term?: string;
    monthlyIncome?: string;
    scoreResult?: {
      overall: number;
      pillars: Record<string, { score: number; details: string }>;
      recommendation: string;
      monthlyPayment: number;
      totalCost: number;
    };
  };
}

const systemPrompt = `You are DuoDrive AI Copilot, a friendly and knowledgeable car buying assistant. Your job is to help users understand their car deal and make informed decisions.

You have expertise in:
- Explaining car pricing, fees, and financing terms
- Identifying red flags in car deals (high APR, excessive fees, dealer add-ons)
- Understanding the DuoDrive Score and its five pillars: Depreciation, Reliability, Safety, Deal Health, and Affordability
- Suggesting negotiation strategies
- Explaining car buying terminology

Guidelines:
- Be warm, helpful, and conversational
- Keep responses concise but informative (2-4 paragraphs max)
- When discussing the user's specific deal, reference the numbers they provided
- Always be on the user's side - help them get a fair deal
- If you see concerning numbers, gently point them out and suggest alternatives
- Never recommend specific dealerships or loan providers
- Format key numbers and percentages clearly

If the user hasn't entered deal details yet, encourage them to fill in the "The Deal" tab for personalized analysis.`;

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
      if (dealContext.year && dealContext.make) {
        contextMessage += `Vehicle: ${dealContext.year} ${dealContext.make} ${dealContext.model || ''}\n`;
      }
      if (dealContext.askingPrice) {
        contextMessage += `Asking Price: ${dealContext.askingPrice}\n`;
      }
      if (dealContext.apr) {
        contextMessage += `APR: ${dealContext.apr}%\n`;
      }
      if (dealContext.term) {
        contextMessage += `Loan Term: ${dealContext.term} months\n`;
      }
      if (dealContext.monthlyIncome) {
        contextMessage += `Monthly Income: ${dealContext.monthlyIncome}\n`;
      }
      
      if (dealContext.scoreResult) {
        contextMessage += `\n--- DUODRIVE SCORE RESULTS ---\n`;
        contextMessage += `Overall Score: ${dealContext.scoreResult.overall}/100\n`;
        contextMessage += `Monthly Payment: $${dealContext.scoreResult.monthlyPayment}\n`;
        contextMessage += `Total Cost: $${dealContext.scoreResult.totalCost}\n`;
        contextMessage += `\nPillar Scores:\n`;
        for (const [pillar, data] of Object.entries(dealContext.scoreResult.pillars)) {
          contextMessage += `- ${pillar}: ${data.score}/100 - ${data.details}\n`;
        }
        contextMessage += `\nRecommendation: ${dealContext.scoreResult.recommendation}\n`;
      }
    }

    console.log("Starting AI chat with context:", dealContext ? "yes" : "no");

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
