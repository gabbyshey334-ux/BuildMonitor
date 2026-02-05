/**
 * JWT Token Management
 * Stores and retrieves authentication tokens from localStorage
 */

const TOKEN_KEY = 'auth_token';

/**
 * Store JWT token in localStorage
 */
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  console.log('[AuthToken] Token stored');
}

/**
 * Get JWT token from localStorage
 */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Remove JWT token from localStorage
 */
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  console.log('[AuthToken] Token cleared');
}

/**
 * Check if user has a token (is authenticated)
 */
export function hasToken(): boolean {
  return !!getToken();
}

