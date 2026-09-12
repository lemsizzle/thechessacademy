import { redirect } from "next/navigation";
import { requireActiveStudent, StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";

/** Page navigation sends expired or old-domain sessions back to login. APIs keep 401 responses. */
export async function requireStudentPage() {
  try {
    return await requireActiveStudent();
  } catch (error) {
    if (error instanceof StudentAuthenticationError) redirect("/login");
    throw error;
  }
}
