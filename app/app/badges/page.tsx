import { AppShell } from "@/components/AppShell";
import { BadgeGallery } from "@/components/BadgeGallery";
import { Button } from "@/components/Button";
import { DevDataSourceNote } from "@/components/DevDataSourceNote";
import { getBadgesResult } from "@/lib/data/badges";

export const dynamic = "force-dynamic";

export default async function BadgesPage() {
  const badges = await getBadgesResult();

  return (
    <AppShell title="Badge Gallery" subtitle="Browse tactic badge ladders and one-time concept mastery badges for the chess academy.">
      <DevDataSourceNote show={badges.source === "mock"} />
      <div className="mb-4 flex justify-end">
        <Button href="/admin/badges" variant="secondary">Update Badges</Button>
      </div>
      <BadgeGallery badges={badges.data} />
    </AppShell>
  );
}
