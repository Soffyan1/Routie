import { describe, expect, it } from "vitest";
import { evaluateEntitlement } from "../src/entitlement";

const day = 86_400_000;
const now = new Date("2026-08-14T00:00:00.000Z");

describe("entitlement lifecycle", () => {
  it("is read-only during the first seven days", () => {
    const result = evaluateEntitlement(false, new Date(now.getTime() - 6 * day), now);
    expect(result).toMatchObject({ status: "GRACE", canRead: true, canExport: true, canMutate: false });
  });

  it("blocks access through day 30", () => {
    expect(evaluateEntitlement(false, new Date(now.getTime() - 7 * day), now).status).toBe("BLOCKED");
    expect(evaluateEntitlement(false, new Date(now.getTime() - 29 * day), now).shouldPurge).toBe(false);
  });

  it("marks data for purge on day 31", () => {
    expect(evaluateEntitlement(false, new Date(now.getTime() - 30 * day), now)).toMatchObject({
      status: "PURGE_PENDING",
      shouldPurge: true
    });
  });
});
