import { ActivityFeed } from "@/components/ActivityFeed";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { activity } from "@/data/activity";

const workflows = [
  {
    title: "Review Queue",
    text: "Approve student games, puzzle scores, XP, and badge progress from one place.",
    primaryHref: "/admin/submissions",
    primaryLabel: "Open Submissions",
    secondaryHref: "/admin/activity",
    secondaryLabel: "Activity Log"
  },
  {
    title: "Students And Classes",
    text: "Manage rosters, class groups, Lichess links, XP, badges, and duplicate profiles.",
    primaryHref: "/admin/students",
    primaryLabel: "Manage Students",
    secondaryHref: "/admin/classes",
    secondaryLabel: "Manage Classes"
  },
  {
    title: "Content Setup",
    text: "Edit the student-facing badges, quests, tournaments, and resources.",
    primaryHref: "/admin/badges",
    primaryLabel: "Manage Badges",
    secondaryHref: "/admin/tournaments",
    secondaryLabel: "Manage Tournaments"
  },
  {
    title: "Analysis Tools",
    text: "Paste Lichess games for teacher-side tactic review when needed.",
    primaryHref: "/admin/game-analyzer",
    primaryLabel: "Open Analyzer",
    secondaryHref: "/admin/resources",
    secondaryLabel: "Resources"
  }
];

export function AdminDashboard() {
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <div className="grid gap-4 md:grid-cols-2">
        {workflows.map((workflow) => (
          <Card key={workflow.title} className="p-4">
            <h2 className="font-black text-white">{workflow.title}</h2>
            <p className="mt-2 text-sm text-slate-400">{workflow.text}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button href={workflow.primaryHref} variant="secondary">{workflow.primaryLabel}</Button>
              <Button href={workflow.secondaryHref} variant="ghost">{workflow.secondaryLabel}</Button>
            </div>
          </Card>
        ))}
      </div>
      <ActivityFeed events={activity} />
    </div>
  );
}
