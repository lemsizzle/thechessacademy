"use client";

import { Sidebar } from "@/components/Sidebar";
import { TopNav } from "@/components/TopNav";
import { CorrespondenceProvider } from "@/components/correspondence/CorrespondenceProvider";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { clearCurrentStudentUser, getCurrentStudentUser, setCurrentStudentUserRecord } from "@/lib/auth/getCurrentUser";
import { syncStudentLichessEverything } from "@/lib/studentLichessFullSync";
import type { StudentUser } from "@/lib/types";
import { usePathname } from "next/navigation";

export function StudentPortalShell({
  children,
  title,
  subtitle,
  disableAutomaticLichessSync = false,
  initialUser = null
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  disableAutomaticLichessSync?: boolean;
  initialUser?: StudentUser | null;
}) {
  const [user, setUser] = useState<StudentUser | null>(initialUser);
  const [checked, setChecked] = useState(Boolean(initialUser));
  const pathname = usePathname();
  const supabaseBackedApp = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const allowLocalMockSession = process.env.NODE_ENV !== "production" && !supabaseBackedApp;
  const autoSyncCooldownMs = 10 * 60 * 1000;

  async function syncLichessForLogin(studentUser: StudentUser) {
    if (studentUser.onboardingCompleted === false) return;
    const syncKey = `quest-board-auto-lichess-sync:${studentUser.studentId}`;
    const lastSyncedAt = Number(window.sessionStorage.getItem(syncKey) ?? 0);
    if (Number.isFinite(lastSyncedAt) && Date.now() - lastSyncedAt < autoSyncCooldownMs) return;
    window.sessionStorage.setItem(syncKey, String(Date.now()));

    try {
      await syncStudentLichessEverything();
    } catch {
      window.sessionStorage.setItem(syncKey, String(Date.now() - autoSyncCooldownMs + 30_000));
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        const data = await response.json() as { user?: StudentUser };
        if (cancelled) return;
        if (response.ok && data.user) {
          setCurrentStudentUserRecord(data.user);
          if (data.user.onboardingCompleted === false && pathname !== "/student/onboarding") {
            window.location.href = "/student/onboarding";
            return;
          }
          setUser(data.user);
          setChecked(true);
          if (!disableAutomaticLichessSync) void syncLichessForLogin(data.user);
          return;
        }
        if (!allowLocalMockSession) {
          clearCurrentStudentUser();
          window.location.href = "/";
          return;
        }
      } catch {
        if (!allowLocalMockSession) {
          clearCurrentStudentUser();
          window.location.href = "/";
          return;
        }
      }

      if (!allowLocalMockSession) {
        clearCurrentStudentUser();
        window.location.href = "/";
        return;
      }

      const current = getCurrentStudentUser();
      if (cancelled) return;
      if (current) {
        if (current.onboardingCompleted === false && pathname !== "/student/onboarding") {
          window.location.href = "/student/onboarding";
          return;
        }
        setUser(current);
        setChecked(true);
        if (!disableAutomaticLichessSync) void syncLichessForLogin(current);
        return;
      }

      window.location.href = "/";
    }

    loadSession();
    return () => {
      cancelled = true;
    };
  }, [disableAutomaticLichessSync, pathname]);

  useEffect(() => {
    if (!user || disableAutomaticLichessSync) return;
    function syncWhenVisible() {
      if (document.visibilityState === "visible") void syncLichessForLogin(user as StudentUser);
    }
    window.addEventListener("focus", syncWhenVisible);
    document.addEventListener("visibilitychange", syncWhenVisible);
    return () => {
      window.removeEventListener("focus", syncWhenVisible);
      document.removeEventListener("visibilitychange", syncWhenVisible);
    };
  }, [disableAutomaticLichessSync, user?.studentId]);

  function logout() {
    fetch("/api/auth/logout", { method: "POST" }).finally(() => {
      if (user) window.sessionStorage.removeItem(`quest-board-auto-lichess-sync:${user.studentId}`);
      clearCurrentStudentUser();
      window.location.href = "/";
    });
  }

  if (!checked || !user) {
    return (
      <div className="academy-grid min-h-screen px-4 py-10 text-sm text-slate-300">
        Checking student access...
      </div>
    );
  }

  return (
    <CorrespondenceProvider studentId={user.studentId}>
      <div className="academy-grid min-h-screen">
        <div className="flex min-h-screen">
          <Sidebar variant="student" />
          <div className="min-w-0 flex-1">
            <TopNav variant="student" studentName={user.name} onStudentLogout={logout} />
            <main className="mx-auto w-full max-w-7xl px-4 pb-28 pt-6 md:pb-6 lg:px-6">
              <div className="mb-6">
                <div>
                  <p className="text-xs font-bold uppercase text-cyan-100">{user.name}</p>
                  <h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">{title}</h1>
                  {subtitle && <p className="mt-2 max-w-3xl text-sm text-slate-400 sm:text-base">{subtitle}</p>}
                </div>
              </div>
              {children}
            </main>
          </div>
        </div>
      </div>
    </CorrespondenceProvider>
  );
}
