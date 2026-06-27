import { LoginHub } from "@/components/auth/LoginHub";
import { redirect } from "next/navigation";

type LoginPageProps = {
  searchParams: Promise<{ lichess?: string; mode?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const initialMode = params.mode === "admin" ? "admin" : "student";
  if (initialMode === "student" && !params.lichess) {
    redirect("/api/auth/lichess/start");
  }

  return <LoginHub initialMode={initialMode} />;
}
