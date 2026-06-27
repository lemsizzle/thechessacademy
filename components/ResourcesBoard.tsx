"use client";

import { EmptyState } from "@/components/EmptyState";
import { ResourceCard } from "@/components/ResourceCard";
import { StudentFaq } from "@/components/StudentFaq";
import { getVisibleResources, resourceCategories, resourceMatchesSearch } from "@/lib/resources";
import { useMockAdminState } from "@/lib/useMockAdminState";
import { useMemo, useState } from "react";

export function ResourcesBoard() {
  const { resources } = useMockAdminState();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  const visible = getVisibleResources(resources);
  const filtered = useMemo(() => visible.filter((resource) => resourceMatchesSearch(resource, search, category)), [category, search, visible]);
  const featured = filtered.filter((resource) => resource.featured);
  const regular = filtered.filter((resource) => !resource.featured);

  return (
    <div className="space-y-5">
      <StudentFaq />

      <div className="grid gap-3 rounded-lg border border-white/10 bg-slate-950/58 p-4 sm:grid-cols-[1fr_220px]">
        <input
          className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/60"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search links, videos, tools..."
        />
        <select className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" value={category} onChange={(event) => setCategory(event.target.value)}>
          <option>All</option>
          {resourceCategories.map((item) => <option key={item}>{item}</option>)}
        </select>
      </div>

      {featured.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-black text-white">Featured Resources</h2>
          <div className="grid gap-4 lg:grid-cols-2">{featured.map((resource) => <ResourceCard key={resource.id} resource={resource} />)}</div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-black text-white">All Resources</h2>
        {regular.length ? (
          <div className="grid gap-4 lg:grid-cols-2">{regular.map((resource) => <ResourceCard key={resource.id} resource={resource} />)}</div>
        ) : (
          <EmptyState title="No resources found" message="Try a different search or category filter." />
        )}
      </section>
    </div>
  );
}
