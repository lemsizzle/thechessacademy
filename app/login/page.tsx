import { LoginHub } from "@/components/auth/LoginHub";

type LoginPageProps = {
  searchParams: Promise<{ lichess?: string; mode?: string; method?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const initialMode = params.mode === "admin" ? "admin" : "student";

  return <LoginHub initialMode={initialMode} initialMethod={params.method === "email" ? "email" : "academy"} />;
}
