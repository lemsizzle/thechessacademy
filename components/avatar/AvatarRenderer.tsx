"use client";

import { avatarCategories } from "@/lib/avatar/catalog";
import { AVATAR_CANVAS_HEIGHT, AVATAR_CANVAS_WIDTH } from "@/lib/avatar/geometry";
import type { AvatarItem, StudentAvatarConfig } from "@/lib/types";

type AvatarRendererProps = {
  items: AvatarItem[];
  avatar: StudentAvatarConfig;
  previewItem?: AvatarItem | null;
  size?: "sm" | "md" | "lg" | "studio";
  label?: string;
};

const sizeClasses = {
  sm: "h-12 w-12",
  md: "h-20 w-20",
  lg: "h-40 w-40",
  studio: "aspect-square w-72 max-w-full"
};

export function AvatarRenderer({ items, avatar, previewItem, size = "md", label = "Student avatar" }: AvatarRendererProps) {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const layers = avatarCategories
    .map((category) => {
      const previewMatchesCategory = previewItem?.category === category.id;
      const item = previewMatchesCategory ? previewItem : itemById.get(avatar.equippedItems[category.id] ?? "");
      return item ? { ...item, layerOrder: previewMatchesCategory ? category.layerOrder + 0.5 : item.layerOrder } : null;
    })
    .filter((item): item is AvatarItem => Boolean(item))
    .sort((a, b) => a.layerOrder - b.layerOrder);

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-[5%] bg-slate-950 shadow-glow ring-1 ring-inset ring-cyan-200/20 ${sizeClasses[size]}`}
      role="img"
      aria-label={label}
      data-avatar-canvas={`${AVATAR_CANVAS_WIDTH}x${AVATAR_CANVAS_HEIGHT}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(125,211,252,0.24),transparent_54%)]" />
      {layers.map((item) => item.assetUrl ? (
        <img
          key={`${item.category}-${item.id}`}
          src={item.assetUrl}
          alt=""
          width={AVATAR_CANVAS_WIDTH}
          height={AVATAR_CANVAS_HEIGHT}
          className="absolute inset-0 block h-full w-full object-fill object-center"
          draggable={false}
        />
      ) : (
        <div key={`${item.category}-${item.id}`} className="absolute inset-3 grid place-items-center rounded-full bg-white/10 text-xs font-black text-cyan-100">
          {item.name.slice(0, 2).toUpperCase()}
        </div>
      ))}
    </div>
  );
}
