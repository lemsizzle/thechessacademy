import { getSafeExternalUrl } from "@/lib/resources";

export function getSafeQuestLink(url?: string | null) {
  const trimmed = url?.trim() ?? "";
  if (/^\/student(?:\/|$)/.test(trimmed)) return { href: trimmed, external: false };
  const external = getSafeExternalUrl(trimmed);
  return external ? { href: external, external: true } : null;
}
