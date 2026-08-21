import { createReadStream, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pipeline, Transform, type TransformCallback } from "node:stream";
import { createZstdDecompress } from "node:zlib";
import { config } from "dotenv";
import { parse } from "csv-parse";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { validateLichessPuzzle } from "../lib/puzzle-training/engine";
import {
  BoundedIdTracker,
  considerForReservoir,
  emptyReservoirs,
  emptyThemeCounts,
  finalizeReservoirs,
  quotasComplete,
  targetThemesFor,
  tryAddFast,
  type ThemeCounts
} from "../lib/puzzle-training/importSampling";
import { lichessPuzzleThemes } from "../lib/puzzle-training/types";

const importEnvFile = process.env.PUZZLE_IMPORT_ENV_FILE?.trim() || ".env.local";
config({ path: resolve(process.cwd(), importEnvFile), quiet: true });
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
  "OpeningTags",
  "DailyDate"
] as const;

type CsvPuzzle = Partial<Record<typeof headers[number], string>>;
type ImportRow = {
  lichess_puzzle_id: string;
  initial_fen: string;
  moves: string[];
  rating: number;
  rating_deviation: number | null;
  popularity: number;
  number_of_plays: number;
  themes: string[];
  game_url: string | null;
  opening_tags: string[];
  random_key: number;
  is_active: boolean;
};

type ImportMode = "fast" | "sample";

const ZSTD_SKIPPABLE_MAGIC_MIN = 0x184d2a50;
const ZSTD_SKIPPABLE_MAGIC_MAX = 0x184d2a5f;
const ZSTD_FRAME_MAGIC = 0xfd2fb528;
const MAX_SKIPPABLE_FRAME_SIZE = 1024 * 1024;

class StripZstdSkippableFrames extends Transform {
  private pending = Buffer.alloc(0);

  _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback) {
    try {
      this.pending = Buffer.concat([this.pending, chunk]);
      while (this.pending.length >= 4) {
        let skippableIndex = -1;
        for (let index = 0; index <= this.pending.length - 4; index += 1) {
          const magic = this.pending.readUInt32LE(index);
          if (magic >= ZSTD_SKIPPABLE_MAGIC_MIN && magic <= ZSTD_SKIPPABLE_MAGIC_MAX) {
            skippableIndex = index;
            break;
          }
        }

        if (skippableIndex < 0) {
          this.push(this.pending.subarray(0, -3));
          this.pending = this.pending.subarray(-3);
          break;
        }

        if (skippableIndex > 0) {
          this.push(this.pending.subarray(0, skippableIndex));
          this.pending = this.pending.subarray(skippableIndex);
        }
        if (this.pending.length < 8) break;

        const frameSize = this.pending.readUInt32LE(4);
        const frameEnd = 8 + frameSize;
        if (frameSize > MAX_SKIPPABLE_FRAME_SIZE) {
          this.push(this.pending.subarray(0, 1));
          this.pending = this.pending.subarray(1);
          continue;
        }
        if (this.pending.length < frameEnd + 4) break;

        if (this.pending.readUInt32LE(frameEnd) !== ZSTD_FRAME_MAGIC) {
          this.push(this.pending.subarray(0, 1));
          this.pending = this.pending.subarray(1);
          continue;
        }

        this.pending = this.pending.subarray(frameEnd);
      }
      callback();
    } catch (error) {
      callback(error as Error);
    }
  }

  _flush(callback: TransformCallback) {
    if (this.pending.length) this.push(this.pending);
    callback();
  }
}

