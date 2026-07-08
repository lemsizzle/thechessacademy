import type { Resource, ResourceCategory } from "@/lib/types";

export const resourceCategories: ResourceCategory[] = [
  "Practice",
  "Puzzles",
  "Openings",
  "Endgames",
  "Videos",
  "Tools",
  "Parent Info",
  "Class Materials"
];

export function isSafeExternalUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function normalizeExternalUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function getSafeExternalUrl(url?: string | null) {
  const normalized = normalizeExternalUrl(url ?? "");
  return normalized && isSafeExternalUrl(normalized) ? normalized : "";
}

export function getVisibleResources(resources: Resource[]) {
  return resources.filter((resource) => resource.status === "active" && Boolean(getSafeExternalUrl(resource.url)));
}

export function resourceMatchesSearch(resource: Resource, search: string, category: string) {
  const term = search.trim().toLowerCase();
  const categoryMatches = category === "All" || resource.category === category;
  if (!term) return categoryMatches;

  const haystack = [resource.title, resource.description, resource.category, resource.classGroup ?? ""].join(" ").toLowerCase();
  return categoryMatches && haystack.includes(term);
}
