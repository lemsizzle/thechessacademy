import type { ClassGroup } from "@/lib/types";

export type ClassSettings = { groups: ClassGroup[]; revision: number; imported?: boolean };

export function validateClassGroups(input: unknown): ClassGroup[] {
  if (!Array.isArray(input) || input.length > 200) throw new Error("Enter at most 200 classes.");
  const ids = new Set<string>();
  const names = new Set<string>();
  return input.map(item => {
    if (!item || typeof item !== "object") throw new Error("Invalid class.");
    const text = (key: string, max: number) => {
      const value = item[key] ?? "";
      if (typeof value !== "string" || value.length > max) throw new Error(`Invalid class ${key}.`);
      return value.trim();
    };
    const id = text("id", 160), name = text("name", 120), outschoolClassUrl = text("outschoolClassUrl", 2000);
    if (!id || !name || name.toLowerCase() === "unassigned" || ids.has(id) || names.has(name.toLowerCase())) throw new Error("Use unique class names. Unassigned is reserved.");
    if (outschoolClassUrl) {
      const url = new URL(outschoolClassUrl);
      if (url.protocol !== "https:" || !(url.hostname === "outschool.com" || url.hostname.endsWith(".outschool.com"))) throw new Error("Class links must be HTTPS Outschool URLs.");
    }
    ids.add(id); names.add(name.toLowerCase());
    return { id, name, outschoolClassUrl, outschoolSectionId: text("outschoolSectionId", 200), syncStatus: outschoolClassUrl ? "linked" : "not-connected" };
  });
}

export function mergeRosterClasses(groups: ClassGroup[], names: string[]): ClassGroup[] {
  const merged = [...groups];
  for (const name of names.map(value => value.trim()).filter(Boolean)) {
    if (name.toLowerCase() === "unassigned" || merged.some(group => group.name.toLowerCase() === name.toLowerCase())) continue;
    let id = `roster-${encodeURIComponent(name)}`;
    while (merged.some(group => group.id === id)) id += "-new";
    merged.push({ id, name, outschoolClassUrl: "", outschoolSectionId: "", syncStatus: "not-connected" });
  }
  return merged;
}
