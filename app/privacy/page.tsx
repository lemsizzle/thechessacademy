import { Card } from "@/components/Card";

export default function PrivacyPage() {
  return <main className="academy-grid min-h-screen px-4 py-10"><Card className="mx-auto max-w-2xl space-y-5 p-6 sm:p-8">
    <a href="/" className="text-sm font-bold text-cyan-200">← Chess Quest home</a>
    <h1 className="text-3xl font-black text-white">Chess Quest privacy notice</h1>
    <p className="text-sm text-slate-400">Updated September 12, 2026</p>
    <section className="space-y-2 text-slate-300"><h2 className="text-xl font-bold text-white">Accounts and learning progress</h2>
      <p>Chess Quest, operated by The Chess Academy, stores a student nickname, class assignment, chess activity, learning progress, rewards, and avatar choices to provide the Academy experience.</p>
      <p>Email registration uses your email address and password through Supabase Auth. Google registration uses your Google identity and email address through Supabase Auth. Google may provide basic profile information during sign-in. Google passwords are never sent to Chess Quest. The Google sign-in integration requests basic identity information, not access to your inbox, contacts, or files.</p>
    </section>
    <section className="space-y-2 text-slate-300"><h2 className="text-xl font-bold text-white">What other people can see</h2>
      <p>Your student nickname, avatar, class, and learning progress can appear in Academy profiles, leaderboards, games, and teacher views. Choose a nickname rather than a full legal name. Registration email addresses are kept separate from public student profiles.</p>
      <p>Lichess is optional. Connecting it lets the Academy read the Lichess information and activity described on its consent screen.</p>
    </section>
    <section className="space-y-2 text-slate-300"><h2 className="text-xl font-bold text-white">Services and storage</h2>
      <p>Vercel hosts the app. Supabase provides database and authentication services. Resend delivers account confirmation emails. These services process the information needed to operate those features and may keep operational and security logs under their own policies.</p>
      <p>The app uses secure session cookies to keep you signed in and browser storage for preferences and parts of the learning experience. Log out on shared devices. Passwords are not saved in browser storage or public student records.</p>
    </section>
    <section className="space-y-2 text-slate-300"><h2 className="text-xl font-bold text-white">Questions and account requests</h2>
      <p>Students and parents can contact their teacher or <a href="mailto:lemuel.sison@gmail.com" className="text-cyan-200 underline">lemuel.sison@gmail.com</a> to ask about stored information or request account access, correction, or deletion. A parent or guardian can help a young learner make these requests.</p>
    </section>
  </Card></main>;
}
