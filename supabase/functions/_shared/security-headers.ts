// Security headers for edge functions
// These headers provide defense-in-depth against common web vulnerabilities

/**
 * Standard security headers for API responses
 * @param additionalHeaders - Additional CORS or custom headers to merge
 */
export function getSecurityHeaders(additionalHeaders: Record<string, string> = {}): Record<string, string> {
  return {
    // Prevent MIME type sniffing
    "X-Content-Type-Options": "nosniff",
    
    // Prevent clickjacking
    "X-Frame-Options": "DENY",
    
    // Enable XSS filter in older browsers
    "X-XSS-Protection": "1; mode=block",
    
    // Disable caching for API responses with sensitive data
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
    
    // Prevent referrer leakage
    "Referrer-Policy": "strict-origin-when-cross-origin",
    
    // Content Security Policy for API responses
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    
    // Permissions Policy (formerly Feature Policy)
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    
    // Merge with additional headers (CORS, Content-Type, etc.)
    ...additionalHeaders,
  };
}

/**
 * Create CORS headers with security headers included
 */
export function getCorsWithSecurityHeaders(): Record<string, string> {
  return getSecurityHeaders({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  });
}

/**
 * Create a JSON response with security headers
 */
export function secureJsonResponse(
  data: unknown,
  status = 200,
  additionalHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: getSecurityHeaders({
      "Content-Type": "application/json",
      ...additionalHeaders,
    }),
  });
}

/**
 * Create an error response with security headers
 */
export function secureErrorResponse(
  error: string,
  status = 500,
  additionalHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: getSecurityHeaders({
      "Content-Type": "application/json",
      ...additionalHeaders,
    }),
  });
}
