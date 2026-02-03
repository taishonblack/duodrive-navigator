import { useCallback } from "react";

export interface ExtractedDealData {
  // User context
  userName?: string;
  name?: string;
  atDealership?: string;
  dealershipMode?: string;
  
  // Vehicle info
  year?: string;
  make?: string;
  model?: string;
  trim?: string;
  mileage?: string;
  vin?: string;
  isNew?: string;
  condition?: string;
  
  // Pricing
  askingPrice?: string;
  negotiatedPrice?: string;
  counterPrice?: string;
  outTheDoorPrice?: string;
  downPayment?: string;
  tradeIn?: string;
  tradeValue?: string;
  
  // Financing
  apr?: string;
  term?: string;
  monthlyPayment?: string;
  
  // Fees
  docFee?: string;
  dealerFee?: string;
  addOns?: string;
  taxes?: string;
  registration?: string;
  
  // Buyer finances
  monthlyIncome?: string;
  annualIncome?: string;
  creditScore?: string;
  insurance?: string;
  fuelCost?: string;
  maintenance?: string;
  zip?: string;
  zipCode?: string;
  buyerZip?: string;
  
  // Border proximity / neighboring-state shopping
  nearStateBorder?: string;
  openToOutOfState?: string;
  preferredStates?: string[];
  maxSearchRadiusMiles?: string;
}

/**
 * Maps Henry extraction keys → Deal Room state keys
 * This normalizes synonyms so Henry can use flexible wording without breaking state
 */
const KEY_MAP: Record<string, string> = {
  // Name variations
  userName: "name",
  name: "name",
  
  // ZIP variations
  zip: "buyerZip",
  zipCode: "buyerZip",
  buyerZip: "buyerZip",
  
  // Trade-in variations
  tradeIn: "tradeIn",
  tradeValue: "tradeIn",
  
  // Negotiation variations
  negotiatedPrice: "negotiatedPrice",
  counterPrice: "negotiatedPrice",
  
  // Direct mappings (no change needed)
  askingPrice: "askingPrice",
  outTheDoorPrice: "outTheDoorPrice",
  downPayment: "downPayment",
  monthlyIncome: "monthlyIncome",
  creditScore: "creditScore",
  apr: "apr",
  term: "term",
  monthlyPayment: "monthlyPayment",
  docFee: "docFee",
  dealerFee: "dealerFee",
  addOns: "addOns",
  taxes: "taxes",
  registration: "registration",
  insurance: "insurance",
  fuelCost: "fuelCost",
  maintenance: "maintenance",
  year: "year",
  make: "make",
  model: "model",
  trim: "trim",
  mileage: "mileage",
  vin: "vin",
  isNew: "isNew",
  condition: "condition",
  atDealership: "atDealership",
  dealershipMode: "dealershipMode",
  
  // Border proximity / neighboring-state shopping
  nearStateBorder: "nearStateBorder",
  openToOutOfState: "openToOutOfState",
  preferredStates: "preferredStates",
  maxSearchRadiusMiles: "maxSearchRadiusMiles",
};

/**
 * Keys we intentionally ignore (not stored in Deal Room yet)
 */
const DROP_KEYS = new Set([
  "annualIncome", // We only use monthlyIncome
]);

const DEAL_DATA_MARKER = "[DEAL_EXTRACTED]";
const DEAL_DATA_END_MARKER = "[/DEAL_EXTRACTED]";

// Parse AI response for extracted deal data
export function parseExtractedDealData(content: string): {
  cleanContent: string;
  extractedData: ExtractedDealData | null;
} {
  const startIndex = content.indexOf(DEAL_DATA_MARKER);
  const endIndex = content.indexOf(DEAL_DATA_END_MARKER);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return { cleanContent: content, extractedData: null };
  }

  const jsonStr = content.slice(
    startIndex + DEAL_DATA_MARKER.length,
    endIndex
  ).trim();

  let extractedData: ExtractedDealData | null = null;
  try {
    extractedData = JSON.parse(jsonStr);
  } catch (e) {
    console.error("Failed to parse extracted deal data:", e);
  }

  // Remove the marker section from the displayed content
  const cleanContent = (
    content.slice(0, startIndex) + content.slice(endIndex + DEAL_DATA_END_MARKER.length)
  ).trim();

  return { cleanContent, extractedData };
}

