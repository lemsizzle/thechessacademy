import { redirect } from "next/navigation";

export default function StudentLoginPage() {
  redirect("/api/auth/lichess/start");
}
