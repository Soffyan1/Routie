import type { ContentState, WorkspaceRole } from "./types";

const transitions: Readonly<Record<ContentState, readonly ContentState[]>> = {
  IDEA_DRAFT: ["IDEA_REVIEW"],
  IDEA_REVIEW: ["IDEA_APPROVED", "REJECTED", "IDEA_DRAFT"],
  IDEA_APPROVED: ["GENERATING", "IDEA_DRAFT", "HELD"],
  GENERATING: ["FINAL_REVIEW", "FAILED", "HELD"],
  FINAL_REVIEW: ["APPROVED", "REJECTED", "GENERATING"],
  APPROVED: ["SCHEDULED", "FINAL_REVIEW", "HELD"],
  SCHEDULED: ["PUBLISHING", "FINAL_REVIEW", "HELD", "FAILED"],
  PUBLISHING: ["PUBLISHED", "FAILED", "HELD"],
  PUBLISHED: [],
  REJECTED: ["IDEA_DRAFT", "FINAL_REVIEW"],
  HELD: ["IDEA_APPROVED", "APPROVED", "SCHEDULED", "FAILED"],
  FAILED: ["GENERATING", "SCHEDULED", "PUBLISHING", "HELD"]
};

const approvalStates = new Set<ContentState>(["IDEA_APPROVED", "REJECTED", "APPROVED"]);

export function allowedTransitions(from: ContentState): readonly ContentState[] {
  return transitions[from];
}

export function canTransition(from: ContentState, to: ContentState): boolean {
  return transitions[from].includes(to);
}

export function assertTransition(from: ContentState, to: ContentState, role: WorkspaceRole): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid content transition: ${from} -> ${to}`);
  }
  if (approvalStates.has(to) && role !== "OWNER" && role !== "APPROVER") {
    throw new Error(`Role ${role} cannot approve or reject content`);
  }
}

export function stateAfterVariantEdit(state: ContentState): ContentState {
  if (["APPROVED", "SCHEDULED", "PUBLISHING"].includes(state)) return "FINAL_REVIEW";
  return state;
}

export type ContentPermission = "READ" | "EDIT" | "SUBMIT" | "APPROVE" | "MANAGE";

const permissions: Record<WorkspaceRole, ReadonlySet<ContentPermission>> = {
  OWNER: new Set(["READ", "EDIT", "SUBMIT", "APPROVE", "MANAGE"]),
  EDITOR: new Set(["READ", "EDIT", "SUBMIT"]),
  APPROVER: new Set(["READ", "APPROVE"])
};

export function hasPermission(role: WorkspaceRole, permission: ContentPermission): boolean {
  return permissions[role].has(permission);
}

export type WorkspacePermission = "GENERATE_CONTENT" | "APPROVE_CONTENT" | "EDIT_BRAND" | "MANAGE_API_KEYS" | "MANAGE_SOCIAL_CONNECTIONS" | "MANAGE_TEAM" | "VIEW_ANALYTICS";

const workspacePermissions: Record<WorkspaceRole, ReadonlySet<WorkspacePermission>> = {
  OWNER: new Set(["GENERATE_CONTENT", "APPROVE_CONTENT", "EDIT_BRAND", "MANAGE_API_KEYS", "MANAGE_SOCIAL_CONNECTIONS", "MANAGE_TEAM", "VIEW_ANALYTICS"]),
  EDITOR: new Set(["GENERATE_CONTENT", "EDIT_BRAND", "MANAGE_SOCIAL_CONNECTIONS", "VIEW_ANALYTICS"]),
  APPROVER: new Set(["APPROVE_CONTENT", "VIEW_ANALYTICS"])
};

export function hasWorkspacePermission(role: WorkspaceRole, permission: WorkspacePermission): boolean {
  return workspacePermissions[role].has(permission);
}

export const workspacePermissionMatrix = [
  { permission: "GENERATE_CONTENT", label: "Generate Ide & Konsep AI" },
  { permission: "APPROVE_CONTENT", label: "Review & Setujui Konsep (Approval Center)" },
  { permission: "EDIT_BRAND", label: "Ubah Identitas Brand & Template" },
  { permission: "MANAGE_API_KEYS", label: "Kelola Kunci API & Media Engine" },
  { permission: "MANAGE_SOCIAL_CONNECTIONS", label: "Hubungkan Channel Sosial Media" },
  { permission: "MANAGE_TEAM", label: "Undang & Hapus Anggota Tim" },
  { permission: "VIEW_ANALYTICS", label: "Melihat Statistik & Laporan Performa" }
] as const;
