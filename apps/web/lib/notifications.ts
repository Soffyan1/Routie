import { and, eq } from "drizzle-orm";
import {
  createDatabase,
  notificationPreferences,
  notifications,
  withTenant,
  type NotificationPreferenceEntity
} from "@routie/db";
import { serverEnv } from "./env";

export interface CreateNotificationParams {
  workspaceId: string;
  userId?: string | null;
  kind: "APPROVAL_REQUIRED" | "PUBLISH_FAILED" | "TOKEN_EXPIRED" | "ENTITLEMENT_CHANGED" | "EXPORT_READY";
  title: string;
  body: string;
  actionUrl?: string | null;
}

export async function createInAppNotification(params: CreateNotificationParams) {
  const env = serverEnv();
  const db = createDatabase(env.DATABASE_URL);

  return withTenant(db, params.workspaceId, async (tx) => {
    // 1. Check preferences if userId is given or query default for workspace
    let prefs: NotificationPreferenceEntity | undefined;
    if (params.userId) {
      const [userPref] = await tx
        .select()
        .from(notificationPreferences)
        .where(
          and(
            eq(notificationPreferences.workspaceId, params.workspaceId),
            eq(notificationPreferences.userId, params.userId)
          )
        )
        .limit(1);
      prefs = userPref;
    }

    // Default to true if no preference record exists yet
    const inAppEnabled = prefs ? prefs.inAppNotifications : true;
    if (!inAppEnabled) return null;

    // Check specific kind trigger
    if (prefs) {
      if (params.kind === "APPROVAL_REQUIRED" && !prefs.approvalRequired) return null;
      if (params.kind === "PUBLISH_FAILED" && !prefs.publishFailed) return null;
      if (params.kind === "TOKEN_EXPIRED" && !prefs.tokenExpired) return null;
    }

    // 2. Insert notification
    const [created] = await tx
      .insert(notifications)
      .values({
        workspaceId: params.workspaceId,
        userId: params.userId || null,
        kind: params.kind,
        title: params.title,
        body: params.body,
        actionUrl: params.actionUrl || null
      })
      .returning();

    return created;
  });
}
