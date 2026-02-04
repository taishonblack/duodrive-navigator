import { useMemo } from "react";

export type ConfidenceState = "ready" | "almost" | "not_ready";

export interface ConfidenceResult {
  state: ConfidenceState;
  missingFields: string[];
  completedFields: string[];
  progress: number; // 0-100
}

interface DealData {
  year?: string;
  make?: string;
  model?: string;
  trim?: string;
  mileage?: string;
  isNew?: boolean;
  vin?: string;
  askingPrice?: string;
  negotiatedPrice?: string;
  downPayment?: string;
  tradeIn?: string;
  apr?: string;
  term?: string;
  monthlyIncome?: string;
  creditScore?: string;
  buyerZip?: string;
  docFee?: string;
  dealerFee?: string;
  taxes?: string;
  paymentType?: string; // cash / finance / lease
  [key: string]: string | boolean | undefined;
}

// ═══════════════════════════════════════════════════════════════
// DEAL CREATION PROGRESS — FIELD WEIGHTING
// ═══════════════════════════════════════════════════════════════
// 
// Tier 1 — Core Deal Clarity (60%)
// These move the needle the most.
// 
// Tier 2 — Negotiation Power (25%)
// This is where DuoDrive differentiates.
// 
// Tier 3 — Personal Fit (15%)
// These refine risk and affordability.
// ═══════════════════════════════════════════════════════════════

interface FieldDefinition {
  key: string;
  label: string;
  weight: number; // Percentage weight (all should sum to 100)
  tier: 1 | 2 | 3;
}

const WEIGHTED_FIELDS: FieldDefinition[] = [
  // Tier 1 — Core Deal Clarity (60%)
  { key: "year", label: "Year", weight: 3.33, tier: 1 },
  { key: "make", label: "Make", weight: 3.33, tier: 1 },
  { key: "model", label: "Model", weight: 3.34, tier: 1 },
  { key: "askingPrice", label: "Asking price", weight: 15, tier: 1 },
  { key: "isNew", label: "New or used", weight: 5, tier: 1 },
  { key: "mileage", label: "Mileage", weight: 5, tier: 1 },
  { key: "buyerZip", label: "ZIP code", weight: 10, tier: 1 },
  { key: "paymentType", label: "Payment type", weight: 5, tier: 1 },
  { key: "tradeIn", label: "Trade-in", weight: 10, tier: 1 },

  // Tier 2 — Negotiation Power (25%)
  { key: "negotiatedPrice", label: "Counter price", weight: 10, tier: 2 },
  { key: "docFee", label: "Dealer fees", weight: 5, tier: 2 },
  { key: "taxes", label: "Taxes", weight: 5, tier: 2 },
  { key: "tradeInValue", label: "Trade-in value", weight: 5, tier: 2 },

  // Tier 3 — Personal Fit (15%)
  { key: "monthlyIncome", label: "Income", weight: 7, tier: 3 },
  { key: "creditScore", label: "Credit tier", weight: 4, tier: 3 },
  { key: "downPayment", label: "Down payment", weight: 4, tier: 3 },
];

function hasValue(value: string | boolean | undefined): boolean {
  if (typeof value === "boolean") return true;
  return Boolean(value && value.trim() !== "" && value !== "0");
}

// ═══════════════════════════════════════════════════════════════
// PROGRESS MICROCOPY — Dynamic, Gentle, Encouraging
// ═══════════════════════════════════════════════════════════════

export function getProgressMicrocopy(progress: number): string {
  if (progress <= 25) return "We're just getting started.";
  if (progress <= 50) return "Good start — a few details will sharpen this.";
  if (progress <= 75) return "Nice progress. Almost ready for a full breakdown.";
  if (progress <= 90) return "Just a couple of details away from full analysis.";
  return "Your deal is ready for complete analysis.";
}

// ═══════════════════════════════════════════════════════════════
// NEGOTIATION CONFIDENCE FRAMING
// ═══════════════════════════════════════════════════════════════

export function getNegotiationConfidenceLabel(progress: number): string {
  if (progress <= 30) return "Early look — big picture only";
  if (progress <= 60) return "You have leverage starting to form";
  if (progress <= 80) return "You can negotiate intelligently here";
  return "You're walking in informed and prepared";
}

export function useNegotiationConfidence(dealData: DealData): ConfidenceResult {
  return useMemo(() => {
    const missing: string[] = [];
    const completed: string[] = [];
    let weightedCompleted = 0;

    // Special handling: trade-in value only matters if tradeIn is yes
    const hasTradeIn = hasValue(dealData.tradeIn) && 
      (dealData.tradeIn?.toLowerCase() === "yes" || 
       (typeof dealData.tradeIn === "string" && parseFloat(dealData.tradeIn) > 0));

    for (const field of WEIGHTED_FIELDS) {
      // Skip trade-in value if no trade-in
      if (field.key === "tradeInValue" && !hasTradeIn) {
        weightedCompleted += field.weight; // Auto-complete if not applicable
        continue;
      }

      // Skip mileage for new cars
      if (field.key === "mileage" && dealData.isNew === true) {
        weightedCompleted += field.weight;
        continue;
      }

      // Check for value - support both tradeIn as yes/no and as actual value
      let value: string | boolean | undefined;
      if (field.key === "tradeInValue") {
        value = hasTradeIn ? dealData.tradeIn : undefined;
      } else if (field.key === "tradeIn") {
        // For trade-in, we just need to know if they've answered yes/no
        value = dealData.tradeIn;
      } else {
        value = dealData[field.key];
      }

      if (hasValue(value)) {
        completed.push(field.label);
        weightedCompleted += field.weight;
      } else {
        missing.push(field.label);
      }
    }

    // Calculate progress percentage (capped at 100)
    const progress = Math.min(100, Math.round(weightedCompleted));

    // Determine state based on progress thresholds
    let state: ConfidenceState;

    if (progress >= 75) {
      state = "ready";
    } else if (progress >= 50) {
      state = "almost";
    } else {
      state = "not_ready";
    }

    return {
      state,
      missingFields: missing,
      completedFields: completed,
      progress,
    };
  }, [dealData]);
}

/**
 * Checks if premium should be allowed to be suggested
 * Premium can only be suggested when state is NOT "ready"
 */
export function canSuggestPremium(state: ConfidenceState): boolean {
  return state !== "ready";
}

/**
 * Returns the display text for each confidence state
 * Now uses Deal Creation Progress language
 */
export function getConfidenceDisplay(state: ConfidenceState, progress: number): {
  headline: string;
  subtext: string;
  statusLine: string;
  variant: "success" | "warning" | "destructive";
} {
  const statusLine = `${progress}% complete`;
  const subtext = getProgressMicrocopy(progress);

  switch (state) {
    case "ready":
      return {
        headline: "Deal-ready — full DuoDrive analysis",
        subtext,
        statusLine,
        variant: "success",
      };
    case "almost":
      return {
        headline: "Strong foundation — negotiation guidance unlocked",
        subtext,
        statusLine,
        variant: "warning",
      };
    case "not_ready":
      return {
        headline: progress <= 25 
          ? "Early look — big picture guidance"
          : "Taking shape — directional advice available",
        subtext,
        statusLine,
        variant: "destructive",
      };
  }
}
