import { AppShell } from "@/components/AppShell";
import { PuzzleTournaments } from "@/components/tournaments/PuzzleTournaments";
import { createAdminActionToken } from "@/lib/auth/adminSession";
export const dynamic = "force-dynamic";
export default async function PuzzleTournamentPage() {
  return <AppShell title="Puzzle Battle tournaments" variant="admin"><PuzzleTournaments teacher adminActionToken={await createAdminActionToken()} /></AppShell>;
}
