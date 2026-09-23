import { readAdminStore } from "@/lib/mockStorage";
import type { ClassSettings } from "@/lib/classSettings";

let migration: Promise<ClassSettings> | undefined;
export async function readClassSettings(): Promise<ClassSettings> {
  const response = await fetch("/api/admin/classes", { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load classes.");
  return data;
}
export function migrateClassSettings(): Promise<ClassSettings> {
  if (migration) return migration;
  migration = (async () => {
    const settings = await readClassSettings();
    const local = readAdminStore().classGroups;
    if (settings.revision > 0 && !local) return settings;
    const response = await fetch("/api/admin/classes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ import: true, revision: settings.revision, groups: settings.revision > 0 ? settings.groups : local ?? [], backup: local ?? [] })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not back up local classes to the server.");
    return data;
  })().catch(error => { migration = undefined; throw error; });
  return migration;
}
