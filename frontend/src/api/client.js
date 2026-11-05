/**
 * Centralized API Client Configuration and Base Fetch Utility
 */
export const API_BASE = 'http://127.0.0.1:8000';

/**
 * Standard fetch wrapper with JSON parsing and standardized error handling.
 */
export async function fetchJson(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    let errorDetail = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const errData = await res.json();
      if (errData && errData.detail) {
        errorDetail = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
      }
    } catch {
      // Fallback to text or status
    }
    const err = new Error(errorDetail);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

