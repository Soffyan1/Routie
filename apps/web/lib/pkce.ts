import { createHash, randomBytes } from "node:crypto";

/**
 * Generate a high-entropy cryptographic random string for PKCE code_verifier.
 * RFC 7636 recommends 43-128 characters using unreserved characters.
 */
export function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Generate S256 code_challenge from code_verifier:
 * BASE64URL-ENCODE(SHA256(ASCII(code_verifier)))
 */
export function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/**
 * Generate random state string to mitigate CSRF attacks.
 */
export function generateState(): string {
  return randomBytes(16).toString("hex");
}

export const TIKTOK_OAUTH_COOKIE = "routie_tiktok_oauth";
export const YOUTUBE_OAUTH_COOKIE = "routie_youtube_oauth";
export const GOOGLE_LOGIN_OAUTH_COOKIE = "routie_google_login_oauth";
export const META_OAUTH_COOKIE = "routie_meta_oauth";
export const META_SELECTION_COOKIE = "routie_meta_selection";
export const THREADS_OAUTH_COOKIE = "routie_threads_oauth";
