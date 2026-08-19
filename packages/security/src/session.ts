import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { workspaceRoleSchema } from "@routie/domain";

const sessionSchema = z.object({
  sub: z.string().min(1),
  workspaceId: z.string().min(1),
  role: workspaceRoleSchema,
  email: z.email()
});

export type SessionClaims = z.infer<typeof sessionSchema>;

function key(secret: string) {
  if (secret.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters");
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(claims: SessionClaims, secret: string, expiresIn = "8h"): Promise<string> {
  return new SignJWT({ workspaceId: claims.workspaceId, role: claims.role, email: claims.email })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .setIssuer("routie")
    .setAudience("routie-web")
    .sign(key(secret));
}

export async function verifySessionToken(token: string, secret: string): Promise<SessionClaims> {
  const { payload } = await jwtVerify(token, key(secret), { issuer: "routie", audience: "routie-web" });
  return sessionSchema.parse(payload);
}
