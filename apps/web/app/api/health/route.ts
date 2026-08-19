import { NextResponse } from "next/server";
import { providerRegistry } from "@routie/providers";
import { channelRegistry } from "@routie/publishers";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "routie-web",
    timestamp: new Date().toISOString(),
    aiProviders: providerRegistry().map(({ provider, models }) => ({ provider, models: models.length })),
    socialChannels: channelRegistry()
  });
}
