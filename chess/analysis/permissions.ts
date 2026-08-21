import type { ChessActor } from "@/lib/auth/requireChessActor";

export type StudyRole = "owner" | "editor" | "viewer" | null;

export function resolveStudyAccessRole(actor: ChessActor, ownerStudentId: string | null, membershipRole: StudyRole) {
  if (actor.kind === "admin") return "owner" as const;
  if (ownerStudentId === actor.studentId) return "owner" as const;
  return membershipRole;
}

export function studyRoleAllows(role: StudyRole, operation: "read" | "write" | "delete") {
  if (!role) return false;
  if (operation === "read") return true;
  if (operation === "write") return role === "owner" || role === "editor";
  return role === "owner";
}
