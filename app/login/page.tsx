import { LoginHub } from "@/components/auth/LoginHub";

type LoginPageProps = {
  searchParams: Promise<{ mode?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const initialMode = params.mode === "admin" ? "admin" : "student";

  return <LoginHub initialMode={initialMode} />;
}
