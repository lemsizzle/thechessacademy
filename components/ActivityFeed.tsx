"use client";

import { Card } from "@/components/Card";
import { readAdminStore } from "@/lib/mockStorage";
import type { ActivityEvent } from "@/lib/types";
import { useEffect, useState } from "react";

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  const [visibleEvents, setVisibleEvents] = useState(events);

  useEffect(() => {
    const store = readAdminStore();
    setVisibleEvents([...(store.questActivityEvents ?? []), ...(store.tournamentActivityEvents ?? []), ...events]);
  }, [events]);

  return (
    <Card className="p-4">
      <h2 className="font-black text-white">Recent Activity</h2>
      <div className="mt-4 space-y-4">
        {visibleEvents.map((event) => (
          <div key={event.id} className="border-l border-cyan-300/40 pl-3">
            <p className="font-bold text-slate-100">{event.title}</p>
            <p className="text-sm text-slate-400">{event.detail}</p>
            <p className="mt-1 text-xs text-slate-500">{event.createdAt}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
