 // makeResolver.ts - Enhanced fuzzy make resolution with Jaro-Winkler
 
 export type MakeResolution =
   | { type: "confirmed"; make: string; confidence: number; token: string }
   | { type: "suggest_one"; suggestion: string; confidence: number; token: string }
   | { type: "suggest_many"; options: { make: string; score: number }[]; token: string }
   | { type: "no_match"; token: string };
 
 // Canonical makes list
 export const MAKES = [
   "Acura", "Alfa Romeo", "Aston Martin", "Audi", "Bentley", "BMW", "Buick",
   "Cadillac", "Chevrolet", "Chrysler", "Dodge", "Ferrari", "Fiat", "Ford",
   "Genesis", "GMC", "Honda", "Hyundai", "Infiniti", "Jaguar", "Jeep", "Kia",
   "Lamborghini", "Land Rover", "Lexus", "Lincoln", "Lucid", "Maserati",
   "Mazda", "McLaren", "Mercedes-Benz", "Mini", "Mitsubishi", "Nissan",
   "Polestar", "Porsche", "Ram", "Rivian", "Rolls-Royce", "Subaru", "Tesla",
   "Toyota", "Volkswagen", "Volvo",
 ];
 
 const DEFAULT_ALIASES: Record<string, string> = {
   // Common typos and shortcuts
   telsa: "Tesla",
   murcedes: "Mercedes-Benz",
   mercedez: "Mercedes-Benz",
   mercedesbenz: "Mercedes-Benz",
   mercedes: "Mercedes-Benz",
   merc: "Mercedes-Benz",
   benz: "Mercedes-Benz",
   hyundia: "Hyundai",
   hundai: "Hyundai",
   toyta: "Toyota",
   toyata: "Toyota",
   chev: "Chevrolet",
   chevy: "Chevrolet",
   vw: "Volkswagen",
   land: "Land Rover",
   range: "Land Rover",
   rover: "Land Rover",
   alfa: "Alfa Romeo",
   aston: "Aston Martin",
   rolls: "Rolls-Royce",
   lambo: "Lamborghini",
   // Ambiguous cases - handled specially
   hondai: "__AMBIG__HONDA_HYUNDAI__",
 };
 
 // --- Public API ---
 export function resolveMakeFromUserText(args: {
   userText: string;
   makes?: string[];
   aliases?: Record<string, string>;
 }): MakeResolution {
   const makes = args.makes ?? MAKES;
   const aliases = { ...DEFAULT_ALIASES, ...(args.aliases ?? {}) };
 
   const token = extractMakeToken(args.userText);
   if (!token) return { type: "no_match", token: "" };
 
   const normToken = normalize(token);
 
   // 1) Exact match first
   const exactMatch = makes.find((m) => normalize(m) === normToken);
   if (exactMatch) {
     return { type: "confirmed", make: exactMatch, confidence: 1.0, token };
   }
 
   // 2) Alias short-circuit
   const aliasHit = aliases[normToken];
   if (aliasHit) {
     if (aliasHit.startsWith("__AMBIG__")) {
       // Handle ambiguous cases like "hondai" → Honda or Hyundai?
       const options = ["Honda", "Hyundai"]
         .map((m) => ({ make: m, score: 0.99 }))
         .filter((o) => makes.some((mm) => normalize(mm) === normalize(o.make)));
       return { type: "suggest_many", options, token };
     }
     return { type: "confirmed", make: aliasHit, confidence: 0.99, token };
   }
 
   // 3) Fuzzy rank makes using Jaro-Winkler
   const ranked = makes
     .map((make) => ({
       make,
       score: jaroWinkler(normToken, normalize(make)),
     }))
     .sort((a, b) => b.score - a.score);
 
   const best = ranked[0];
   const second = ranked[1];
   const third = ranked[2];
 
   if (!best) return { type: "no_match", token };
 
   // Threshold tuning
   const STRONG_ONE = 0.88; // clearly a make
   const GOOD = 0.82;       // usable suggestion tier
   const SECOND_OK = 0.78;  // for 2-option confirm
   const MARGIN_CLEAR = 0.08;
   const MARGIN_TIGHT = 0.06;
 
   // A) Strong and clearly best → suggest one
   if (best.score >= STRONG_ONE && second && best.score - second.score >= MARGIN_CLEAR) {
     return { type: "suggest_one", suggestion: best.make, confidence: best.score, token };
   }
 
   // B) Two strong contenders close together → suggest many
   if (
     best.score >= GOOD &&
     second &&
     second.score >= SECOND_OK &&
     best.score - second.score <= MARGIN_TIGHT
   ) {
     const options = [best, second]
       .concat(third && third.score >= SECOND_OK ? [third] : [])
       .slice(0, 3);
     return { type: "suggest_many", options, token };
   }
 
   // C) Best is decent but not decisive → suggest one
   if (best.score >= GOOD && (!second || best.score - second.score >= MARGIN_TIGHT)) {
     return { type: "suggest_one", suggestion: best.make, confidence: best.score, token };
   }
 
   // D) Too weak → no match
   return { type: "no_match", token };
 }
 
 /**
  * Format make options for display
  * "Honda or Hyundai?" or "Honda, Hyundai, or Kia?"
  */
 export function formatMakeOptions(options: { make: string }[]): string {
   const names = options.map((o) => o.make);
   if (names.length === 2) return `${names[0]} or ${names[1]}`;
   if (names.length === 3) return `${names[0]}, ${names[1]}, or ${names[2]}`;
   return names[0] ?? "";
 }
 
 // --- Helpers ---
 
 /**
  * Extract likely make token from free-form user text.
  */
 export function extractMakeToken(input: string): string {
   if (!input) return "";
 
   const raw = input.trim();
 
   // Strip punctuation but keep letters/numbers/spaces/hyphens
   const cleaned = raw.replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();
 
   // Common lead-in patterns
   const patterns: RegExp[] = [
     /\b(?:looking at|considering|shopping|buying|want|wanna|interested in)\s+([a-z0-9-]+)/i,
     /\b(?:it'?s|its|a|an)\s+(\d{4})\s+([a-z0-9-]+)/i,
     /^\s*([a-z0-9-]+)\s*$/i, // single word input
   ];
 
   for (const re of patterns) {
     const m = cleaned.match(re);
     if (m) {
       const candidate = m[m.length - 1];
       if (candidate) return candidate;
     }
   }
 
   // Fallback: first capitalized word or last word
   const words = cleaned.split(" ").filter(Boolean);
   const capitalized = words.find((w) => /^[A-Z]/.test(w));
   if (capitalized) return capitalized;
 
   return words[words.length - 1] || "";
 }
 
 function normalize(s: string): string {
   return (s || "")
     .toLowerCase()
     .replace(/[-]/g, " ")
     .replace(/\s+/g, " ")
     .trim();
 }
 
 /**
  * Jaro-Winkler similarity [0..1]
  * Better for typos + transpositions than Levenshtein
  */
 function jaroWinkler(a: string, b: string): number {
   if (a === b) return 1;
   if (!a || !b) return 0;
 
   const matchDistance = Math.floor(Math.max(a.length, b.length) / 2) - 1;
 
   const aMatches = new Array(a.length).fill(false);
   const bMatches = new Array(b.length).fill(false);
 
   let matches = 0;
   for (let i = 0; i < a.length; i++) {
     const start = Math.max(0, i - matchDistance);
     const end = Math.min(i + matchDistance + 1, b.length);
     for (let j = start; j < end; j++) {
       if (bMatches[j]) continue;
       if (a[i] !== b[j]) continue;
       aMatches[i] = true;
       bMatches[j] = true;
       matches++;
       break;
     }
   }
 
   if (matches === 0) return 0;
 
   // Count transpositions
   let k = 0;
   let transpositions = 0;
   for (let i = 0; i < a.length; i++) {
     if (!aMatches[i]) continue;
     while (!bMatches[k]) k++;
     if (a[i] !== b[k]) transpositions++;
     k++;
   }
   transpositions /= 2;
 
   const jaro =
     (matches / a.length + matches / b.length + (matches - transpositions) / matches) / 3;
 
   // Winkler boost for common prefix
   let prefix = 0;
   const maxPrefix = 4;
   for (let i = 0; i < Math.min(maxPrefix, a.length, b.length); i++) {
     if (a[i] === b[i]) prefix++;
     else break;
   }
 
   const scaling = 0.1;
   return jaro + prefix * scaling * (1 - jaro);
 }