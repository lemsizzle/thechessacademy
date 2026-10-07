import { Card } from "@/components/Card";

const faqs = [
  {
    question: "How do I use the Quest Board?",
    answer: "Log in, then open your student dashboard to see your level, XP, quests, badges, and saved Chess Quest progress."
  },
  {
    question: "How do I gain XP?",
    answer: "Earn XP through Chess Quest activities and quests, plus teacher-approved awards and submissions. Check each activity or quest for its rewards. Playing on Lichess does not automatically add Chess Quest XP."
  },
  {
    question: "Does Lichess activity automatically earn Chess Quest XP?",
    answer: "No. Lichess is an optional way to sign in or link your existing Chess Quest account. Chess Quest does not sync your Lichess games, puzzles, ratings, or tournament results for progress or rewards."
  },
  {
    question: "How do I earn badges?",
    answer: "Badges are earned by showing chess skills such as tactics, checkmates, endgames, sportsmanship, tournament effort, and special boss achievements."
  },
  {
    question: "How do quests work?",
    answer: "Open Quests in the student portal, start an available quest, and complete its listed Chess Quest activities. Refresh to check saved progress. Some rewards are awarded automatically; others require teacher approval."
  },
  {
    question: "How do I submit work?",
    answer: "Use the student portal to submit games for review or puzzle scores. Your teacher reviews submissions before XP or badge progress is awarded."
  },
  {
    question: "How do I join tournaments?",
    answer: "Open Tournaments in the student portal and follow the entry instructions for an available event. Ask your teacher if you cannot find the event you need."
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
