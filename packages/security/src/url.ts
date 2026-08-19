import { isIP } from "node:net";

const blockedNames = new Set(["localhost", "localhost.localdomain", "metadata.google.internal"]);

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts as [number, number, number, number];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

export function assertSafePublicUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only HTTP(S) URLs are allowed");
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (blockedNames.has(hostname) || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new Error("Private hostnames are not allowed");
  }
  if (isIP(hostname) === 4 && isPrivateIpv4(hostname)) throw new Error("Private IP addresses are not allowed");
  if (isIP(hostname) === 6 && (hostname === "::1" || hostname.startsWith("fc") || hostname.startsWith("fd") || hostname.startsWith("fe80"))) {
    throw new Error("Private IP addresses are not allowed");
  }
  if (url.username || url.password) throw new Error("Credentials in URLs are not allowed");
  return url;
}
