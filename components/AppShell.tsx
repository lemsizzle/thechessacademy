import { Sidebar } from "@/components/Sidebar";
import { TopNav } from "@/components/TopNav";
import { AdminGate } from "@/components/admin/AdminGate";
import { StudentPublicRedirect } from "@/components/student/StudentPublicRedirect";
import type { NavVariant } from "@/components/navigation";
import type { ReactNode } from "react";

export function AppShell({ children, title, subtitle, variant = "public" }: { children: ReactNode; title: string; subtitle?: string; variant?: NavVariant }) {
  return (
    <div className="academy-grid min-h-screen">
      <div className="flex min-h-screen">
        <Sidebar variant={variant} />
        <div className="min-w-0 flex-1">
          <TopNav variant={variant} />
          <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6">
            <div className="mb-6">
              <h1 className="text-2xl font-black text-white sm:text-3xl">{title}</h1>
              {subtitle && <p className="mt-2 max-w-3xl text-sm text-slate-400 sm:text-base">{subtitle}</p>}
            </div>
            {variant === "admin" ? <AdminGate>{children}</AdminGate> : children}
            {variant === "public" && <StudentPublicRedirect />}
          </main>
        </div>
      </div>
    </div>
  );
}
