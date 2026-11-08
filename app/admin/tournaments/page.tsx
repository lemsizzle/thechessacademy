import { AppShell } from "@/components/AppShell";
import { AdminInternalArenas } from "@/components/tournaments/AdminInternalArenas";
import { createAdminActionToken } from "@/lib/auth/adminSession";
import { Button } from "@/components/Button";

export const dynamic = "force-dynamic";

export default async function AdminTournamentsPage() {
  const adminActionToken = await createAdminActionToken();

  return (
    <AppShell title="Manage Tournaments" subtitle="Host chess Arenas and Puzzle Battle tournaments on Chess Quest." variant="admin">
      <div className="space-y-8">
        <section className="rounded-xl border border-cyan-200/25 bg-slate-950 p-5"><h2 className="text-xl font-black">Puzzle Battle tournaments</h2><p className="my-3 text-slate-300">Host Survival, Star Wars, or Hide and Seek with automatic round pairings, standings, and bots with Elo you set.</p><Button href="/admin/tournaments/puzzle">Host a puzzle tournament</Button></section>
        <AdminInternalArenas adminActionToken={adminActionToken} />
      </div>
    </AppShell>
  );
}
