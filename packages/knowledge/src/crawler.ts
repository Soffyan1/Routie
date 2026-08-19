import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { assertSafePublicUrl } from "@routie/security";

function privateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number) as [number, number, number, number];
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  const value = address.toLowerCase();
  return value === "::1" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80") || value.startsWith("::ffff:127.");
}

async function assertPublicDns(url: URL): Promise<void> {
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => privateAddress(address))) throw new Error("URL resolves to a private or unavailable address");
}

function htmlToText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/\s+/g, " ")
    .trim();
}

export async function crawlPublicPage(value: string, maxBytes = 2_000_000, redirectsRemaining = 5): Promise<{ url: string; title: string; text: string }> {
  const url = assertSafePublicUrl(value);
  await assertPublicDns(url);
  const response = await fetch(url, {
    headers: { "User-Agent": "RoutieBrandCrawler/1.0 (+https://routie.app/crawler)" },
    redirect: "manual",
    signal: AbortSignal.timeout(15_000)
  });
  if (response.status >= 300 && response.status < 400) {
    if (redirectsRemaining <= 0) throw new Error("Crawler redirect limit exceeded");
    const location = response.headers.get("location");
    if (!location) throw new Error("Crawler received an invalid redirect");
    return crawlPublicPage(new URL(location, url).toString(), maxBytes, redirectsRemaining - 1);
  }
  if (!response.ok) throw new Error(`Crawler request failed (${response.status})`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) throw new Error("Brand crawler only accepts HTML pages");
  const declaredSize = Number(response.headers.get("content-length") ?? 0);
  if (declaredSize > maxBytes) throw new Error("Page exceeds crawler size limit");
  const html = (await response.text()).slice(0, maxBytes);
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.replace(/\s+/g, " ").trim() ?? url.hostname;
  return { url: url.toString(), title, text: htmlToText(html) };
}
