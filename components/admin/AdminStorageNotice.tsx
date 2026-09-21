"use client";
import { useSyncExternalStore } from "react";
import { ADMIN_STORE_UPDATED_EVENT, hasUnsavedAdminState } from "@/lib/mockStorage";

function subscribe(callback: () => void) {
  window.addEventListener(ADMIN_STORE_UPDATED_EVENT, callback);
  return () => window.removeEventListener(ADMIN_STORE_UPDATED_EVENT, callback);
}

export function AdminStorageNotice() {
  const unsaved = useSyncExternalStore(subscribe, hasUnsavedAdminState, () => false);
  if (!unsaved) return null;
  return <p role="alert" className="mb-4 rounded-lg border border-amber-300/40 bg-amber-300/10 p-4 text-sm text-amber-100">Browser storage is full or unavailable. You can keep using teacher pages, but local-only changes (including class settings) may be lost when this tab reloads or closes. Changes successfully saved to the server are unaffected.</p>;
}
