import { useCallback } from "react";

export interface ExtractedDealData {
  year?: string;
  make?: string;
  model?: string;
  trim?: string;
  mileage?: string;
  vin?: string;
  askingPrice?: string;
  negotiatedPrice?: string;
  downPayment?: string;
  tradeIn?: string;
  apr?: string;
  term?: string;
  docFee?: string;
  dealerFee?: string;
  addOns?: string;
  taxes?: string;
  registration?: string;
  monthlyIncome?: string;
  creditScore?: string;
  insurance?: string;
  fuelCost?: string;
  maintenance?: string;
}

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
    year: "Year",
    make: "Make",
    model: "Model",
    trim: "Trim",
    mileage: "Mileage",
    vin: "VIN",
    askingPrice: "Asking Price",
    negotiatedPrice: "Negotiated Price",
    downPayment: "Down Payment",
    tradeIn: "Trade-In",
    apr: "APR",
    term: "Term",
    docFee: "Doc Fee",
    dealerFee: "Dealer Fee",
    addOns: "Add-Ons",
    taxes: "Taxes",
    registration: "Registration",
    monthlyIncome: "Monthly Income",
    creditScore: "Credit Score",
    insurance: "Insurance",
    fuelCost: "Fuel Cost",
    maintenance: "Maintenance",
  };

  return Object.entries(data)
    .filter(([_, value]) => value !== undefined && value !== null && value !== "")
    .map(([key]) => fieldLabels[key as keyof ExtractedDealData] || key);
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

      setDealData((prev: any) => {
        const updated = { ...prev };

        Object.entries(extractedData).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            updated[key] = String(value);
            newExtractedFields.add(key);
          }
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
