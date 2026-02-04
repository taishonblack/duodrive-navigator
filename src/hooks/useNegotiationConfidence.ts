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
  [key: string]: string | undefined;
}

// Field definitions with labels for display
const REQUIRED_FIELDS: { key: string; label: string; priority: "core" | "important" | "helpful" }[] = [
  // Core fields - must have for basic evaluation
  { key: "askingPrice", label: "Asking price", priority: "core" },
  { key: "make", label: "Make", priority: "core" },
  { key: "model", label: "Model", priority: "core" },
  
  // Important fields - significantly improve analysis
  { key: "year", label: "Year", priority: "important" },
  { key: "monthlyIncome", label: "Monthly income", priority: "important" },
  { key: "apr", label: "APR", priority: "important" },
  { key: "term", label: "Loan term", priority: "important" },
  
  // Helpful fields - nice to have
  { key: "downPayment", label: "Down payment", priority: "helpful" },
  { key: "creditScore", label: "Credit score", priority: "helpful" },
  { key: "buyerZip", label: "ZIP code", priority: "helpful" },
];

// Weights for progress calculation
const PRIORITY_WEIGHTS = {
  core: 3,
  important: 2,
  helpful: 1,
};

function hasValue(value: string | undefined): boolean {
  return Boolean(value && value.trim() !== "" && value !== "0");
}

export function useNegotiationConfidence(dealData: DealData): ConfidenceResult {
  return useMemo(() => {
    const missing: string[] = [];
    const completed: string[] = [];
    let weightedTotal = 0;
    let weightedCompleted = 0;

    for (const field of REQUIRED_FIELDS) {
      const weight = PRIORITY_WEIGHTS[field.priority];
      weightedTotal += weight;

      if (hasValue(dealData[field.key])) {
        completed.push(field.label);
        weightedCompleted += weight;
      } else {
        missing.push(field.label);
      }
    }

    // Calculate progress percentage
    const progress = Math.round((weightedCompleted / weightedTotal) * 100);

    // Determine state based on what's missing
    const coreFields = REQUIRED_FIELDS.filter((f) => f.priority === "core");
    const missingCore = coreFields.filter((f) => !hasValue(dealData[f.key]));
    const importantFields = REQUIRED_FIELDS.filter((f) => f.priority === "important");
    const missingImportant = importantFields.filter((f) => !hasValue(dealData[f.key]));

    let state: ConfidenceState;

    if (missingCore.length > 0) {
      // Missing core fields = not ready
      state = "not_ready";
    } else if (missingImportant.length > 2) {
      // Missing more than 2 important fields = not ready
      state = "not_ready";
    } else if (missing.length <= 2) {
      // Only 1-2 fields missing total = ready
      state = "ready";
    } else {
      // Some important/helpful fields missing = almost ready
      state = "almost";
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
 */
export function getConfidenceDisplay(state: ConfidenceState): {
  headline: string;
  subtext: string;
  variant: "success" | "warning" | "destructive";
} {
  switch (state) {
    case "ready":
      return {
        headline: "This deal is ready to evaluate.",
        subtext: "You've provided enough information to assess fairness and negotiation options.",
        variant: "success",
      };
    case "almost":
      return {
        headline: "You're missing 1–2 details.",
        subtext: "These details strengthen negotiation leverage.",
        variant: "warning",
      };
    case "not_ready":
      return {
        headline: "Too many unknowns to judge this deal.",
        subtext: "To give you a confident answer, we need a few more basics.",
        variant: "destructive",
      };
  }
}
