import { NextResponse } from "next/server";
import { channelRegistry } from "@routie/publishers";
import { requireSession } from "@/lib/auth";
import { apiError } from "@/lib/http";

export async function GET() {
  try {
    await requireSession();
    return NextResponse.json({ channels: channelRegistry() });
  } catch (error) {
    return apiError(error);
  }
}
