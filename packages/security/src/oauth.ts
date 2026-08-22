export interface GoogleTokenRefreshResult {
  accessToken: string;
  expiresAt: Date;
}

export interface ThreadsTokenRefreshResult {
  accessToken: string;
  expiresAt: Date;
}

export interface TikTokTokenRefreshResult {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  refreshExpiresAt: Date | null;
}

export class GoogleOAuthError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly permanent: boolean
  ) {
    super(message);
    this.name = "GoogleOAuthError";
  }
}

export class ThreadsOAuthError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly permanent: boolean
  ) {
    super(message);
    this.name = "ThreadsOAuthError";
  }
}

export class TikTokOAuthError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly permanent: boolean
  ) {
    super(message);
    this.name = "TikTokOAuthError";
  }
}

export function tokenNeedsRefresh(expiresAt: Date | null | undefined, now = new Date(), bufferMs = 5 * 60 * 1000): boolean {
  return Boolean(expiresAt && expiresAt.getTime() <= now.getTime() + bufferMs);
}

export async function refreshGoogleAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<GoogleTokenRefreshResult> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken
    }).toString()
  });
  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || payload.error || !payload.access_token) {
    const code = payload.error ?? "google_token_refresh_failed";
    const permanent = ["invalid_grant", "unauthorized_client", "access_denied"].includes(code);
    throw new GoogleOAuthError(
      permanent ? "Google authorization requires user action" : "Google token refresh failed",
      code,
      permanent
    );
  }

  return {
    accessToken: payload.access_token,
    expiresAt: new Date(Date.now() + (payload.expires_in ?? 3600) * 1000)
  };
}

export async function refreshThreadsAccessToken(accessToken: string): Promise<ThreadsTokenRefreshResult> {
  const url = new URL("https://graph.threads.net/refresh_access_token");
  url.search = new URLSearchParams({
    grant_type: "th_refresh_token",
    access_token: accessToken
  }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string; code?: number; error_subcode?: number };
  };
  if (!response.ok || payload.error || !payload.access_token) {
    const numericCode = payload.error?.code;
    const code = numericCode ? `THREADS_${numericCode}` : `HTTP_${response.status}`;
    const permanent = response.status === 400 || response.status === 401 || response.status === 403 || numericCode === 190;
    throw new ThreadsOAuthError(
      permanent ? "Threads authorization requires user action" : "Threads token refresh failed",
      code,
      permanent
    );
  }
  return {
    accessToken: payload.access_token,
    expiresAt: new Date(Date.now() + (payload.expires_in ?? 5_184_000) * 1_000)
  };
}

/**
 * TikTok access tokens are intentionally short lived. TikTok may rotate the
 * refresh token, so callers must persist the value returned by this function.
 */
export async function refreshTikTokAccessToken(
  refreshToken: string,
  clientKey: string,
  clientSecret: string
): Promise<TikTokTokenRefreshResult> {
  let response: Response;
  try {
    response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken
      }).toString(),
      signal: AbortSignal.timeout(30_000)
    });
  } catch {
    throw new TikTokOAuthError("TikTok token refresh failed", "TIKTOK_NETWORK_ERROR", false);
  }

  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    refresh_expires_in?: number;
    error?: { code?: string | number; message?: string };
    error_description?: string;
  };
  const errorCode = String(payload.error?.code ?? "").toLowerCase();
  const permanentCodes = new Set(["access_token_invalid", "invalid_grant", "invalid_request", "unauthorized_client"]);
  const permanent = response.status === 400 || response.status === 401 || response.status === 403 || permanentCodes.has(errorCode);
  if (!response.ok || payload.error || !payload.access_token) {
    throw new TikTokOAuthError(
      permanent ? "TikTok authorization requires user action" : "TikTok token refresh failed",
      errorCode || `HTTP_${response.status}`,
      permanent
    );
  }

  return {
    accessToken: payload.access_token,
    // TikTok permits token rotation. Preserve the old token only when the API
    // does not send a replacement.
    refreshToken: payload.refresh_token || refreshToken,
    expiresAt: new Date(Date.now() + (payload.expires_in ?? 86_400) * 1_000),
    refreshExpiresAt: payload.refresh_expires_in
      ? new Date(Date.now() + payload.refresh_expires_in * 1_000)
      : null
  };
}
