import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";

const oauthProviderSchema = z.enum(["META", "THREADS", "TIKTOK"]);
const oauthIntentSchema = z.enum(["FACEBOOK", "INSTAGRAM", "THREADS", "TIKTOK"]);
const oauthStateSchema = z.object({
  sub: z.string().uuid(),
  workspaceId: z.string().uuid(),
  provider: oauthProviderSchema,
  intent: oauthIntentSchema,
  redirectUri: z.url()
});

export type OAuthStateClaims = z.infer<typeof oauthStateSchema>;

function oauthKey(secret: string): Uint8Array {
  if (secret.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters");
  return new TextEncoder().encode(secret);
}

export async function createOAuthStateToken(
  claims: OAuthStateClaims,
  secret: string,
  expiresIn = "10m"
): Promise<string> {
  const parsed = oauthStateSchema.parse(claims);
  return new SignJWT({
    workspaceId: parsed.workspaceId,
    provider: parsed.provider,
    intent: parsed.intent,
    redirectUri: parsed.redirectUri
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(parsed.sub)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .setIssuer("routie")
    .setAudience("routie-social-oauth")
    .sign(oauthKey(secret));
}

export async function verifyOAuthStateToken(token: string, secret: string): Promise<OAuthStateClaims> {
  const { payload } = await jwtVerify(token, oauthKey(secret), {
    issuer: "routie",
    audience: "routie-social-oauth"
  });
  return oauthStateSchema.parse(payload);
}
