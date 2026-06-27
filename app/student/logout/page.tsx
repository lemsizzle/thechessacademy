"use client";

import { useEffect } from "react";
import { clearCurrentStudentUser } from "@/lib/auth/getCurrentUser";

export default function StudentLogoutPage() {
  useEffect(() => {
    fetch("/api/auth/logout", { method: "POST" }).finally(() => {
      clearCurrentStudentUser();
      window.location.href = "/login";
    });
  }, []);

  return <div className="academy-grid min-h-screen p-6 text-sm text-slate-300">Logging out...</div>;
}
