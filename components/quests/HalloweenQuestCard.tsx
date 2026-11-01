"use client";
import { SeasonalQuestCard } from "./SeasonalQuestCard";
import { HALLOWEEN_HUNT } from "@/lib/quests/seasonalBotHunts";
export function HalloweenQuestCard() { return <SeasonalQuestCard hunt={HALLOWEEN_HUNT} />; }
