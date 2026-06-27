import { ADMIN_SESSION_COOKIE, isValidAdminSession } from "@/lib/auth/adminSession";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const allowed = await isValidAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);

  if (!allowed) {
    redirect("/admin-login");
  }

  return children;
}
