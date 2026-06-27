import { Button } from "@/components/Button";

export function AdminTournamentNav() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button href="/admin/tournaments" variant="ghost">Arena Tournaments</Button>
      <Button href="/admin/tournaments/results" variant="ghost">Arena Results</Button>
      <Button href="/admin/tournaments/awards" variant="ghost">XP Awards</Button>
    </div>
  );
}
