import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { StarWarsTraining } from "@/components/training/StarWarsTraining";
import { STAR_WARS_TIME_LIMIT_OPTIONS_MS } from "@/lib/puzzle-training/starWars";

describe("Star Wars training UI", () => {
  it("starts with Classic and all three Time Trial choices", () => {
    const html = renderToStaticMarkup(createElement(StarWarsTraining, { onExit: vi.fn() }));

    expect(html).toContain("Choose your mission");
    expect(html).toContain("Classic");
    expect(html).toContain("Time Trial");
    expect(html).toContain("Start Classic Run");
    expect(STAR_WARS_TIME_LIMIT_OPTIONS_MS).toEqual([60_000, 180_000, 300_000]);
    expect(html).not.toContain("Preparing your mission");
  });
});
