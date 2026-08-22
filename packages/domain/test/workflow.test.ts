import { describe, expect, it } from "vitest";
import { assertTransition, canTransition, hasPermission, hasWorkspacePermission, stateAfterVariantEdit } from "../src/workflow";

describe("content workflow", () => {
  it("enforces the two approval gates", () => {
    expect(canTransition("IDEA_REVIEW", "IDEA_APPROVED")).toBe(true);
    expect(canTransition("IDEA_REVIEW", "APPROVED")).toBe(false);
    expect(() => assertTransition("IDEA_REVIEW", "IDEA_APPROVED", "EDITOR")).toThrow(/cannot approve/);
    expect(() => assertTransition("IDEA_REVIEW", "IDEA_APPROVED", "APPROVER")).not.toThrow();
  });

  it("revokes final approval after an approved variant is edited", () => {
    expect(stateAfterVariantEdit("APPROVED")).toBe("FINAL_REVIEW");
    expect(stateAfterVariantEdit("SCHEDULED")).toBe("FINAL_REVIEW");
    expect(stateAfterVariantEdit("IDEA_DRAFT")).toBe("IDEA_DRAFT");
  });

  it("enforces role permissions", () => {
    expect(hasPermission("OWNER", "MANAGE")).toBe(true);
    expect(hasPermission("EDITOR", "APPROVE")).toBe(false);
    expect(hasPermission("APPROVER", "EDIT")).toBe(false);
  });

  it("keeps team and integration permissions aligned with the role matrix", () => {
    expect(hasWorkspacePermission("OWNER", "MANAGE_TEAM")).toBe(true);
    expect(hasWorkspacePermission("EDITOR", "MANAGE_TEAM")).toBe(false);
    expect(hasWorkspacePermission("EDITOR", "MANAGE_SOCIAL_CONNECTIONS")).toBe(true);
    expect(hasWorkspacePermission("EDITOR", "MANAGE_API_KEYS")).toBe(false);
    expect(hasWorkspacePermission("APPROVER", "VIEW_ANALYTICS")).toBe(true);
  });
});
