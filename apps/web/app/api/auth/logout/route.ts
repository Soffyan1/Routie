import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { serverEnv } from "@/lib/env";

export async function GET(request: NextRequest) {
  const env = serverEnv();
  const sessionExpired = request.nextUrl.searchParams.get("reason") === "session-expired";
  const destination = sessionExpired
    ? "/login?reason=session-expired"
    : "/login?message=Anda+telah+berhasil+keluar.";
  const response = NextResponse.redirect(new URL(destination, env.APP_URL));
  response.cookies.delete(SESSION_COOKIE);
  return response;
}

export async function POST(request: NextRequest) {
  const env = serverEnv();
  const response = NextResponse.json({ success: true, message: "Berhasil logout." });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
