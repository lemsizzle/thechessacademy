import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { StudentLichessDetails } from "@/components/lichess/StudentLichessDetails";

export default function LichessPage() {
  return (
    <AppShell title="Lichess" subtitle="Ratings, puzzle progress, game submissions, and teacher review.">
      <div className="space-y-5">
        <Card className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-black text-white">Submit From The Student Portal</h2>
              <p className="mt-1 text-sm text-slate-400">Games and puzzle scores now use one teacher-reviewed queue.</p>
            </div>
            <Button href="/student/submit" variant="secondary">Submit Work</Button>
          </div>
        </Card>
        <StudentLichessDetails showSubmissionForm={false} />
      </div>
    </AppShell>
  );
}
