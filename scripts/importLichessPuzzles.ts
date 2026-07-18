import { createReadStream, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { config } from "dotenv";
import { parse } from "csv-parse";
import { createClient } from "@supabase/supabase-js";
import { validateLichessPuzzle } from "../lib/puzzle-training/engine";
import { lichessPuzzleThemes, type LichessPuzzleTheme } from "../lib/puzzle-training/types";

config({ path: resolve(process.cwd(), ".env.local"), quiet: true });
config({ quiet: true });

const headers = [
  "PuzzleId",
  "FEN",
  "Moves",
  "Rating",
  "RatingDeviation",
  "Popularity",
  "NbPlays",
  "Themes",
  "GameUrl",
  "OpeningTags"
] as const;

type CsvPuzzle = Record<typeof headers[number], string>;
type ImportRow = {
  lichess_puzzle_id: string;
  initial_fen: string;
  moves: string[];
  rating: number;
  rating_deviation: number;
  popularity: number;
  number_of_plays: number;
  themes: string[];
  game_url: string | null;
  opening_tags: string[];
  random_key: number;
  is_active: boolean;
};

function integerEnv(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

const ratingMin = integerEnv("PUZZLE_IMPORT_RATING_MIN", 600);
const ratingMax = integerEnv("PUZZLE_IMPORT_RATING_MAX", 2200);
const minimumPopularity = integerEnv("PUZZLE_IMPORT_MIN_POPULARITY", 70);
const minimumPlays = integerEnv("PUZZLE_IMPORT_MIN_PLAYS", 50);
const perTheme = integerEnv("PUZZLE_IMPORT_PER_THEME", 2500);
const batchSize = Math.max(1, integerEnv("PUZZLE_IMPORT_BATCH_SIZE", 250));

function requireEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required in .env.local.`);
  return value;
}

function puzzleStream(filePath: string) {
  if (filePath.toLowerCase().endsWith(".zst")) {
    const zstd = spawn(process.env.ZSTD_PATH || "zstd", ["-dc", filePath], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "inherit"]
    });
    zstd.on("error", (error) => {
      zstd.stdout.destroy(new Error(`Could not start zstd: ${error.message}. Install zstd or set ZSTD_PATH.`));
    });
    return zstd.stdout;
  }
  return createReadStream(filePath);
}

function splitWords(value: string) {
  return value.trim() ? value.trim().split(/\s+/) : [];
}

function relevantThemes(themes: string[]) {
  return lichessPuzzleThemes.filter((theme) => themes.includes(theme));
}

function quotasComplete(counts: Record<LichessPuzzleTheme, number>) {
  return lichessPuzzleThemes.every((theme) => counts[theme] >= perTheme);
}

async function main() {
  const sourceArg = process.argv[2];
  if (!sourceArg) throw new Error("Usage: npm run import:lichess-puzzles -- <path-to-lichess_db_puzzle.csv.zst>");
  const filePath = resolve(process.cwd(), sourceArg);
  if (!existsSync(filePath)) throw new Error(`Puzzle database not found: ${filePath}`);

  const supabase = createClient(
    requireEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const counts: Record<LichessPuzzleTheme, number> = { fork: 0, pin: 0, skewer: 0, mateIn1: 0 };
  const batch: ImportRow[] = [];
  let scanned = 0;
  let imported = 0;
  let rejected = 0;

  async function flush() {
    if (!batch.length) return;
    const rows = batch.splice(0, batch.length);
    const { error } = await supabase.from("chess_puzzles").upsert(rows, { onConflict: "lichess_puzzle_id" });
    if (error) throw new Error(`Supabase import failed: ${error.message}`);
    imported += rows.length;
    process.stdout.write(`\rScanned ${scanned.toLocaleString()} | imported ${imported.toLocaleString()} | fork ${counts.fork}, pin ${counts.pin}, skewer ${counts.skewer}, mateIn1 ${counts.mateIn1}`);
  }

  const parser = puzzleStream(filePath).pipe(parse({ columns: [...headers], from_line: 1, relax_column_count: true, skip_empty_lines: true }));
  for await (const raw of parser as AsyncIterable<CsvPuzzle>) {
    scanned += 1;
    const rating = Number.parseInt(raw.Rating, 10);
    const popularity = Number.parseInt(raw.Popularity, 10);
    const numberOfPlays = Number.parseInt(raw.NbPlays, 10);
    if (rating < ratingMin || rating > ratingMax || popularity < minimumPopularity || numberOfPlays < minimumPlays) continue;

    const themes = splitWords(raw.Themes);
    const matching = relevantThemes(themes).filter((theme) => counts[theme] < perTheme);
    if (!matching.length) continue;
    const moves = splitWords(raw.Moves);
    try {
      validateLichessPuzzle(raw.FEN, moves);
    } catch {
      rejected += 1;
      continue;
    }

    batch.push({
      lichess_puzzle_id: raw.PuzzleId,
      initial_fen: raw.FEN,
      moves,
      rating,
      rating_deviation: Number.parseInt(raw.RatingDeviation, 10),
      popularity,
      number_of_plays: numberOfPlays,
      themes,
      game_url: raw.GameUrl || null,
      opening_tags: splitWords(raw.OpeningTags),
      random_key: Math.random(),
      is_active: true
    });
    for (const theme of matching) counts[theme] += 1;
    if (batch.length >= batchSize) await flush();
    if (quotasComplete(counts)) break;
  }

  await flush();
  process.stdout.write("\n");
  console.log(`Finished. Imported ${imported.toLocaleString()} curated puzzles; rejected ${rejected.toLocaleString()} invalid sequences.`);
  for (const theme of lichessPuzzleThemes) console.log(`${theme}: ${counts[theme].toLocaleString()} selected`);
  if (!quotasComplete(counts)) console.warn("The source ended before every theme quota was filled. The imported rows are still usable.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
