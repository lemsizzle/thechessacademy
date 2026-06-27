import type { QuestTimeWindow } from "@/lib/types";

export const DEFAULT_QUEST_TIMEZONE = "America/Vancouver";

export type QuestWindow = {
  start: Date;
  end: Date;
  label: string;
};

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function zonedDate(year: number, month: number, day: number, timeZone: string) {
  const guess = new Date(Date.UTC(year, month - 1, day));
  const parts = zonedParts(guess, timeZone);
  const localAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return new Date(guess.getTime() - (localAsUtc - guess.getTime()));
}

function localDateParts(now: Date, timeZone: string) {
  const parts = zonedParts(now, timeZone);
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

function addDays(date: { year: number; month: number; day: number }, amount: number) {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + amount));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

function dateLabel(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function zonedWeekday(date: Date, timeZone: string) {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
  const index = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  return index >= 0 ? index : 0;
}

export function getCurrentDayWindow(timeZone = DEFAULT_QUEST_TIMEZONE, now = new Date()): QuestWindow {
  const local = localDateParts(now, timeZone);
  const start = zonedDate(local.year, local.month, local.day, timeZone);
  const tomorrow = addDays(local, 1);
  const end = new Date(zonedDate(tomorrow.year, tomorrow.month, tomorrow.day, timeZone).getTime() - 1);
  return { start, end, label: dateLabel(start, timeZone) };
}

export function getCurrentWeekWindow(timeZone = DEFAULT_QUEST_TIMEZONE, now = new Date()): QuestWindow {
  const day = getCurrentDayWindow(timeZone, now);
  const weekday = zonedWeekday(now, timeZone);
  const local = localDateParts(day.start, timeZone);
  const monday = addDays(local, -((weekday + 6) % 7));
  const nextMonday = addDays(monday, 7);
  const start = zonedDate(monday.year, monday.month, monday.day, timeZone);
  const end = new Date(zonedDate(nextMonday.year, nextMonday.month, nextMonday.day, timeZone).getTime() - 1);
  return { start, end, label: `${dateLabel(start, timeZone)} to ${dateLabel(end, timeZone)}` };
}

export function getCurrentMonthWindow(timeZone = DEFAULT_QUEST_TIMEZONE, now = new Date()): QuestWindow {
  const local = localDateParts(now, timeZone);
  const start = zonedDate(local.year, local.month, 1, timeZone);
  const nextMonth = local.month === 12 ? { year: local.year + 1, month: 1 } : { year: local.year, month: local.month + 1 };
  const end = new Date(zonedDate(nextMonth.year, nextMonth.month, 1, timeZone).getTime() - 1);
  return { start, end, label: new Intl.DateTimeFormat("en-US", { timeZone, month: "long", year: "numeric" }).format(start) };
}

export function getCustomWindow(start: string | Date, end: string | Date): QuestWindow {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return { start: startDate, end: endDate, label: `${startDate.toISOString()} to ${endDate.toISOString()}` };
}

export function getQuestWindow(timeWindow: QuestTimeWindow = "weekly", timeZone = DEFAULT_QUEST_TIMEZONE, now = new Date()) {
  if (timeWindow === "daily") return getCurrentDayWindow(timeZone, now);
  if (timeWindow === "monthly") return getCurrentMonthWindow(timeZone, now);
  if (timeWindow === "all_time") return getCustomWindow(new Date(0), now);
  return getCurrentWeekWindow(timeZone, now);
}
