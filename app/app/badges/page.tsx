import { AppShell } from "@/components/AppShell";
import { BadgeGallery } from "@/components/BadgeGallery";
import { Button } from "@/components/Button";
import { badges } from "@/data/badges";

export default function BadgesPage() {
  return (
    <AppShell title="Badge Gallery" subtitle="Browse tactic badge ladders and one-time concept mastery badges for the chess academy.">
      <div className="mb-4 flex justify-end">
        <Button href="/admin/badges" variant="secondary">Update Badges</Button>
      </div>
      <BadgeGallery badges={badges} />
    </AppShell>
  );
}
