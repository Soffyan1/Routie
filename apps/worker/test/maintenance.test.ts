import { describe, expect, it } from "vitest";
import { isMediaObjectRetentionEligible } from "../src/maintenance";

const cutoff = new Date("2026-07-21T00:00:00.000Z");

describe("published media retention", () => {
  it("archives an object only after every linked variant has an old successful publish", () => {
    expect(isMediaObjectRetentionEligible(
      ["instagram", "youtube"],
      [
        { variantId: "instagram", status: "SUCCEEDED", updatedAt: new Date("2026-07-01T00:00:00.000Z") },
        { variantId: "youtube", status: "SUCCEEDED", updatedAt: new Date("2026-07-02T00:00:00.000Z") }
      ],
      cutoff
    )).toBe(true);
  });

  it("keeps media when any linked variant is scheduled, held, or not published", () => {
    expect(isMediaObjectRetentionEligible(
      ["instagram", "youtube"],
      [
        { variantId: "instagram", status: "SUCCEEDED", updatedAt: new Date("2026-07-01T00:00:00.000Z") },
        { variantId: "youtube", status: "HELD", updatedAt: new Date("2026-07-01T00:00:00.000Z") }
      ],
      cutoff
    )).toBe(false);
  });

  it("keeps media until the most recent successful publish passes the cutoff", () => {
    expect(isMediaObjectRetentionEligible(
      ["youtube"],
      [
        { variantId: "youtube", status: "SUCCEEDED", updatedAt: new Date("2026-08-01T00:00:00.000Z") }
      ],
      cutoff
    )).toBe(false);
  });
});
