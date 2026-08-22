import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { AdminChessRatings } from "@/chess/components/AdminChessRatings";
import { listChessRatings } from "@/chess/persistence/ratingServer";

export const dynamic = "force-dynamic";

export default async function AdminChessRatingsPage() {
  try {
    return <AppShell title="Chess Ratings" subtitle="Review and moderate Academy student-vs-student ratings." variant="admin"><AdminChessRatings ratings={await listChessRatings()} /></AppShell>;
  } catch (error) {
    return <AppShell title="Chess Ratings" subtitle="Review and moderate Academy student-vs-student ratings." variant="admin"><Card className="p-6 text-sm font-bold text-rose-100">{error instanceof Error ? error.message : "Chess ratings could not be loaded."}</Card></AppShell>;
  }
}
