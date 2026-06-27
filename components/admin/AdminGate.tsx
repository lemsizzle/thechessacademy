"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

export function AdminGate({ children }: { children: ReactNode }) {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    fetch("/api/admin/session", { cache: "no-store", credentials: "same-origin" })
      .then((response) => response.json() as Promise<{ authenticated?: boolean }>)
      .then((data) => {
        if (data.authenticated) {
          setAllowed(true);
          return;
        }
        window.location.href = "/admin-login";
      })
      .catch(() => {
        window.location.href = "/admin-login";
      });
  }, []);

  if (!allowed) {
    return (
      <div className="mx-auto mt-10 max-w-md rounded-lg border border-white/10 bg-slate-950/80 p-5 text-sm text-slate-300">
        Checking teacher access...
      </div>
    );
  }

  return <>{children}</>;
}
