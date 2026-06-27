import { AppShell } from "@/components/AppShell";
import { LichessQuestRuleForm } from "@/components/quests/LichessQuestRuleForm";

export default function AdminLichessQuestRulesPage() {
  return (
    <AppShell title="Lichess Quest Rules" subtitle="Create activity milestones with time windows, safeguards, and teacher approval." variant="admin">
      <LichessQuestRuleForm />
    </AppShell>
  );
}
