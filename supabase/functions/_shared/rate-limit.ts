// Simple in-memory rate limiter for edge functions
// Uses a Map to track request counts per IP with automatic cleanup

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (resets on function cold start, which is acceptable for basic rate limiting)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupExpiredEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  
  lastCleanup = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}

export interface RateLimitConfig {
  maxRequests: number;    // Maximum requests allowed
  windowMs: number;       // Time window in milliseconds
  keyPrefix?: string;     // Optional prefix for the key (e.g., function name)
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check if a request is allowed based on rate limiting rules
 * @param clientIP - The client's IP address
 * @param config - Rate limit configuration
 * @returns RateLimitResult with allowed status and metadata
 */
export function checkRateLimit(clientIP: string, config: RateLimitConfig): RateLimitResult {
  cleanupExpiredEntries();
  
  const key = config.keyPrefix ? `${config.keyPrefix}:${clientIP}` : clientIP;
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  
  // No existing entry or expired entry
  if (!entry || entry.resetAt < now) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + config.windowMs,
    };
    rateLimitStore.set(key, newEntry);
    
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: newEntry.resetAt,
    };
  }
  
  // Entry exists and is still valid
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }
  
  // Increment counter
  entry.count++;
  
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Get client IP from request headers
 * Checks common proxy headers first, falls back to connection info
 */
export function getClientIP(req: Request): string {
  // Check Cloudflare header first
  const cfIP = req.headers.get("cf-connecting-ip");
  if (cfIP) return cfIP;
  
  // Check X-Forwarded-For (may contain multiple IPs)
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const ips = forwardedFor.split(",").map(ip => ip.trim());
    return ips[0]; // First IP is the original client
  }
  
  // Check X-Real-IP
  const realIP = req.headers.get("x-real-ip");
  if (realIP) return realIP;
  
  // Fallback to a hash of user-agent + timestamp for some uniqueness
  return "unknown-" + (req.headers.get("user-agent") || "").slice(0, 20);
}

/**
 * Create rate limit headers for the response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": Math.ceil(result.resetAt / 1000).toString(),
  };
}

/**
 * Create a rate limit exceeded response
 */
export function rateLimitExceededResponse(result: RateLimitResult, corsHeaders: Record<string, string>): Response {
  const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
  
  return new Response(
    JSON.stringify({ 
      error: "Too many requests. Please try again later.",
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": retryAfter.toString(),
        ...getRateLimitHeaders(result),
      },
    }
  );
}
