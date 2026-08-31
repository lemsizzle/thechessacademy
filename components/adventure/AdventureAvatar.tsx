"use client";

import { AvatarRenderer } from "@/components/avatar/AvatarRenderer";
import { getDefaultEquippedItems, seedAvatarItems } from "@/lib/avatar/catalog";
import type { AvatarItem, StudentAvatarConfig } from "@/lib/types";
import { useEffect, useState } from "react";

type AvatarPayload = {
  items: AvatarItem[];
  avatar: StudentAvatarConfig;
};

const fallbackAvatar: StudentAvatarConfig = {
  studentId: "adventure-local-avatar",
  equippedItems: getDefaultEquippedItems(seedAvatarItems)
};

export function AdventureAvatar({ label = "Your student avatar" }: { label?: string }) {
  const [payload, setPayload] = useState<AvatarPayload | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/student/avatar", { cache: "no-store", credentials: "include", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Avatar unavailable");
        return response.json() as Promise<AvatarPayload>;
      })
      .then((next) => setPayload(next))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  return <AvatarRenderer items={payload?.items ?? seedAvatarItems} avatar={payload?.avatar ?? fallbackAvatar} size="md" label={label} />;
}
