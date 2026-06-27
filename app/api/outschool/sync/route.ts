import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { classGroup?: string; learnerName?: string; outschoolLearnerId?: string } | null;

  if (!body?.classGroup || !body?.learnerName) {
    return NextResponse.json({ error: "classGroup and learnerName are required." }, { status: 400 });
  }

  return NextResponse.json({
    mode: "mock",
    message: "Outschool sync placeholder accepted the registration. Wire this route to a real Outschool API/export/webhook when available.",
    student: {
      name: body.learnerName,
      classGroup: body.classGroup,
      outschoolLearnerId: body.outschoolLearnerId ?? `mock-${Date.now()}`
    }
  });
}
