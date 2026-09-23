"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ADMIN_STORE_UPDATED_EVENT, downloadAdminBackup, hasUnsavedAdminState, recoverAdminStorage } from "@/lib/mockStorage";
import { migrateClassSettings } from "@/lib/adminClassClient";

function subscribe(callback: () => void) {
  window.addEventListener(ADMIN_STORE_UPDATED_EVENT, callback);
  return () => window.removeEventListener(ADMIN_STORE_UPDATED_EVENT, callback);
}

export function AdminStorageNotice() {
  const unsaved = useSyncExternalStore(subscribe, hasUnsavedAdminState, () => false);
  const [problem, setProblem] = useState("");
  async function recover() {
    setProblem("");
    const results = await Promise.allSettled([recoverAdminStorage(), migrateClassSettings()]);
    const failed = results.find(result => result.status === "rejected");
    if (failed?.status === "rejected") setProblem(failed.reason instanceof Error ? failed.reason.message : "Could not complete the settings backup.");
  }
  useEffect(() => { void recover(); }, []);
  if (!unsaved && !problem) return null;
  return <div role="alert" className="mb-4 rounded-lg border border-amber-300/40 bg-amber-300/10 p-4 text-sm text-amber-100">
    <p>{problem || "Browser storage is still unavailable. Local-only edits may not survive a reload. Classes saved to the server and other server data are safe."}</p>
    <div className="mt-3 flex flex-wrap gap-4"><button className="min-h-11 underline" onClick={downloadAdminBackup}>Download browser backup</button><button className="min-h-11 underline" onClick={recover}>Retry backup and cleanup</button></div>
  </div>;
}
