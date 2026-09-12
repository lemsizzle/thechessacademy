import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ParentStudentLookup } from "@/components/ParentStudentLookup";
import { StudentFaq } from "@/components/StudentFaq";

export default function HomePage() {
  return (
    <main className="academy-grid min-h-screen px-4 py-10">
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <Card className="p-6 sm:p-8">
          <p className="text-sm font-bold uppercase text-amber-100">Chess Academy</p>
          <h1 className="mt-2 text-3xl font-black text-white sm:text-5xl">The Chess Academy Quest Board</h1>
          <p className="mt-4 max-w-2xl text-slate-300">
            Train, play, and grow your chess adventure. Use your Academy login or create an account to get started.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button href="/login">Log in with Academy username</Button>
            <Button href="/api/auth/lichess/start" variant="secondary">Log in with Lichess</Button>
          </div>
          <div className="mt-6 border-t border-white/10 pt-5">
            <h2 className="font-bold text-white">New to Chess Quest?</h2>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <Button href="/register" variant="secondary">Register with email</Button>
              <Button href="/api/auth/google/start" variant="secondary">Register with Google</Button>
            </div>
            <p className="mt-3 text-sm text-slate-400">Already registered? <a href="/login?method=email" className="text-cyan-200 underline">Log in with email or Google</a></p>
          </div>
        </Card>

        <ParentStudentLookup />

        <StudentFaq />
        <p className="text-center text-xs text-slate-400"><a href="/privacy" className="underline">Privacy</a></p>
      </div>
    </main>
  );
}
