"use client";

import { EmptyState } from "@/components/EmptyState";
import { TournamentCard } from "@/components/tournaments/TournamentCard";
import { TournamentFilters } from "@/components/tournaments/TournamentFilters";
import { filterTournaments, type TournamentFilter } from "@/lib/tournaments/filterTournaments";
import { limitFinishedTournaments } from "@/lib/tournaments/limitFinishedTournaments";
import { sortTournaments } from "@/lib/tournaments/sortTournaments";
import type { Tournament } from "@/lib/types";
import { useMemo, useState } from "react";

export function TournamentList({
  tournaments,
  admin = false,
  createdBy,
  upcomingOnly = false
}: {
  tournaments: Tournament[];
  admin?: boolean;
  createdBy?: string;
  upcomingOnly?: boolean;
}) {
  const [filter, setFilter] = useState<TournamentFilter>("upcoming");
  const visible = useMemo(() => (
    sortTournaments(limitFinishedTournaments(filterTournaments(tournaments, upcomingOnly ? "upcoming" : filter, createdBy, admin)))
  ), [admin, createdBy, filter, tournaments, upcomingOnly]);

  return (
    <div className="space-y-4">
      {!upcomingOnly && <TournamentFilters value={filter} onChange={setFilter} admin={admin} hasCreatedBy={Boolean(createdBy)} />}
      {visible.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {visible.map((tournament) => <TournamentCard key={tournament.id} tournament={tournament} />)}
        </div>
      ) : (
        <EmptyState title="No tournaments found" message="Try a different filter, or check back after the next sync." />
      )}
    </div>
  );
}
