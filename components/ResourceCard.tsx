import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { isSafeExternalUrl } from "@/lib/resources";
import type { Resource } from "@/lib/types";

export function ResourceCard({ resource }: { resource: Resource }) {
  const safe = isSafeExternalUrl(resource.url);

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-black text-white">{resource.title}</h3>
            {resource.featured && <span className="rounded border border-amber-300/40 bg-amber-300/10 px-2 py-0.5 text-xs font-bold text-amber-100">Featured</span>}
          </div>
          <p className="mt-2 text-sm text-slate-300">{resource.description}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded bg-cyan-300/10 px-2 py-1 text-cyan-100">{resource.category}</span>
            {resource.classGroup && <span className="rounded bg-white/10 px-2 py-1 text-slate-200">{resource.classGroup}</span>}
          </div>
        </div>
        {safe ? (
          <Button href={resource.url} variant="secondary" target="_blank" rel="noopener noreferrer">
            Open
          </Button>
        ) : (
          <span className="rounded-md border border-red-300/30 bg-red-400/10 px-3 py-2 text-sm font-bold text-red-100">Unsafe URL</span>
        )}
      </div>
    </Card>
  );
}
