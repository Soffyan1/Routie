import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function apiError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "VALIDATION_ERROR", issues: error.issues }, { status: 400 });
  }
  const message = error instanceof Error ? error.message : "Unexpected server error";
  if (/access denied|unauthorized|session|"exp" claim timestamp/i.test(message)) return NextResponse.json({ error: "UNAUTHORIZED", message }, { status: 401 });
  if (/cannot|forbidden|read-only|inactive/i.test(message)) return NextResponse.json({ error: "FORBIDDEN", message }, { status: 403 });
  if (/not found/i.test(message)) return NextResponse.json({ error: "NOT_FOUND", message }, { status: 404 });
  if (/already exists|duplicate/i.test(message)) return NextResponse.json({ error: "CONFLICT", message }, { status: 409 });
  if (/updated by someone else/i.test(message)) return NextResponse.json({ error: "VERSION_CONFLICT", message }, { status: 409 });
  if (/hubungkan|kunci|api key|google ai|belum|onboarding|wajib|tidak valid|invalid/i.test(message)) {
    return NextResponse.json({ error: "BAD_REQUEST", message }, { status: 400 });
  }
  console.error(JSON.stringify({ level: "error", message }));
  return NextResponse.json({ error: "INTERNAL_ERROR", message }, { status: 500 });
}
