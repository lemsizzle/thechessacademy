import { AppShell } from "@/components/AppShell";
import { GameReviewQueue } from "@/components/admin/GameReviewQueue";

export default function AdminGameReviewPage() {
  return (
    <AppShell title="Game Review" subtitle="Review student-submitted games for tactics or analysis." variant="admin">
      <GameReviewQueue />
    </AppShell>
  );
}
