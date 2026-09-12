import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { EmailAuthForm } from "@/components/auth/EmailAuthForm";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="academy-grid min-h-screen px-4 py-10">
    <div className="mx-auto max-w-lg">
      <a href="/" className="text-sm font-bold text-cyan-200">← Chess Quest home</a>
      <h1 className="mt-6 text-3xl font-black text-white">Your chess adventure starts here</h1>
      <p className="mt-3 text-slate-300">Create an account to train, play, and collect rewards. Lichess is optional.</p>
      <Card className="mt-6 p-5 sm:p-6">
        {error && <p role="alert" className="mb-5 rounded-lg border border-amber-200/30 bg-amber-200/10 p-3 text-sm text-amber-100">{error === "google" ? "Google registration could not start. Please try again or register with email." : "That confirmation could not be completed. If your email is already confirmed, try email login. Otherwise, register again to request a fresh confirmation link."}</p>}
        <Button href="/api/auth/google/start" variant="secondary" className="w-full">Register with Google</Button>
        <div className="my-5 flex items-center gap-3 text-xs uppercase text-slate-400"><span className="h-px flex-1 bg-white/10" />or use email<span className="h-px flex-1 bg-white/10" /></div>
        <EmailAuthForm register />
      </Card>
      <p className="mt-5 text-center text-sm text-slate-300">Already have an account? <a href="/login" className="font-bold text-cyan-200 underline">Log in</a></p>
      <p className="mt-3 text-center text-xs text-slate-400">If your teacher gave you an Academy username, use it to log in and keep your existing progress.</p>
      <p className="mt-3 text-center text-xs text-slate-400"><a href="/privacy" className="underline">How we use your information</a></p>
    </div>
  </main>;
}
