import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

export function PublicPortalWelcome() {
  return (
    <Card className="overflow-hidden p-0">
      <div className="relative p-5">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-300/14 via-fuchsia-300/8 to-amber-200/12" />
        <div className="absolute -right-16 top-0 h-36 w-52 rotate-[-18deg] border-y border-amber-100/20 bg-white/[0.06]" />
        <div className="relative grid gap-5 lg:grid-cols-[1fr_320px] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase text-cyan-100">Welcome, families</p>
            <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">Begin Your Chess Academy Quest</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Students and parents can use this portal to follow class progress, XP, levels, quests, badges, and chess achievements. Each student is building their own academy journey, one smart move at a time.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button href="https://lichess.org/signup" target="_blank" rel="noopener noreferrer" variant="primary">
                Create Lichess Account
              </Button>
              <Button href="/login" variant="secondary">
                Log In To Quest Board
              </Button>
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/25 p-4">
            <h3 className="font-black text-white">Start Here</h3>
            <ol className="mt-3 space-y-3 text-sm text-slate-300">
              <li><span className="font-black text-amber-100">1.</span> Create a free Lichess account for the student.</li>
              <li><span className="font-black text-amber-100">2.</span> Return here and log in with Lichess.</li>
              <li><span className="font-black text-amber-100">3.</span> Open the student dashboard to track XP, quests, badges, and progress.</li>
            </ol>
          </div>
        </div>
      </div>
    </Card>
  );
}