function integerEnv(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function requireEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required in .env.local.`);
  return value;
}

function splitWords(value?: string) {
  return value?.trim() ? value.trim().split(/\s+/) : [];
}

function parseArguments() {
  const args = process.argv.slice(2);
  const unknownOption = args.find((arg) => arg.startsWith("--") && arg !== "--fast" && arg !== "--sample" && arg !== "--dry-run");
  if (unknownOption) throw new Error(`Unknown option: ${unknownOption}`);
  if (args.includes("--fast") && args.includes("--sample")) throw new Error("Choose either --fast or --sample, not both.");
  const source = args.find((arg) => !arg.startsWith("--"));
  if (!source) {
    throw new Error("Usage: npm run import:lichess-puzzles -- <path-to-lichess_db_puzzle.csv.zst> [--fast|--sample] [--dry-run]");
  }
  return {
    filePath: resolve(process.cwd(), source),
    mode: args.includes("--sample") ? "sample" as const : "fast" as const,
    dryRun: args.includes("--dry-run")
  };
}

function createCsvStream(filePath: string, onCsvSkip: () => void) {
  const source = createReadStream(filePath);
  const parser = parse({
    columns: [...headers],
    bom: true,
    skip_empty_lines: true,
    relax_column_count_less: true,
    skip_records_with_error: true,
    on_skip: () => {
      onCsvSkip();
      return undefined;
    }
  });
  const onComplete = (error: NodeJS.ErrnoException | null) => {
    if (error && !parser.destroyed) parser.destroy(error);
  };
  if (filePath.toLowerCase().endsWith(".zst")) {
    pipeline(source, new StripZstdSkippableFrames(), createZstdDecompress(), parser, onComplete);
  } else {
    pipeline(source, parser, onComplete);
  }
  return parser as AsyncIterable<CsvPuzzle>;
}

function reportProgress(input: {
  mode: ImportMode;
  scanned: number;
  validMatching: number;
  invalid: number;
  selectedCounts?: ThemeCounts;
  qualifyingCounts?: ThemeCounts;
}) {
  const counts = input.mode === "fast" ? input.selectedCounts : input.qualifyingCounts;
  const themeSummary = lichessPuzzleThemes.map((theme) => `${theme} ${counts?.[theme] ?? 0}`).join(" | ");
  console.log(`Scanned ${input.scanned.toLocaleString()} | valid ${input.validMatching.toLocaleString()} | invalid ${input.invalid.toLocaleString()} | ${themeSummary}`);
}

async function existingIds(supabase: SupabaseClient, rows: ImportRow[]) {
  const ids = rows.map((row) => row.lichess_puzzle_id);
  const { data, error } = await supabase
    .from("chess_puzzles")
    .select("lichess_puzzle_id")
    .in("lichess_puzzle_id", ids);
  if (error) throw new Error(`Could not check existing puzzle IDs: ${error.message}`);
  return new Set(((data ?? []) as Array<{ lichess_puzzle_id: string }>).map((row) => row.lichess_puzzle_id));
}

async function upsertRows(supabase: SupabaseClient, rows: ImportRow[], batchSize: number) {
  let inserted = 0;
  let updated = 0;
  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    const existing = await existingIds(supabase, batch);
    const { error } = await supabase.from("chess_puzzles").upsert(batch, { onConflict: "lichess_puzzle_id" });
    if (error) throw new Error(`Supabase import failed: ${error.message}`);
    updated += existing.size;
    inserted += batch.length - existing.size;
    console.log(`Upserted ${Math.min(index + batch.length, rows.length).toLocaleString()} / ${rows.length.toLocaleString()} selected puzzles.`);
  }
  return { inserted, updated };
}

async function main() {
  const { filePath, mode, dryRun } = parseArguments();
  if (!existsSync(filePath)) throw new Error(`Puzzle database not found: ${filePath}`);

  const ratingMin = integerEnv("PUZZLE_IMPORT_RATING_MIN", 600);
  const ratingMax = integerEnv("PUZZLE_IMPORT_RATING_MAX", 2200);
  const minimumPopularity = integerEnv("PUZZLE_IMPORT_MIN_POPULARITY", 70);
  const minimumPlays = integerEnv("PUZZLE_IMPORT_MIN_PLAYS", 50);
  const perTheme = Math.max(1, integerEnv("PUZZLE_IMPORT_PER_THEME", 1000));
  const batchSize = Math.min(500, Math.max(250, integerEnv("PUZZLE_IMPORT_BATCH_SIZE", 250)));
  const progressEvery = Math.max(1000, integerEnv("PUZZLE_IMPORT_PROGRESS_EVERY", 50_000));

  const selected = new Map<string, ImportRow>();
  const selectedCounts = emptyThemeCounts();
  const reservoirs = emptyReservoirs<ImportRow>();
  const qualifyingCounts = emptyThemeCounts();
  const sourceIds = new BoundedIdTracker();
  let scanned = 0;
  let validMatching = 0;
  let invalid = 0;
  let csvRowsSkipped = 0;
  let sourceDuplicates = 0;

  console.log(`Starting ${mode === "fast" ? "fast" : "reservoir-sampled"} Lichess puzzle import.`);
  console.log(`Filters: rating ${ratingMin}-${ratingMax}, popularity >= ${minimumPopularity}, plays >= ${minimumPlays}, target ${perTheme} per theme.`);

  for await (const raw of createCsvStream(filePath, () => { csvRowsSkipped += 1; })) {
    scanned += 1;
    if (scanned % progressEvery === 0) {
      reportProgress({ mode, scanned, validMatching, invalid, selectedCounts, qualifyingCounts });
    }

    const puzzleId = raw.PuzzleId?.trim();
    const initialFen = raw.FEN?.trim();
    const rating = Number.parseInt(raw.Rating ?? "", 10);
    const popularity = Number.parseInt(raw.Popularity ?? "", 10);
    const numberOfPlays = Number.parseInt(raw.NbPlays ?? "", 10);
    const themes = splitWords(raw.Themes);
    if (!puzzleId || !initialFen || !Number.isFinite(rating) || !Number.isFinite(popularity) || !Number.isFinite(numberOfPlays)) continue;
    if (rating < ratingMin || rating > ratingMax || popularity < minimumPopularity || numberOfPlays < minimumPlays) continue;
    if (!targetThemesFor({ themes }).length) continue;
    if (sourceIds.hasAndAdd(puzzleId)) {
      sourceDuplicates += 1;
      continue;
    }

    const moves = splitWords(raw.Moves);
    try {
      validateLichessPuzzle(initialFen, moves);
    } catch {
      invalid += 1;
      continue;
    }
    validMatching += 1;

    const ratingDeviation = Number.parseInt(raw.RatingDeviation ?? "", 10);
    const row: ImportRow = {
      lichess_puzzle_id: puzzleId,
      initial_fen: initialFen,
      moves,
      rating,
      rating_deviation: Number.isFinite(ratingDeviation) ? ratingDeviation : null,
      popularity,
      number_of_plays: numberOfPlays,
      themes,
      game_url: raw.GameUrl?.trim() || null,
      opening_tags: splitWords(raw.OpeningTags),
      random_key: Math.random(),
      is_active: true
    };

    if (mode === "fast") {
      tryAddFast(row, selected, selectedCounts, perTheme);
      if (quotasComplete(selectedCounts, perTheme)) break;
    } else {
      considerForReservoir(row, reservoirs, qualifyingCounts, perTheme);
    }
  }

  const finalSelection = mode === "fast" ? { selected, counts: selectedCounts } : finalizeReservoirs(reservoirs, perTheme);
  const rows = [...finalSelection.selected.values()];
  let inserted = 0;
  let updated = 0;
  if (!dryRun) {
    const supabase = createClient(
      requireEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    ({ inserted, updated } = await upsertRows(supabase, rows, batchSize));
  }

  console.log("\nLichess puzzle import complete");
  console.log(`Mode: ${mode}`);
  console.log(`Dry run: ${dryRun ? "yes (database unchanged)" : "no"}`);
  console.log(`Rows scanned: ${scanned.toLocaleString()}`);
  console.log(`Valid matching rows found: ${validMatching.toLocaleString()}`);
  console.log(`Unique rows selected: ${rows.length.toLocaleString()}`);
  console.log(`Rows imported this run: ${(inserted + updated).toLocaleString()}`);
  console.log(`New rows inserted: ${inserted.toLocaleString()}`);
  console.log(`Existing rows updated: ${updated.toLocaleString()}`);
  console.log(`Invalid rows skipped: ${(invalid + csvRowsSkipped).toLocaleString()} (${invalid.toLocaleString()} chess, ${csvRowsSkipped.toLocaleString()} CSV)`);
  console.log(`Duplicate source rows skipped: ${sourceDuplicates.toLocaleString()}`);
  for (const theme of lichessPuzzleThemes) console.log(`${theme}: ${finalSelection.counts[theme].toLocaleString()}`);
  if (!quotasComplete(finalSelection.counts, perTheme)) console.warn("The source ended before every target theme was filled.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