// Format extracted fields for display
export function formatExtractedFields(data: ExtractedDealData): string {
  const parts: string[] = [];
  
  if (data.year || data.make || data.model) {
    const vehicle = [data.year, data.make, data.model, data.trim].filter(Boolean).join(" ");
    parts.push(vehicle);
  }
  
  if (data.askingPrice) {
    parts.push(`$${data.askingPrice}`);
  }
  
  if (data.mileage) {
    parts.push(`${data.mileage} miles`);
  }
  
  if (data.apr) {
    parts.push(`${data.apr}% APR`);
  }
  
  if (data.term) {
    parts.push(`${data.term} months`);
  }
  
  if (data.downPayment) {
    parts.push(`$${data.downPayment} down`);
  }
  
  if (data.monthlyIncome) {
    parts.push(`$${data.monthlyIncome}/mo income`);
  }

  return parts.join(", ");
}

// Get list of extracted field names
export function getExtractedFieldNames(data: ExtractedDealData): string[] {
  const fieldLabels: Record<keyof ExtractedDealData, string> = {
    userName: "Name",
    name: "Name",
    atDealership: "At Dealership",
    dealershipMode: "Dealership Mode",
    year: "Year",
    make: "Make",
    model: "Model",
    trim: "Trim",
    mileage: "Mileage",
    vin: "VIN",
    isNew: "New/Used",
    condition: "Condition",
    askingPrice: "Asking Price",
    negotiatedPrice: "Negotiated Price",
    counterPrice: "Counter Price",
    outTheDoorPrice: "Out-the-Door Price",
    downPayment: "Down Payment",
    tradeIn: "Trade-In",
    tradeValue: "Trade Value",
    apr: "APR",
    term: "Term",
    monthlyPayment: "Monthly Payment",
    docFee: "Doc Fee",
    dealerFee: "Dealer Fee",
    addOns: "Add-Ons",
    taxes: "Taxes",
    registration: "Registration",
    monthlyIncome: "Monthly Income",
    annualIncome: "Annual Income",
    creditScore: "Credit Score",
    insurance: "Insurance",
    fuelCost: "Fuel Cost",
    maintenance: "Maintenance",
    zip: "ZIP Code",
    zipCode: "ZIP Code",
    buyerZip: "ZIP Code",
    // Border proximity / neighboring-state shopping
    nearStateBorder: "Near State Border",
    openToOutOfState: "Open to Out-of-State",
    preferredStates: "Preferred States",
    maxSearchRadiusMiles: "Search Radius",
  };

  return Object.entries(data)
    .filter(([_, value]) => value !== undefined && value !== null && value !== "")
    .map(([key]) => fieldLabels[key as keyof ExtractedDealData] || key);
}

/**
 * Normalizes extracted data keys using KEY_MAP
 * This ensures Henry can use flexible wording without breaking state
 */
function normalizeExtractedData(extractedData: ExtractedDealData): Record<string, string> {
  const normalized: Record<string, string> = {};
  
  Object.entries(extractedData).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (DROP_KEYS.has(key)) return;
    
    // Get the normalized key, or use original if not in map
    const targetKey = KEY_MAP[key] ?? key;
    
    // Convert to string and store
    normalized[targetKey] = String(value);
  });
  
  return normalized;
}

// Custom hook for managing deal extraction state
export function useDealExtraction() {
  const applyExtractedData = useCallback(
    (
      extractedData: ExtractedDealData,
      setDealData: React.Dispatch<React.SetStateAction<any>>,
      setExtractedFields?: React.Dispatch<React.SetStateAction<Set<string>>>
    ) => {
      const newExtractedFields = new Set<string>();
      
      // Normalize the data using KEY_MAP
      const normalized = normalizeExtractedData(extractedData);

      setDealData((prev: any) => {
        const updated = { ...prev };

        Object.entries(normalized).forEach(([key, value]) => {
          updated[key] = value;
          newExtractedFields.add(key);
        });

        return updated;
      });

      if (setExtractedFields) {
        setExtractedFields((prev) => new Set([...prev, ...newExtractedFields]));
      }

      return newExtractedFields;
    },
    []
  );

  return { applyExtractedData };
}
