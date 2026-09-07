"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { hasAdminSession } from "@/lib/mockStorage";
import { hasParentStudentProfileAccess } from "@/lib/publicStudentAccess";

export function PublicStudentProfileGate({ slug, children }: { slug: string; children: ReactNode }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => { setAllowed(hasAdminSession() || hasParentStudentProfileAccess(slug)); }, [slug]);
  if (allowed === null) return <p role="status" className="text-slate-300">Checking profile access…</p>;
  if (!allowed) return <Card className="p-6 text-center">
    <h2 className="font-black text-white">Use Parent Lookup</h2>
    <p className="mt-2 text-sm text-slate-400">Enter the student's Lichess username or profile slug on the home page to open their profile.</p>
    <Button href="/" variant="secondary" className="mt-4">Go To Parent Lookup</Button>
  </Card>;
  return children;
}
