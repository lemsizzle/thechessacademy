"use client";

import { getCurrentStudentUser, setCurrentStudentUserRecord } from "@/lib/auth/getCurrentUser";
import type { StudentUser } from "@/lib/types";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

function getStudentPath(pathname: string) {
  if (pathname === "/app") return "/student";
  if (pathname === "/app/leaderboard") return "/student/leaderboard";
  if (pathname === "/app/badges") return "/student";
  if (pathname === "/app/quests") return "/student/quests";
  if (pathname === "/app/tournaments") return "/student/tournaments";
  if (pathname === "/app/resources") return "/student/resources";
  if (pathname.startsWith("/app/students/")) return pathname.replace("/app/students", "/student/students");
  return null;
}

export function StudentPublicRedirect() {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    async function redirectIfStudent() {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        const data = await response.json() as { user?: StudentUser };
        if (cancelled || !response.ok || !data.user) return;
        setCurrentStudentUserRecord(data.user);
        const nextPath = getStudentPath(pathname);
        if (nextPath && nextPath !== pathname) window.location.replace(nextPath);
      } catch {
        // Public pages stay public if there is no readable student session.
      }

      const localUser = getCurrentStudentUser();
      const localNextPath = localUser ? getStudentPath(pathname) : null;
      if (localNextPath && localNextPath !== pathname) window.location.replace(localNextPath);
    }

    void redirectIfStudent();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
