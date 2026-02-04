/**
 * Dealership Mode Quick Replies Configuration
 * Config-driven quick reply chips for tactical dealership conversations
 */

export type QuickReplyAction = {
  id: string;
  label: string;
  userSay: string;
  coach: string;
  tags: string[];
};

export type QuickReplyGroup = {
  id: string;
  title: string;
  actions: QuickReplyAction[];
};

export type PasteCounterFlow = {
  id: string;
  title: string;
  prompt: string;
  followupQuestions: string[];
};

export type DealershipQuickReplyConfig = {
  mode: "dealership";
  alwaysVisible: string[];
  groups: QuickReplyGroup[];
  pasteCounterFlow: PasteCounterFlow;
};

export const dealershipQuickReplyConfig: DealershipQuickReplyConfig = {
  mode: "dealership",
  alwaysVisible: ["otd_breakdown", "total_price_first", "show_term_apr"],
  groups: [
    {
      id: "price",
      title: "Price",
      actions: [
        {
          id: "otd_breakdown",
          label: "Out-the-door breakdown",
          userSay: "Can we review the deal sheet line-by-line? I want the full out-the-door breakdown.",
          coach: "Keep your tone calm. If they won't show an itemized breakdown, that's a red flag.",
          tags: ["negotiation", "otd"]
        },
        {
          id: "my_offer",
          label: "Here's my offer",
          userSay: "If we can do $X out-the-door, I'm ready to move forward.",
          coach: "Say it once, then pause. Silence is leverage.",
          tags: ["negotiation", "price"]
        },
        {
          id: "above_market",
          label: "Higher than market",
          userSay: "This looks higher than similar listings I've seen. What flexibility do you have?",
          coach: "You're not accusing — you're inviting them to move.",
          tags: ["negotiation", "market"]
        },
        {
          id: "manager",
          label: "Ask a manager",
          userSay: "Would it help to loop in a manager to see if there's any flexibility left?",
          coach: "Normal request. Calm tone. Keeps it professional.",
          tags: ["negotiation", "escalation"]
        }
      ]
    },
    {
      id: "fees",
      title: "Fees",
      actions: [
        {
          id: "line_by_line",
          label: "Review line-by-line",
          userSay: "Can we review the deal sheet line-by-line? I want the full out-the-door breakdown.",
          coach: "If they won't itemize, that's a red flag. Ask for a printout or email.",
          tags: ["fees", "otd"]
        },
        {
          id: "explain_fee",
          label: "Explain this fee",
          userSay: "Can you explain what this fee covers, and whether it's required?",
          coach: "Required fees are usually tax/registration. Many others are negotiable.",
          tags: ["fees"]
        },
        {
          id: "remove_addons",
          label: "Remove add-ons",
          userSay: "I'm not interested in dealer add-ons. Can we remove these from the deal?",
          coach: "If they say no, ask to offset the add-ons in the price.",
          tags: ["fees", "addons"]
        },
        {
          id: "offset_addons",
          label: "Offset add-ons",
          userSay: "If those can't be removed, can you offset them in the vehicle price?",
          coach: "This is the cleanest way to neutralize add-ons.",
          tags: ["fees", "addons"]
        },
        {
          id: "doc_fee",
          label: "Doc fee pushback",
          userSay: "I understand doc fees vary — can we reduce the vehicle price to offset it?",
          coach: "Doc fees often won't be removed, but offsets are common.",
          tags: ["fees", "doc"]
        }
      ]
    },
    {
      id: "monthly",
      title: "Monthly",
      actions: [
        {
          id: "total_price_first",
          label: "Total price first",
          userSay: "I'm shopping based on out-the-door price, not just monthly.",
          coach: "Out-the-door prevents payment tricks. Monthly comes after price is set.",
          tags: ["monthly", "otd"]
        },
        {
          id: "show_term_apr",
          label: "Show term & APR",
          userSay: "What term and APR is that monthly payment based on?",
          coach: "Fastest way to expose a payment trick. Get the numbers in writing.",
          tags: ["monthly", "finance"]
        },
        {
          id: "keep_term",
          label: "Keep term at X",
          userSay: "I'm not stretching the term just to hit a payment. Keep it at X months.",
          coach: "Good boundary. Longer term usually costs more and increases upside-down risk.",
          tags: ["monthly", "finance"]
        }
      ]
    },
    {
      id: "tradein",
      title: "Trade-in",
      actions: [
        {
          id: "price_first_trade_second",
          label: "Price first, trade second",
          userSay: "I'd like to finalize the car price first, then we can talk trade-in.",
          coach: "This stops value shifting between trade and price.",
          tags: ["tradein"]
        },
        {
          id: "separate_numbers",
          label: "Separate the numbers",
          userSay: "Can you show the car price and trade value separately so I can compare?",
          coach: "If they can't separate it, you can't verify it.",
          tags: ["tradein", "verification"]
        },
        {
          id: "recheck_trade",
          label: "Re-check trade value",
          userSay: "That trade value seems low. Can you re-check it?",
          coach: "If trade won't move, ask for movement on vehicle price instead.",
          tags: ["tradein"]
        }
      ]
    },
    {
      id: "pressure",
      title: "Pressure",
      actions: [
        {
          id: "no_same_day",
          label: "No same-day pressure",
          userSay: "I don't make same-day decisions under pressure. If it's a good deal, it should hold.",
          coach: "Say it calmly. Their reaction tells you a lot.",
          tags: ["pressure"]
        },
        {
          id: "hold_24h",
          label: "24-hour hold",
          userSay: "Can you give me 24 hours to think it over? If it still makes sense, I'll come back.",
          coach: "If they refuse, it's often artificial urgency.",
          tags: ["pressure"]
        },
        {
          id: "pause",
          label: "Pause",
          userSay: "I'm going to pause for now. I appreciate your time.",
          coach: "You're protecting your money. No apology needed.",
          tags: ["walkaway", "pressure"]
        }
      ]
    },
    {
      id: "walkaway",
      title: "Walk away",
      actions: [
        {
          id: "pause_clean",
          label: "I'm going to pause",
          userSay: "I'm going to pass for now. If the numbers change, feel free to reach out.",
          coach: "This keeps the door open while you regain control.",
          tags: ["walkaway"]
        },
        {
          id: "text_me",
          label: "Text me if it changes",
          userSay: "If the numbers change, feel free to text me. Otherwise, I'm going to keep shopping.",
          coach: "This keeps the door open while reclaiming control.",
          tags: ["walkaway"]
        }
      ]
    }
  ],
  pasteCounterFlow: {
    id: "paste_counter",
    title: "Paste the dealer's counter",
    prompt: "Paste the updated numbers (out-the-door, monthly, APR, term, any fees). Even partial is fine — I'll translate it.",
    followupQuestions: [
      "Is that out-the-door or before taxes/fees?",
      "Did they change the APR or term to get that monthly payment?",
      "Any add-ons or packages included now?"
    ]
  }
};

