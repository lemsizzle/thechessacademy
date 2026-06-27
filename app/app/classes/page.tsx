import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { DevDataSourceNote } from "@/components/DevDataSourceNote";
import { EmptyState } from "@/components/EmptyState";
import { getStudentsResult } from "@/lib/data/students";

export const dynamic = "force-dynamic";

export default async function ClassesPage() {
  const students = await getStudentsResult();
  const groups = Array.from(
    students.data.reduce((map, student) => {
      const groupName = student.classGroup || "Unassigned";
      map.set(groupName, (map.get(groupName) ?? 0) + 1);
      return map;
    }, new Map<string, number>())
  ).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

  return (
    <AppShell title="Classes" subtitle="Public class groups for the Chess Academy Quest Board.">
      <DevDataSourceNote show={students.source === "mock"} />
      {groups.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map(([name, count]) => (
            <Card key={name} className="p-4">
              <p className="text-xs font-black uppercase text-cyan-100">Class Group</p>
              <h2 className="mt-1 font-black text-white">{name}</h2>
              <p className="mt-2 text-sm text-slate-400">{count} active student{count === 1 ? "" : "s"}</p>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="No classes yet" message="Class groups will appear here after students are added." />
      )}
    </AppShell>
  );
}
