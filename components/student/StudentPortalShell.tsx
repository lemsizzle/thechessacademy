"use client";

import { Sidebar } from "@/components/Sidebar";
import { TopNav } from "@/components/TopNav";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { clearCurrentStudentUser, getCurrentStudentUser, setCurrentStudentUserRecord } from "@/lib/auth/getCurrentUser";
import { syncStudentLichessEverything } from "@/lib/studentLichessFullSync";
import type { StudentUser } from "@/lib/types";
import { usePathname } from "next/navigation";

export function StudentPortalShell({ children, title, subtitle }: { children: ReactNode; title: string; subtitle?: string }) {
  const [user, setUser] = useState<StudentUser | null>(null);
  const [checked, setChecked] = useState(false);
  const pathname = usePathname();
  const supabaseBackedApp = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

  async function syncLichessForLogin(studentUser: StudentUser) {
    if (studentUser.onboardingCompleted === false) return;
    const syncKey = `quest-board-auto-lichess-sync:${studentUser.studentId}`;
    if (window.sessionStorage.getItem(syncKey) === "done") return;
    window.sessionStorage.setItem(syncKey, "done");

    try {
      await syncStudentLichessEverything();
    } catch {
      window.sessionStorage.removeItem(syncKey);
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
          void syncLichessForLogin(data.user);
          return;
        }
        if (supabaseBackedApp) {
          clearCurrentStudentUser();
          window.location.href = "/login";
          return;
        }
      } catch {
        if (supabaseBackedApp) {
          clearCurrentStudentUser();
          window.location.href = "/login";
          return;
        }
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
        void syncLichessForLogin(current);
        return;
      }

      window.location.href = "/login";
    }

    loadSession();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  function logout() {
    fetch("/api/auth/logout", { method: "POST" }).finally(() => {
      if (user) window.sessionStorage.removeItem(`quest-board-auto-lichess-sync:${user.studentId}`);
      clearCurrentStudentUser();
      window.location.href = "/login";
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
    <div className="academy-grid min-h-screen">
      <div className="flex min-h-screen">
        <Sidebar variant="student" />
        <div className="min-w-0 flex-1">
          <TopNav variant="student" />
          <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase text-cyan-100">{user.name}</p>
                <h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">{title}</h1>
                {subtitle && <p className="mt-2 max-w-3xl text-sm text-slate-400 sm:text-base">{subtitle}</p>}
              </div>
              <button onClick={logout} className="w-fit rounded-md border border-rose-300/30 bg-rose-300/10 px-3 py-2 text-xs font-bold text-rose-100 transition active:translate-y-px active:scale-[0.98]">
                Logout
              </button>
            </div>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
