import { redirect } from "next/navigation";
import { isSessionAuthError, requireSession } from "./auth";

/**
 * Server-page guard. API routes continue to use requireSession() so callers
 * receive a 401 response, while rendered pages return the user to login.
 */
export async function requirePageSession() {
  try {
    return await requireSession();
  } catch (error) {
    if (isSessionAuthError(error)) {
      redirect("/api/auth/logout?reason=session-expired");
    }
    throw error;
  }
}
