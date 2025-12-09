// Input validation utilities for edge functions
// Simple validation without external dependencies

/**
 * Validate email format using a comprehensive regex
 */
export function isValidEmail(email: unknown): email is string {
  if (typeof email !== "string") return false;
  if (email.length > 254) return false; // Max email length per RFC
  
  // Standard email regex pattern
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  return emailRegex.test(email);
}

/**
 * Validate UUID format
 */
export function isValidUUID(id: unknown): id is string {
  if (typeof id !== "string") return false;
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Validate non-empty string with max length
 */
export function isValidString(value: unknown, maxLength = 1000): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

/**
 * Validate number within range
 */
export function isValidNumber(value: unknown, min = -Infinity, max = Infinity): value is number {
  return typeof value === "number" && !isNaN(value) && value >= min && value <= max;
}

/**
 * Sanitize string for safe HTML insertion (basic XSS prevention)
 */
export function sanitizeForHtml(str: string): string {
  if (typeof str !== "string") return "";
  
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Validate reminder type enum
 */
export function isValidReminderType(type: unknown): type is "session_starting" | "session_claimed" | "session_scheduled" {
  return type === "session_starting" || type === "session_claimed" || type === "session_scheduled";
}

/**
 * Validation result type
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Create validation error response
 */
export function validationErrorResponse(errors: ValidationError[], corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ 
      error: "Validation failed",
      details: errors,
    }),
    {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    }
  );
}
