import { Card } from "@/components/Card";

const faqs = [
  {
    question: "How do I use the Quest Board?",
    answer: "Find your class, click your player card, and open your profile to see your level, XP bar, quests, badges, Lichess ratings, and recent progress."
  },
  {
    question: "How do I gain XP?",
    answer: "XP comes from teacher awards, completed quests, approved badges, submitted puzzle scores, and Lichess activity after your first login."
  },
  {
    question: "How does Lichess XP work?",
    answer: "Ratings earn milestone XP for each full 100 points above 800: 15 XP for established Blitz or Rapid, and 10 XP for Puzzle. The highest earned rating is kept, so XP never drops after a rating loss. Provisional Blitz and Rapid do not count. After first login, a rated rapid game earns 5 XP, a rapid win earns 10 XP total, a rated blitz game earns 2 XP, a blitz win earns 5 XP total, and each correct puzzle earns 2 XP. Every XP earned also grants one Academy Coin."
  },
  {
    question: "How do I earn badges?",
    answer: "Badges are earned by showing chess skills such as tactics, checkmates, endgames, sportsmanship, tournament effort, and special boss achievements."
  },
  {
    question: "How do Lichess quests work?",
    answer: "Live Lichess quests track approved activity windows such as rated rapid games, puzzle practice, and Arena scores. Sync your quest progress from the student quest page. Completed conditions go to your teacher for approval before XP or badges are awarded."
  },
  {
    question: "How do I submit work?",
    answer: "Use the student portal to submit games for review or puzzle scores. Your teacher reviews submissions before XP or badge progress is awarded."
  },
  {
    question: "How do I join tournaments?",
    answer: "Log in to Lichess, open the Chess Academy team page, click join, and enter the team code: good game. After you are on the team, return to the tournaments page and join an upcoming event."
  }
];

export function StudentFaq() {
  return (
    <Card className="overflow-hidden p-0">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4">
          <span>
            <span className="block text-xs font-black uppercase text-cyan-100">Resources FAQ</span>
            <span className="mt-1 block font-black text-white">How To Use The Quest Board</span>
          </span>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-cyan-100 group-open:hidden">+</span>
          <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-cyan-100 group-open:flex">-</span>
        </summary>
        <div className="space-y-2 border-t border-white/10 p-4">
          {faqs.map((faq) => (
            <details key={faq.question} className="group/item rounded-md border border-white/10 bg-black/20">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-sm font-black text-white">
                {faq.question}
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-cyan-100 group-open/item:hidden">+</span>
                <span className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-cyan-100 group-open/item:flex">-</span>
              </summary>
              <p className="border-t border-white/10 px-3 py-3 text-sm text-slate-300">{faq.answer}</p>
            </details>
          ))}
        </div>
      </details>
    </Card>
  );
}
