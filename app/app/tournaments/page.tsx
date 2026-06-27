import { AppShell } from "@/components/AppShell";
import { TournamentsBoard } from "@/components/tournaments/TournamentsBoard";

export default function TournamentsPage() {
  return (
    <AppShell title="Upcoming Tournaments" subtitle="Upcoming Arena events from our Lichess team.">
      <TournamentsBoard />
    </AppShell>
  );
}
