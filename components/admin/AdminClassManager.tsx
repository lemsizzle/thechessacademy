"use client";
import { useEffect, useState } from "react";
import { migrateClassSettings, readClassSettings } from "@/lib/adminClassClient";
import { validateClassGroups, type ClassSettings } from "@/lib/classSettings";
import { downloadAdminBackup, readAdminStore } from "@/lib/mockStorage";
import type { ClassGroup } from "@/lib/types";

const field = "w-full rounded-lg border border-white/20 bg-slate-900 p-3 text-white";
export function AdminClassManager() {
  const [settings, setSettings] = useState<ClassSettings | null>(null);
  const [draft, setDraft] = useState<ClassGroup[]>([]);
  const [message, setMessage] = useState("Loading and backing up class settings…");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);
  function accept(data: ClassSettings) { setSettings(data); setDraft(data.groups); }
  async function load() {
    setBusy(true); setError(false);
    try { await migrateClassSettings(); accept(await readClassSettings()); setMessage("Classes are saved to your academy account and shared across devices."); }
    catch (err) {
      let recoveryMessage = "";
      try {
        const server = await readClassSettings();
        accept(server);
        if (server.revision === 0) {
          setDraft(readAdminStore().classGroups ?? []);
          recoveryMessage = " Correct the local class entries below and save to finish importing. Your browser backup is preserved.";
        }
      } catch { /* Keep retry available if the server is unreachable. */ }
      setError(true); setMessage((err instanceof Error ? err.message : "Could not load classes.") + recoveryMessage);
    }
    finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, []);
  async function save() {
    if (!settings) return;
    setBusy(true); setError(false);
    try {
      const groups = validateClassGroups(draft);
      const firstImport = settings.revision === 0;
      const response = await fetch("/api/admin/classes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groups, revision: settings.revision, import: firstImport, ...(firstImport ? { backup: readAdminStore().classGroups ?? [] } : {}) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save classes.");
      accept(data); setMessage("Classes saved to the server. Student class assignments are updated.");
    } catch (err) { setError(true); setMessage(err instanceof Error ? err.message : "Could not save classes."); }
    finally { setBusy(false); }
  }
  async function reload() {
    if (settings && JSON.stringify(draft) !== JSON.stringify(settings.groups) && !window.confirm("Discard this unsaved class draft and reload the server version?")) return;
    setBusy(true);
    try { accept(await readClassSettings()); setError(false); setMessage("Loaded the latest server classes."); }
    catch (err) { setError(true); setMessage(err instanceof Error ? err.message : "Could not reload classes."); }
    finally { setBusy(false); }
  }
  function edit(id: string, patch: Partial<ClassGroup>) { setDraft(rows => rows.map(row => row.id === id ? { ...row, ...patch } : row)); }
  return <section className="space-y-5">
    <p role={error ? "alert" : "status"} className={error ? "text-amber-200" : "text-slate-300"}>{message}</p>
    <div className="flex flex-wrap gap-3">
      <button disabled={busy || !settings} onClick={save} className="rounded-lg bg-amber-300 px-4 py-3 font-bold text-slate-950 disabled:opacity-50">Save Classes</button>
      <button disabled={busy} onClick={settings ? reload : load} className="rounded-lg border border-white/20 px-4 py-3">{settings ? "Reload Classes" : "Retry"}</button>
      <button onClick={downloadAdminBackup} className="rounded-lg border border-white/20 px-4 py-3">Download browser backup</button>
    </div>
    <fieldset disabled={busy || !settings} className="space-y-4 disabled:opacity-60">
      <legend className="sr-only">Class settings</legend>
      {draft.map((group, index) => <div key={group.id} className="space-y-3 rounded-xl border border-white/10 bg-slate-950/70 p-4">
        <label className="block text-sm text-slate-300">Class name<input className={field} value={group.name} maxLength={120} onChange={event => edit(group.id, { name: event.target.value })} /></label>
        <label className="block text-sm text-slate-300">Outschool class link<input className={field} type="url" value={group.outschoolClassUrl} onChange={event => edit(group.id, { outschoolClassUrl: event.target.value })} /></label>
        <label className="block text-sm text-slate-300">Outschool section ID (optional)<input className={field} value={group.outschoolSectionId ?? ""} onChange={event => edit(group.id, { outschoolSectionId: event.target.value })} /></label>
        <button className="min-h-11 text-sm text-rose-200 underline" onClick={() => {
          if (window.confirm(`Remove ${group.name || `class ${index + 1}`}? Its students will become Unassigned when you save.`)) setDraft(rows => rows.filter(row => row.id !== group.id));
        }}>Remove class</button>
      </div>)}
      <button className="min-h-11 rounded-lg border border-cyan-200/40 px-4 text-cyan-200" onClick={() => setDraft(rows => [...rows, { id: crypto.randomUUID(), name: "", outschoolClassUrl: "", syncStatus: "not-connected" }])}>Add Class</button>
    </fieldset>
  </section>;
}
