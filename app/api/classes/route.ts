import { classGroups as seedClassGroups } from "@/data/classGroups";
import { UNASSIGNED_CLASS } from "@/lib/classes";
import { getSupabaseServerReadClient, getSupabaseServiceClient } from "@/lib/supabase/server";
import type { ClassGroup } from "@/lib/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type StudentClassRow = {
  class_group: string | null;
};

function slugifyClass(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "class-group";
}

function toClassGroup(name: string): ClassGroup {
  const seeded = seedClassGroups.find((group) => group.name.toLowerCase() === name.toLowerCase());
  return seeded ?? {
    id: slugifyClass(name),
    name,
    outschoolClassUrl: "",
    outschoolSectionId: "",
    syncStatus: "not-connected"
  };
}

export async function GET() {
  const supabase = getSupabaseServerReadClient() ?? getSupabaseServiceClient();
  const names = new Set<string>([UNASSIGNED_CLASS, ...seedClassGroups.map((group) => group.name)]);

  if (supabase) {
    const { data } = await supabase
      .from("students")
      .select("class_group")
      .eq("is_active", true)
      .not("class_group", "is", null);

    for (const row of (data ?? []) as StudentClassRow[]) {
      const className = row.class_group?.trim();
      if (className) names.add(className);
    }
  }

  const sortedNames = [
    UNASSIGNED_CLASS,
    ...[...names].filter((name) => name !== UNASSIGNED_CLASS).sort((a, b) => a.localeCompare(b))
  ];

  return NextResponse.json({
    data: sortedNames.map(toClassGroup),
    names: sortedNames
  });
}
