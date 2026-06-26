/**
 * Rekura — Centralized API Utility
 * 
 * All frontend API calls go through this module.
 * Handles:
 * - JWT expiry detection (checks `exp` before sending)
 * - Automatic 401 handling (clears stale auth, triggers re-auth)
 * - Centralized base URL management
 * - Authorization header injection
 */

import toast from 'react-hot-toast';

const RAW_API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '');
const ENV_API_URL = RAW_API_URL.replace(/\/$/, '');
export const API_BASE = `${ENV_API_URL}/api/v1`;

// ============================================================
// JWT TOKEN HELPERS
// ============================================================

/**
 * Decode a JWT payload without a library.
 * JWTs are base64url-encoded JSON: header.payload.signature
 */
function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // base64url → base64 → decode
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Check if the stored JWT token is still valid (not expired).
 * Returns false if token is missing, malformed, or expired.
 * Includes a 30-second buffer so we don't send a token that's about to expire.
 */
export function isTokenValid(): boolean {
  const token = localStorage.getItem('recurra_token');
  if (!token) return false;

  const payload = decodeJwtPayload(token);
  if (!payload || !payload.exp) return false;

  // exp is in seconds, Date.now() is in milliseconds
  // Add 30-second buffer to avoid edge cases where token expires mid-request
  const expiresAt = payload.exp * 1000;
  const bufferMs = 30_000;

  return Date.now() < (expiresAt - bufferMs);
}

/**
 * Get the stored token, or null if it's expired/missing.
 */
export function getValidToken(): string | null {
  if (!isTokenValid()) {
    return null;
  }
  return localStorage.getItem('recurra_token');
}

// ============================================================
// SESSION EXPIRY HANDLER
// ============================================================

// Prevent multiple expiry toasts from firing simultaneously
let sessionExpiredHandled = false;

/**
 * Called when we detect the session has expired (either client-side check
 * or server 401 response). Clears stale tokens and notifies the user.
 */
export function handleSessionExpired(reason: 'expired' | 'invalid' = 'expired'): void {
  // Only show the toast once per expiry cycle
  if (sessionExpiredHandled) return;
  sessionExpiredHandled = true;

  // Clear stale tokens
  localStorage.removeItem('recurra_token');

  const message = reason === 'expired'
    ? 'Session expired. Please reconnect your wallet.'
    : 'Session invalid. Please reconnect your wallet.';

  toast.error(message, { id: 'session-expired', duration: 2000 });

  // Reset the guard after 5 seconds so future expiries can show toast again
  setTimeout(() => {
    sessionExpiredHandled = false;
  }, 5000);
}

// ============================================================
// API FETCH WRAPPER
// ============================================================

interface ApiOptions extends Omit<RequestInit, 'headers'> {
  /** If true, skip authentication (for public endpoints like GET /plans) */
  public?: boolean;
  /** Additional headers to merge */
  headers?: Record<string, string>;
}

interface ApiResponse<T = any> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
}

/**
 * Centralized fetch wrapper for all Rekura API calls.
 * 
 * - Checks token validity BEFORE sending (prevents 401 flood)
 * - Injects Authorization header automatically
 * - Handles 401 responses (clears stale state)
 * - Returns a consistent response shape
 * 
 * @example
 * const { ok, data, error } = await api('/merchant/plans');
 * const { ok, data } = await api('/webhooks', { method: 'POST', body: JSON.stringify({...}) });
 * const { ok, data } = await api('/plans', { public: true }); // no auth needed
 */
export async function api<T = any>(
  path: string,
  options: ApiOptions = {}
): Promise<ApiResponse<T>> {
  const { public: isPublic = false, headers: extraHeaders = {}, ...fetchOptions } = options;

  // For authenticated endpoints, check token BEFORE making the request
  if (!isPublic) {
    const token = getValidToken();
    if (!token) {
      handleSessionExpired('expired');
      return { ok: false, status: 401, data: null, error: 'Session expired' };
    }

    extraHeaders['Authorization'] = `Bearer ${token}`;
  }

  // Ensure Content-Type for requests with body
  if (fetchOptions.body && !extraHeaders['Content-Type']) {
    extraHeaders['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      headers: extraHeaders,
    });

    // Handle 401 from server (e.g., token was tampered with or revoked)
    if (response.status === 401) {
      handleSessionExpired('invalid');
      return { ok: false, status: 401, data: null, error: 'Authentication failed' };
    }

    // Parse response
    let data: T | null = null;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      data = await response.json();
    }

    if (!response.ok) {
      // Build a meaningful error message, especially for validation errors
      let errorMessage = (data as any)?.error || `Request failed (${response.status})`;
      
      // If Zod validation details are present, include the specific field errors
      const details = (data as any)?.details;
      if (details && Array.isArray(details) && details.length > 0) {
        const fieldErrors = details.map((d: any) => `${d.field}: ${d.message}`).join(', ');
        errorMessage = `${errorMessage} — ${fieldErrors}`;
      }
      
      return { ok: false, status: response.status, data, error: errorMessage };
    }

    return { ok: true, status: response.status, data, error: null };
  } catch (e: any) {
    console.error(`API call failed: ${path}`, e);
    return { ok: false, status: 0, data: null, error: e.message || 'Network error' };
  }
}
