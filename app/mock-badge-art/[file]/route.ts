import { NextResponse } from "next/server";

export async function GET(request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const tier = file[0] ?? "c";
  const variant = Number(file.match(/-(\d+)/)?.[1] ?? "1");
  const url = new URL(request.url);
  const badgeName = url.searchParams.get("badge") ?? "";
  const category = url.searchParams.get("category") ?? "";
  const prompt = url.searchParams.get("prompt") ?? "";
  const colors: Record<string, string[]> = {
    bronze: ["#fb923c", "#b45309", "#fed7aa"],
    silver: ["#f8fafc", "#cbd5e1", "#e0f2fe"],
    gold: ["#fde68a", "#f59e0b", "#fef3c7"],
    platinum: ["#ffffff", "#a5f3fc", "#f0abfc"],
    concept: ["#c4b5fd", "#67e8f9", "#fde68a"],
    c: ["#34d399", "#a3e635", "#92400e"],
    b: ["#38bdf8", "#60a5fa", "#e0f2fe"],
    a: ["#f59e0b", "#a78bfa", "#fde68a"],
    s: ["#ffffff", "#e879f9", "#67e8f9"]
  };
  const tierName = file.split("-")[0] ?? "bronze";
  const palette = colors[tierName] ?? colors[tier] ?? colors.bronze;
  const subject = `${badgeName} ${category} ${prompt}`.toLowerCase();
  const icon = subject.includes("pawn") || subject.includes("promotion")
    ? `<circle cx="128" cy="74" r="24" fill="#020617" opacity=".9"/><path d="M100 184h56l-8-38h-40l-8 38Zm14-52h28l10-34h-48l10 34Z" fill="#020617" opacity=".9"/>`
    : subject.includes("bishop")
      ? `<path d="M128 45c28 30 32 57 8 84l31 59H89l31-59c-24-27-20-54 8-84Z" fill="#020617" opacity=".9"/><path d="M114 93h28" stroke="${palette[2]}" stroke-width="8" stroke-linecap="round"/>`
      : subject.includes("mate") || subject.includes("king")
        ? `<path d="M92 190h72l-8-42H100l-8 42Zm8-58h56l-10-49-18 22-18-22-10 49Z" fill="#020617" opacity=".9"/><path d="M128 42v35M112 59h32" stroke="${palette[2]}" stroke-width="8" stroke-linecap="round"/>`
        : subject.includes("opening") || subject.includes("scroll")
          ? `<path d="M78 74h86c15 0 22 10 17 23l-24 83H71l24-83c3-10-3-17-17-23Z" fill="#020617" opacity=".9"/><path d="M101 112h51M94 137h51" stroke="${palette[2]}" stroke-width="7" stroke-linecap="round"/>`
          : subject.includes("tournament") || subject.includes("warrior")
            ? `<path d="M82 75h92v28c0 48-26 77-46 88-20-11-46-40-46-88V75Z" fill="#020617" opacity=".9"/><path d="M109 119h38M128 100v58" stroke="${palette[2]}" stroke-width="8" stroke-linecap="round"/>`
            : `<path d="M96 190h70l-9-29h-52l-9 29Zm13-42h43c-5-19 22-35 0-58-13-14-13-27-3-43-29 6-52 27-52 57 0 15 6 29 12 44Z" fill="#020617" opacity=".9"/>`;
  const orbit = variant === 1
    ? `<path d="M54 132c32-35 112-35 148 0" fill="none" stroke="${palette[2]}" stroke-width="5" opacity=".7"/>`
    : variant === 2
      ? `<circle cx="78" cy="95" r="7" fill="${palette[2]}"/><circle cx="178" cy="160" r="8" fill="${palette[0]}"/><circle cx="178" cy="86" r="5" fill="${palette[2]}"/>`
      : `<path d="M65 176 191 80M74 83l115 88" stroke="${palette[2]}" stroke-width="5" opacity=".55" stroke-linecap="round"/>`;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
      <defs>
        <radialGradient id="g" cx="50%" cy="35%" r="65%">
          <stop offset="0%" stop-color="${palette[2]}"/>
          <stop offset="55%" stop-color="${palette[1]}"/>
          <stop offset="100%" stop-color="#020617"/>
        </radialGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <rect width="256" height="256" fill="#020617"/>
      <circle cx="128" cy="128" r="104" fill="url(#g)" opacity=".95"/>
      <circle cx="128" cy="128" r="108" fill="none" stroke="${palette[0]}" stroke-width="10" filter="url(#glow)"/>
      ${orbit}
      ${icon}
      <path d="M86 196h84" stroke="${palette[2]}" stroke-width="9" stroke-linecap="round"/>
      <path d="M128 42l8 24 24 8-24 8-8 24-8-24-24-8 24-8 8-24Z" fill="${palette[0]}" filter="url(#glow)"/>
    </svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600"
    }
  });
}
