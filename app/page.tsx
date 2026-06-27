import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ParentStudentLookup } from "@/components/ParentStudentLookup";
import { StudentFaq } from "@/components/StudentFaq";

export default function HomePage() {
  return (
    <main className="academy-grid min-h-screen px-4 py-10">
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <Card className="p-6 sm:p-8">
          <p className="text-sm font-bold uppercase text-amber-100">Welcome to</p>
          <h1 className="mt-2 text-3xl font-black text-white sm:text-5xl">The Chess Academy Quest Board</h1>
          <p className="mt-4 text-slate-300">
            Track chess class XP, levels, badges, quests, and achievements in one magical progress board.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button href="https://lichess.org/signup" target="_blank" rel="noopener noreferrer">
              Register For Lichess
            </Button>
            <Button href="/login" variant="secondary">
              Log Into The Chess Academy Quest Board
            </Button>
          </div>
        </Card>

        <ParentStudentLookup />

        <StudentFaq />
      </div>
    </main>
  );
}
