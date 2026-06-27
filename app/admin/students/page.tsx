import { AdminPanel } from "@/components/admin/AdminPanel";
import { AppShell } from "@/components/AppShell";

export default async function AdminStudentsPage({ searchParams }: { searchParams: Promise<{ student?: string }> }) {
  const { student } = await searchParams;
  return <AppShell title="Manage Students" variant="admin"><AdminPanel mode="students" requestedStudent={student} /></AppShell>;
}
