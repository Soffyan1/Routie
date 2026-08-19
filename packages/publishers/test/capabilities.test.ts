import { describe, expect, it } from "vitest";
import { capabilityFor, deliveryModeFor } from "../src";

const disabled = { meta: false, tiktok: false, threads: false, youtube: false };

describe("social capability flags", () => {
  it("keeps X manual and TikTok in draft mode", () => {
    expect(deliveryModeFor("X", { ...disabled, meta: true, tiktok: true, threads: true, youtube: true })).toBe("EXPORT_MANUAL");
    expect(deliveryModeFor("TIKTOK", disabled)).toBe("PLATFORM_DRAFT");
  });

  it("only enables reviewed integrations", () => {
    expect(capabilityFor("INSTAGRAM", { ...disabled, meta: true }).deliveryMode).toBe("AUTO_PUBLISH");
    expect(capabilityFor("YOUTUBE", disabled)).toMatchObject({ deliveryMode: "EXPORT_MANUAL", contentKinds: ["SHORT_VIDEO"] });
  });
});
