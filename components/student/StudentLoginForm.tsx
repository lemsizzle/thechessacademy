"use client";

import { Card } from "@/components/Card";
import { LichessLoginButton } from "@/components/student/LichessLoginButton";

export function StudentLoginForm() {
  return (
    <Card className="mx-auto max-w-lg p-5">
      <h2 className="font-black text-white">Student Log In</h2>
      <p className="mt-2 text-sm text-slate-300">
        Log in through Lichess. You never enter your Lichess password into this app.
      </p>
      <div className="mt-4">
        <LichessLoginButton />
      </div>
      <p className="mt-3 text-xs text-slate-500">If Lichess OAuth environment variables are missing locally, the app uses the labeled mock Lichess log in.</p>
    </Card>
  );
}
