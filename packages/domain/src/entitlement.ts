import type { EntitlementStatus } from "./types";

const DAY_MS = 86_400_000;

export interface EntitlementDecision {
  status: EntitlementStatus;
  canRead: boolean;
  canExport: boolean;
  canMutate: boolean;
  canPublish: boolean;
  shouldPurge: boolean;
}

export function evaluateEntitlement(active: boolean, expiredAt: Date | null, now = new Date()): EntitlementDecision {
  if (active || expiredAt === null || expiredAt.getTime() > now.getTime()) {
    return { status: "ACTIVE", canRead: true, canExport: true, canMutate: true, canPublish: true, shouldPurge: false };
  }

  const elapsedDays = Math.floor((now.getTime() - expiredAt.getTime()) / DAY_MS);
  if (elapsedDays < 7) {
    return { status: "GRACE", canRead: true, canExport: true, canMutate: false, canPublish: false, shouldPurge: false };
  }
  if (elapsedDays < 30) {
    return { status: "BLOCKED", canRead: false, canExport: false, canMutate: false, canPublish: false, shouldPurge: false };
  }
  return { status: "PURGE_PENDING", canRead: false, canExport: false, canMutate: false, canPublish: false, shouldPurge: true };
}
