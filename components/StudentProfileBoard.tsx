"use client";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { StudentProfile } from "@/components/StudentProfile";
import { hasAdminSession } from "@/lib/mockStorage";
import { hasParentStudentProfileAccess } from "@/lib/publicStudentAccess";
import { useMockAdminState } from "@/lib/useMockAdminState";
import { useEffect, useState } from "react";

export function StudentProfileBoard({ slug }: { slug: string }) {
  const { students, loaded } = useMockAdminState();
  const [accessChecked, setAccessChecked] = useState(false);
  const [canViewProfile, setCanViewProfile] = useState(false);
  const student = students.find((item) => item.slug === slug);

  useEffect(() => {
    setCanViewProfile(hasAdminSession() || hasParentStudentProfileAccess(slug));
    setAccessChecked(true);
  }, [slug]);

  if (!loaded || !accessChecked) {
    return <EmptyState title="Checking profile access" message="Confirming this public profile was opened from the parent lookup." />;
  }

  if (!student) {
    return <EmptyState title="No student found" message="This student may have been deleted or renamed in the teacher dashboard." />;
  }

  if (!canViewProfile) {
    return (
      <Card className="p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-2xl">P</div>
        <h3 className="font-bold text-white">Use Parent Lookup</h3>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-400">
          For student privacy, public profile pages open only after entering the matching Lichess username or profile slug on the home page.
        </p>
        <div className="mt-4">
          <Button href="/" variant="secondary">Go To Parent Lookup</Button>
        </div>
      </Card>
    );
  }

  return <StudentProfile student={student} />;
}