/**
 * Determine which group should be auto-expanded based on deal state
 */
export type DealContext = {
  askingPrice?: string;
  negotiatedPrice?: string;
  monthlyPayment?: string;
  apr?: string;
  term?: string;
  downPayment?: string;
  tradeIn?: string;
  tradeInValue?: string;
  dealerFee?: string;
  docFee?: string;
  addOns?: string;
  taxes?: string;
  zipCode?: string;
  pressureDetected?: boolean;
  affordabilityRisk?: "low" | "medium" | "high";
};

export function pickExpandedGroupId(deal: DealContext): string {
  // Fees missing or just uploaded sticker/doc
  const feesMissing = !deal.dealerFee && !deal.docFee && !deal.addOns && !deal.taxes;
  if (feesMissing) return "fees";

  // Negotiated missing but asking exists
  if (deal.askingPrice && !deal.negotiatedPrice) return "price";

  // Monthly mentioned OR user is payment-focused
  if (deal.monthlyPayment) return "monthly";

  // Trade-in yes but no value
  const tradeYes = deal.tradeIn === "true" || (!!deal.tradeIn && deal.tradeIn !== "false" && deal.tradeIn !== "0");
  if (tradeYes && !deal.tradeInValue) return "tradein";

  // Pressure language / urgency
  if (deal.pressureDetected) return "pressure";

  // Affordability risk
  if (deal.affordabilityRisk === "high") return "walkaway";

  // Default
  return "price";
}

/**
 * Replace placeholder values in script templates
 */
export function replacePlaceholders(
  template: string,
  opts: {
    targetOTD?: string;
    targetTermMonths?: string;
  }
): string {
  let s = template;
  if (opts.targetOTD) {
    const formatted = `$${Number(opts.targetOTD).toLocaleString()}`;
    s = s.split("$X out-the-door").join(`${formatted} out-the-door`);
    s = s.split("$X").join(formatted);
  }
  if (opts.targetTermMonths) {
    s = s.split("X months").join(`${opts.targetTermMonths} months`);
  }
  return s;
}

/**
 * Get action by ID from config
 */
export function getActionById(actionId: string): QuickReplyAction | undefined {
  for (const group of dealershipQuickReplyConfig.groups) {
    const action = group.actions.find(a => a.id === actionId);
    if (action) return action;
  }
  return undefined;
}
