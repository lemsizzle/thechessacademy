import { studentUsers } from "@/data/studentUsers";
import { STUDENT_SESSION_KEY, STUDENT_SESSION_USER_KEY } from "@/lib/auth/roles";
import type { StudentUser } from "@/lib/types";
import { clearStudyDraftsOnLogout } from "@/chess/analysis/studyDraftSession";

export function getCurrentStudentUser(): StudentUser | null {
  if (typeof window === "undefined") return null;
  try {
    const id = window.localStorage.getItem(STUDENT_SESSION_KEY);
    const seedUser = studentUsers.find((user) => user.id === id);
    if (seedUser) return seedUser;
    const saved = JSON.parse(window.localStorage.getItem(STUDENT_SESSION_USER_KEY) ?? "null") as StudentUser | null;
    return saved?.id === id ? saved : null;
  } catch {
    return null;
  }
}

export function setCurrentStudentUserRecord(user: StudentUser) {
  if (typeof window === "undefined") return;
  try {
    const previous = window.localStorage.getItem(STUDENT_SESSION_KEY);
    if (previous && previous !== user.id) clearStudyDraftsOnLogout();
    window.localStorage.setItem(STUDENT_SESSION_KEY, user.id);
    window.localStorage.setItem(STUDENT_SESSION_USER_KEY, JSON.stringify(user));
  } catch { /* The authenticated server session remains authoritative. */ }
}

export function clearCurrentStudentUser({ logout = false }: { logout?: boolean } = {}) {
  if (typeof window === "undefined") return;
  // A failed session lookup also clears this cache. Preserve actor-scoped
  // recovery on a temporary outage; only intentional logout deletes drafts.
  if (logout) clearStudyDraftsOnLogout();
  try {
    window.localStorage.removeItem(STUDENT_SESSION_KEY);
    window.localStorage.removeItem(STUDENT_SESSION_USER_KEY);
  } catch { /* Do not prevent server logout when storage is unavailable. */ }
}
