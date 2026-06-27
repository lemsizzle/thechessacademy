import { ADMIN_SESSION_COOKIE, isValidAdminActionToken, isValidAdminSession } from "@/lib/auth/adminSession";
import { buildBadgeImagePrompt, getMockBadgeArtOptions } from "@/lib/badges";
import type { Badge } from "@/lib/types";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function isAuthorized(request: Request) {
  const cookieStore = await cookies();
  const actionToken = request.headers.get("x-admin-action-token");
  return await isValidAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)
    || await isValidAdminActionToken(actionToken);
}

async function generateWithOpenAI(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
      prompt,
      size: "1024x1024",
      n: 3
    })
  });

  const data = await response.json().catch(() => ({})) as { data?: Array<{ b64_json?: string; url?: string }>; error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message ?? "OpenAI image generation failed.");

  const options = (data.data ?? [])
    .map((item) => item.url ?? (item.b64_json ? `data:image/png;base64,${item.b64_json}` : ""))
    .filter(Boolean);

  if (!options.length) throw new Error("OpenAI did not return image options.");
  return options;
}

export async function POST(request: Request) {
  if (!await isAuthorized(request)) return NextResponse.json({ error: "Teacher log in required." }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { badge?: Badge; prompt?: string };
  if (!body.badge) return NextResponse.json({ error: "Badge details are required." }, { status: 400 });

  const prompt = body.prompt?.trim() || buildBadgeImagePrompt(body.badge);
  const openAiEnabled = process.env.OPENAI_BADGE_IMAGE_MODE === "openai";

  try {
    if (openAiEnabled) {
      const options = await generateWithOpenAI(prompt);
      return NextResponse.json({ mode: "openai", prompt, options });
    }

    return NextResponse.json({
      mode: process.env.OPENAI_API_KEY ? "openai-ready-mock" : "mock",
      prompt,
      options: getMockBadgeArtOptions({ ...body.badge, imagePrompt: prompt }),
      message: process.env.OPENAI_API_KEY
        ? "OPENAI_API_KEY is configured. Set OPENAI_BADGE_IMAGE_MODE=openai to use live image generation."
        : "Using mock art because OPENAI_API_KEY is not configured."
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not generate badge art.";
    return NextResponse.json({ error: message, prompt }, { status: 500 });
  }
}
