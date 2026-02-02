// VIN validation and extraction utilities

export function normalizeVin(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// VINs are 17 chars; do not allow I, O, Q
export function isValidVin(vin: string): boolean {
  if (!vin) return false;
  if (vin.length !== 17) return false;
  if (/[IOQ]/.test(vin)) return false;
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin);
}

// Extract VIN from text (user message, OCR result, etc.)
export function extractVin(text: string): string | null {
  if (!text) return null;

  // Common patterns: "VIN: XXXXX", or plain 17-char string
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

  // Fallback regex scan for 17-char VIN-like sequences
  const match = text.toUpperCase().match(/[A-HJ-NPR-Z0-9]{17}/g);
  if (match) {
    for (const m of match) {
      const vin = normalizeVin(m);
      if (isValidVin(vin)) return vin;
    }
  }

  return null;
}

// NHTSA VIN decode response type
export interface NhtsaDecodeResult {
  ModelYear?: string;
  Make?: string;
  Model?: string;
  Trim?: string;
  Trim2?: string;
  BodyClass?: string;
  DriveType?: string;
  EngineCylinders?: string;
  FuelTypePrimary?: string;
  ErrorCode?: string;
  ErrorText?: string;
  [key: string]: string | undefined;
}

// Decode VIN using NHTSA API (client-side)
export async function decodeVinWithNhtsa(vin: string): Promise<NhtsaDecodeResult | null> {
  if (!isValidVin(vin)) return null;

  try {
    const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${vin}?format=json`;
    const res = await fetch(url);
    
    if (!res.ok) return null;

    const json = await res.json();
    const row = json?.Results?.[0];
    
    if (!row) return null;
    
    // Check for NHTSA error codes (0 = decoded ok)
    if (row.ErrorCode && row.ErrorCode !== "0") {
      console.warn("NHTSA decode warning:", row.ErrorCode, row.ErrorText);
    }

    return row as NhtsaDecodeResult;
  } catch (error) {
    console.error("NHTSA VIN decode failed:", error);
    return null;
  }
}

// Map NHTSA decode result to deal context fields
export function mapNhtsaToDealContext(decoded: NhtsaDecodeResult): {
  year?: string;
  make?: string;
  model?: string;
  trim?: string;
} {
  const result: {
    year?: string;
    make?: string;
    model?: string;
    trim?: string;
  } = {};

  if (decoded.ModelYear) result.year = decoded.ModelYear;
  if (decoded.Make) result.make = decoded.Make;
  if (decoded.Model) result.model = decoded.Model;
  
  // Trim can come from Trim or Trim2 field
  const decodedTrim = (decoded.Trim || decoded.Trim2 || "").trim();
  if (decodedTrim) result.trim = decodedTrim;

  return result;
}
