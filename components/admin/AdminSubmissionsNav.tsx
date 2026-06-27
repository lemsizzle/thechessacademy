import { Button } from "@/components/Button";

export function AdminSubmissionsNav() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button href="/admin/submissions" variant="ghost">Overview</Button>
      <Button href="/admin/submissions/games" variant="secondary">Games</Button>
      <Button href="/admin/submissions/scores" variant="secondary">Scores</Button>
    </div>
  );
}
