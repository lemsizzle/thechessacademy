import { AdventureExperience } from "@/components/adventure/AdventureExperience";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";

export default async function StudentAdventurePage({ searchParams }: { searchParams: Promise<{ scenePreview?: string }> }) {
  const { scenePreview } = await searchParams;
  const developerPreview = process.env.NODE_ENV === "development" && scenePreview === "1";

  if (developerPreview) {
    return (
      <main className="academy-grid min-h-screen px-3 py-5 sm:px-6 sm:py-8">
        <div className="mx-auto w-full max-w-7xl">
          <div className="mb-4 rounded-xl border border-fuchsia-200/30 bg-fuchsia-950/25 px-4 py-3 text-sm text-fuchsia-50">
            <span className="font-black uppercase tracking-wider">Development scene preview</span>
            <span className="ml-2 text-fuchsia-100/75">Local progress and Story Debug are available without a student session.</span>
          </div>
          <AdventureExperience />
        </div>
      </main>
    );
  }

  return (
    <StudentPortalShell title="Chess Adventure" subtitle="Chapter 1: restore Dad's chess army and free Pawnhaven." disableAutomaticLichessSync>
      <AdventureExperience />
    </StudentPortalShell>
  );
}
