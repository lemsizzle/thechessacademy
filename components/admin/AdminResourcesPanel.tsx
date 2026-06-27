"use client";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { resources as seedResources } from "@/data/resources";
import { readAdminStore, updateAdminStore } from "@/lib/mockStorage";
import { isSafeExternalUrl, resourceCategories } from "@/lib/resources";
import type { Resource, ResourceCategory, ResourceStatus } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

const statuses: ResourceStatus[] = ["active", "inactive", "archived"];

function fieldClass(extra = "") {
  return `rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/60 ${extra}`;
}

function newResource(count: number): Resource {
  const now = new Date().toISOString().slice(0, 10);
  return {
    id: `resource-${Date.now()}`,
    title: `New Resource ${count + 1}`,
    description: "Add a short note about why this link is useful.",
    url: "https://lichess.org/",
    category: "Practice",
    status: "inactive",
    featured: false,
    createdAt: now,
    updatedAt: now
  };
}

export function AdminResourcesPanel() {
  const [resources, setResources] = useState<Resource[]>(seedResources);
  const [selectedId, setSelectedId] = useState(seedResources[0]?.id ?? "");
  const [draft, setDraft] = useState<Resource>(seedResources[0]);
  const [filter, setFilter] = useState<ResourceStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [log, setLog] = useState("Resource editor ready.");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const savedResources = readAdminStore().resources;
    if (savedResources) {
      const first = savedResources[0];
      setResources(savedResources);
      setSelectedId(first?.id ?? "");
      if (first) setDraft(first);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    updateAdminStore({ resources });
  }, [loaded, resources]);

  const selected = resources.find((resource) => resource.id === selectedId) ?? resources[0];

  useEffect(() => {
    if (selected) {
      setDraft({ ...selected });
    }
  }, [selected?.id]);

  const filteredResources = useMemo(() => {
    const term = search.trim().toLowerCase();
    return resources.filter((resource) => {
      const statusMatch = filter === "all" || resource.status === filter;
      const textMatch = !term || [resource.title, resource.description, resource.category, resource.url].join(" ").toLowerCase().includes(term);
      return statusMatch && textMatch;
    });
  }, [filter, resources, search]);

  function saveResource() {
    const now = new Date().toISOString().slice(0, 10);
    const cleanDraft = {
      ...draft,
      updatedAt: now,
      archivedAt: draft.status === "archived" ? draft.archivedAt ?? now : undefined
    };
    setResources((items) => items.map((resource) => resource.id === draft.id ? cleanDraft : resource));
    setLog(`Saved ${cleanDraft.title}.`);
  }

  function addResource() {
    const resource = newResource(resources.length);
    setResources((items) => [resource, ...items]);
    setSelectedId(resource.id);
    setDraft(resource);
    setLog(`Added ${resource.title}.`);
  }

  function archiveResource() {
    setDraft((resource) => ({ ...resource, status: "archived", archivedAt: new Date().toISOString().slice(0, 10) }));
    setLog("Archive selected. Click Save Resource to commit it.");
  }

  function deleteResource() {
    if (!window.confirm(`Delete resource ${draft.title}? This removes it from local mock storage.`)) return;
    const remaining = resources.filter((resource) => resource.id !== draft.id);
    setResources(remaining);
    setSelectedId(remaining[0]?.id ?? "");
    if (remaining[0]) setDraft(remaining[0]);
    setLog(`Deleted ${draft.title}.`);
  }

  if (!selected) {
    return (
      <div className="space-y-4">
        <Button onClick={addResource}>Add Resource</Button>
        <Card className="p-6 text-slate-300">No resources yet.</Card>
      </div>
    );
  }

  const safeUrl = isSafeExternalUrl(draft.url);

  return (
    <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-black text-white">Resources</h2>
          <Button onClick={addResource}>Add</Button>
        </div>
        <div className="mt-4 grid gap-2">
          <input className={fieldClass()} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search resources" />
          <select className={fieldClass()} value={filter} onChange={(event) => setFilter(event.target.value as ResourceStatus | "all")}>
            <option value="all">All statuses</option>
            {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </div>
        <div className="scrollbar-soft mt-4 max-h-[520px] space-y-2 overflow-auto pr-1">
          {filteredResources.map((resource) => (
            <button
              key={resource.id}
              type="button"
              onClick={() => setSelectedId(resource.id)}
              className={`w-full rounded-md border p-3 text-left text-sm transition ${resource.id === selectedId ? "border-amber-300/50 bg-amber-300/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
            >
              <div className="font-bold text-white">{resource.title}</div>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-400">
                <span>{resource.category}</span>
                <span>{resource.status}</span>
                {resource.featured && <span>featured</span>}
              </div>
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-black text-white">Edit Resource</h2>
            <p className="text-sm text-slate-400">Public page only shows active resources with safe http or https URLs.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={saveResource}>Save Resource</Button>
            <Button variant="ghost" onClick={archiveResource}>Archive</Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-xs font-bold text-slate-300">Title
            <input className={fieldClass()} value={draft.title} onChange={(event) => setDraft((resource) => ({ ...resource, title: event.target.value }))} />
          </label>
          <label className="grid gap-1 text-xs font-bold text-slate-300">Category
            <select className={fieldClass()} value={draft.category} onChange={(event) => setDraft((resource) => ({ ...resource, category: event.target.value as ResourceCategory }))}>
              {resourceCategories.map((category) => <option key={category}>{category}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold text-slate-300 md:col-span-2">URL
            <input className={fieldClass(safeUrl ? "" : "border-red-300/60")} value={draft.url} onChange={(event) => setDraft((resource) => ({ ...resource, url: event.target.value }))} />
          </label>
          {!safeUrl && <p className="text-xs font-bold text-red-100 md:col-span-2">Use a full http:// or https:// link. Other URL types are hidden from the public page.</p>}
          <label className="grid gap-1 text-xs font-bold text-slate-300">Status
            <select className={fieldClass()} value={draft.status} onChange={(event) => setDraft((resource) => ({ ...resource, status: event.target.value as ResourceStatus }))}>
              {statuses.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold text-slate-300">Class Group
            <input className={fieldClass()} value={draft.classGroup ?? ""} onChange={(event) => setDraft((resource) => ({ ...resource, classGroup: event.target.value || undefined }))} />
          </label>
          <label className="flex items-center gap-3 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-slate-200">
            <input type="checkbox" checked={draft.featured} onChange={(event) => setDraft((resource) => ({ ...resource, featured: event.target.checked }))} className="h-4 w-4 accent-amber-300" />
            Featured resource
          </label>
          <label className="grid gap-1 text-xs font-bold text-slate-300 md:col-span-2">Description
            <textarea className={fieldClass("min-h-28")} value={draft.description} onChange={(event) => setDraft((resource) => ({ ...resource, description: event.target.value }))} />
          </label>
        </div>

        <div className="mt-5 rounded-lg border border-red-300/20 bg-red-500/10 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-bold text-red-100">Delete {draft.title}</p>
            <Button variant="ghost" onClick={deleteResource}>Delete Resource</Button>
          </div>
        </div>
        <p className="mt-4 text-sm text-slate-400">{log}</p>
      </Card>
    </div>
  );
}
