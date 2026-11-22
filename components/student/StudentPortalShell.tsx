"use client";

import { Sidebar } from "@/components/Sidebar";
import { TrainingSessionRewardsProvider } from "@/components/training/TrainingSessionRewards";
import { StudentMenuNavigation, StudentMenuPage } from "@/components/student/StudentMenuNavigation";
import { AchievementCelebrations } from "@/components/student/AchievementCelebrations";
import { ActiveLiveGameBanner } from "@/components/student/ActiveLiveGameBanner";
import { TopNav } from "@/components/TopNav";
import { CorrespondenceProvider } from "@/components/correspondence/CorrespondenceProvider";
import { OnlinePlayProvider } from "@/components/onlinePlay/OnlinePlayProvider";
import { BoardAppearanceProvider } from "@/chess/appearance/BoardAppearanceProvider";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { clearCurrentStudentUser, getCurrentStudentUser, setCurrentStudentUserRecord } from "@/lib/auth/getCurrentUser";
import { refreshStudentQuests } from "@/lib/studentQuestRefresh";
import { clearQuestRefreshCooldown, reserveQuestRefresh, retryQuestRefreshLater } from "@/lib/student/questRefreshCooldown";
import type { StudentUser } from "@/lib/types";
import { usePathname } from "next/navigation";

export function StudentPortalShell({
  children,
  title,
  subtitle,
  disableAutomaticLichessSync: disableAutomaticQuestRefresh = false,
  initialUser = null
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  /** Legacy prop name: now pauses only Chess Quest quest checks on gameplay screens. */
  disableAutomaticLichessSync?: boolean;
  initialUser?: StudentUser | null;
}) {
  const [user, setUser] = useState<StudentUser | null>(initialUser);
  const [checked, setChecked] = useState(Boolean(initialUser));
  const pathname = usePathname();
  const [linkFailed, setLinkFailed] = useState(false);
  useEffect(() => {
    setLinkFailed(new URLSearchParams(window.location.search).get("lichess") === "error");
  }, [pathname]);
  const supabaseBackedApp = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const allowLocalMockSession = process.env.NODE_ENV !== "production" && !supabaseBackedApp;
  async function refreshQuestsForSession(studentUser: StudentUser) {
    if (studentUser.onboardingCompleted === false) return;
    if (!reserveQuestRefresh(studentUser.studentId)) return;

    try {
      await refreshStudentQuests(studentUser);
    } catch {
      retryQuestRefreshLater(studentUser.studentId);
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
          if (!disableAutomaticQuestRefresh) void refreshQuestsForSession(data.user);
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
        if (!disableAutomaticQuestRefresh) void refreshQuestsForSession(current);
        return;
      }

      window.location.href = "/";
    }

    loadSession();
    return () => {
      cancelled = true;
    };
  }, [disableAutomaticQuestRefresh, pathname]);

  useEffect(() => {
    if (!user || disableAutomaticQuestRefresh) return;
    function syncWhenVisible() {
      if (document.visibilityState === "visible") void refreshQuestsForSession(user as StudentUser);
    }
    window.addEventListener("focus", syncWhenVisible);
    document.addEventListener("visibilitychange", syncWhenVisible);
    return () => {
      window.removeEventListener("focus", syncWhenVisible);
      document.removeEventListener("visibilitychange", syncWhenVisible);
    };
  }, [disableAutomaticQuestRefresh, user?.studentId]);

  function logout() {
    fetch("/api/auth/logout", { method: "POST" }).finally(() => {
      clearCurrentStudentUser({ logout: true });
      if (user) clearQuestRefreshCooldown(user.studentId);
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
    <OnlinePlayProvider key={user.studentId} studentId={user.studentId}>
    <CorrespondenceProvider studentId={user.studentId}>
      <BoardAppearanceProvider studentId={user.studentId}>
      <AchievementCelebrations key={user.studentId} studentId={user.studentId} />
      <StudentMenuNavigation>
      <div className="student-portal-shell academy-grid min-h-screen">
        <div className="flex min-h-screen">
          <Sidebar variant="student" />
          <div className="min-w-0 flex-1">
            <TopNav variant="student" studentName={user.name} studentId={user.studentId} displayedBadge={user.displayedBadge} onStudentLogout={logout} />
            <main className="student-play-area mx-auto w-full max-w-7xl px-4 pb-28 pt-6 md:pb-6 lg:px-6">
              <ActiveLiveGameBanner key={user.studentId} />
              {title && <div data-page-heading className="mb-4">
                <div>
                  <h1 className="text-2xl font-black text-white sm:text-3xl">{title}</h1>
                  {subtitle && <p className="mt-2 max-w-3xl text-sm text-slate-400 sm:text-base">{subtitle}</p>}
                </div>
              </div>}
              {linkFailed && <p role="alert" className="mb-4 text-sm text-amber-200">Lichess was not connected. Use the account assigned by your teacher, or ask your teacher for help.</p>}
              <TrainingSessionRewardsProvider key={user.studentId} studentId={user.studentId}><StudentMenuPage>{children}</StudentMenuPage></TrainingSessionRewardsProvider>
            </main>
          </div>
        </div>
      </div>
      </StudentMenuNavigation>
      </BoardAppearanceProvider>
    </CorrespondenceProvider>
    </OnlinePlayProvider>
  );
}
