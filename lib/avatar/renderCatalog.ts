import type { AvatarItem } from "@/lib/types";

/** Catalog arrays are immutable snapshots. Weak keys avoid retaining old catalogs. */
const indexes = new WeakMap<AvatarItem[], WeakMap<AvatarItem[], Map<string, AvatarItem>>>();
export function avatarRenderCatalog(defaults: AvatarItem[], items: AvatarItem[]) {
  let catalogs = indexes.get(defaults);
  if (!catalogs) { catalogs = new WeakMap(); indexes.set(defaults, catalogs); }
  let index = catalogs.get(items);
  if (!index) {
    index = new Map(defaults.map(item => [item.id, item]));
    for (const item of items) index.set(item.id, item);
    catalogs.set(items, index);
  }
  return index;
}
