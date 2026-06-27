import { ADMIN_SESSION_COOKIE, isValidAdminActionToken, isValidAdminSession } from "@/lib/auth/adminSession";
import { buildBadgeImagePrompt, getMockBadgeArtOptions } from "@/lib/badges";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Badge } from "@/lib/types";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BADGE_ART_BUCKET = "badge-art";

async function isAuthorized(request: Request) {
  const cookieStore = await cookies();
  const actionToken = request.headers.get("x-admin-action-token");
  return await isValidAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)
    || await isValidAdminActionToken(actionToken);
}

type GeneratedImage = {
  b64Json?: string;
  url?: string;
};

function safePathPart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/(^-|-$)/g, "") || "badge";
}

async function ensureBadgeArtBucket() {
  const supabase = getSupabaseAdminClient();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw new Error(listError.message);

  const exists = buckets?.some((bucket) => bucket.name === BADGE_ART_BUCKET);
  if (!exists) {
    const { error } = await supabase.storage.createBucket(BADGE_ART_BUCKET, {
      public: true,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: ["image/png", "image/webp", "image/jpeg"]
    });
    if (error) throw new Error(error.message);
  }

  return supabase;
}

async function uploadGeneratedImages(badge: Badge, images: GeneratedImage[]) {
  const supabase = await ensureBadgeArtBucket();
  const badgePath = safePathPart(badge.id || badge.name);
  const timestamp = Date.now();
  const urls: string[] = [];

  for (const [index, image] of images.entries()) {
    if (image.url) {
      urls.push(image.url);
      continue;
    }

    if (!image.b64Json) continue;

    const bytes = Buffer.from(image.b64Json, "base64");
    const path = `generated/${badgePath}/${timestamp}-${index + 1}.png`;
    const { error } = await supabase.storage
      .from(BADGE_ART_BUCKET)
      .upload(path, bytes, {
        contentType: "image/png",
        upsert: true
      });

    if (error) throw new Error(error.message);

    const { data } = supabase.storage.from(BADGE_ART_BUCKET).getPublicUrl(path);
    urls.push(data.publicUrl);
  }

  return urls;
}

async function generateWithOpenAI(badge: Badge, prompt: string) {
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

  const generatedImages = (data.data ?? []).map((item) => ({
    b64Json: item.b64_json,
    url: item.url
  }));
  const options = await uploadGeneratedImages(badge, generatedImages);

  if (!options.length) throw new Error("OpenAI did not return image options.");
  return options;
}

export async function POST(request: Request) {
  if (!await isAuthorized(request)) return NextResponse.json({ error: "Teacher log in required." }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { badge?: Badge; prompt?: string };
  if (!body.badge) return NextResponse.json({ error: "Badge details are required." }, { status: 400 });

  const prompt = body.prompt?.trim() || buildBadgeImagePrompt(body.badge);
  const mockMode = process.env.OPENAI_BADGE_IMAGE_MODE === "mock";

  try {
    if (!mockMode) {
      const options = await generateWithOpenAI(body.badge, prompt);
      return NextResponse.json({ mode: "openai", prompt, options });
    }

    return NextResponse.json({
      mode: "mock",
      prompt,
      options: getMockBadgeArtOptions({ ...body.badge, imagePrompt: prompt }),
      message: "Using mock art because OPENAI_BADGE_IMAGE_MODE=mock."
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not generate badge art.";
    return NextResponse.json({ error: message, prompt }, { status: 500 });
  }
}
