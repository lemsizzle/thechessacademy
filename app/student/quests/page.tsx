import { QuestBoard } from "@/components/QuestBoard";
import { StudentLichessQuestList } from "@/components/quests/StudentLichessQuestList";
import { StudentPortalShell } from "@/components/student/StudentPortalShell";
import { RouteLauncherDialog } from "@/components/student/RouteLauncherDialog";

export default function StudentQuestsPage() {
  return (
    <StudentPortalShell title="Quests" subtitle="Choose a challenge and track your rewards.">
      <RouteLauncherDialog
        id="student-quest-launcher"
        eyebrow="Quest Board"
        title="Your quests"
        description="Started, completed, and available challenges in one place."
        triggerLabel="Open your quests"
        triggerDescription="See what is active, complete, or ready to start."
      >
        <div className="mb-5 grid grid-cols-3 gap-2" aria-label="Quest states">
          {[
            ["◷", "Started"],
            ["☺", "Completed"],
            ["★", "Available"]
          ].map(([icon, label]) => (
            <div key={label} className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-3 text-center">
              <span aria-hidden="true" className="block text-xl text-cyan-100">{icon}</span>
              <span className="mt-1 block text-xs font-black text-slate-200 sm:text-sm">{label}</span>
            </div>
          ))}
        </div>
        <div className="space-y-6">
          <StudentLichessQuestList />
          <section aria-labelledby="class-quests-heading">
            <h2 id="class-quests-heading" className="mb-3 font-black text-white">Available class quests</h2>
            <QuestBoard excludeAutomated />
          </section>
        </div>
      </RouteLauncherDialog>
    </StudentPortalShell>
  );
}
