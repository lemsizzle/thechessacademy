import { studentUsers } from "@/data/studentUsers";
import { STUDENT_SESSION_KEY, STUDENT_SESSION_USER_KEY } from "@/lib/auth/roles";
import type { StudentUser } from "@/lib/types";

export function getCurrentStudentUser(): StudentUser | null {
  if (typeof window === "undefined") return null;
  const id = window.localStorage.getItem(STUDENT_SESSION_KEY);
  const seedUser = studentUsers.find((user) => user.id === id);
  if (seedUser) return seedUser;

  try {
    const saved = JSON.parse(window.localStorage.getItem(STUDENT_SESSION_USER_KEY) ?? "null") as StudentUser | null;
    return saved?.id === id ? saved : null;
  } catch {
    return null;
  }
}

export function setCurrentStudentUser(userId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STUDENT_SESSION_KEY, userId);
  const seedUser = studentUsers.find((user) => user.id === userId);
  if (seedUser) window.localStorage.setItem(STUDENT_SESSION_USER_KEY, JSON.stringify(seedUser));
}

export function setCurrentStudentUserRecord(user: StudentUser) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STUDENT_SESSION_KEY, user.id);
  window.localStorage.setItem(STUDENT_SESSION_USER_KEY, JSON.stringify(user));
}

export function clearCurrentStudentUser() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STUDENT_SESSION_KEY);
  window.localStorage.removeItem(STUDENT_SESSION_USER_KEY);
}
