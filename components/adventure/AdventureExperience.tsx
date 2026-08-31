"use client";

import { useEffect, useState } from "react";
import { ADVENTURE_CHALLENGES, ADVENTURE_ENCOUNTER_START_SCENES, CHALLENGE_NEXT_SCENE, STORY_DEBUG_SCENE_GROUPS, STORY_SCENES } from "@/adventure/content";
import { applyAdventureChallengeCompletion, clearAdventureProgress, createNewAdventureProgress, loadAdventureProgress, saveAdventureProgress } from "@/adventure/localProgress";
import { PIECE_LESSON_INTROS } from "@/adventure/pieceLessonInfo";
import { enterAdventureScene, isAdventureHotspotEditorEnabled } from "@/adventure/sceneHotspots";
import type { AdventureChoice, AdventureLessonPiece, AdventureProgress, AdventurePuzzleRating, AdventureScene, AdventureSceneHotspotAction } from "@/adventure/types";
import { AdventureAvatar } from "@/components/adventure/AdventureAvatar";
import { AdventureBoardChallenge } from "@/components/adventure/AdventureBoardChallenge";
import { AdventureBook } from "@/components/adventure/AdventureBook";
import { AdventureBossGame } from "@/components/adventure/AdventureBossGame";
import { AdventureSceneImage } from "@/components/adventure/AdventureSceneImage";
import { BattlefieldCinematicHook } from "@/components/adventure/BattlefieldCinematicHook";
import { Button } from "@/components/Button";

const PIECE_KNOWLEDGE_IDS = ["pawn", "rook", "bishop", "queen", "king", "knight"];
const ADVENTURE_SCENE_DEVELOPER_TOOLS = isAdventureHotspotEditorEnabled(process.env.NODE_ENV);

const backgrounds: Record<AdventureScene["background"], string> = {
  road: "from-sky-950 via-slate-950 to-slate-900",
  inn: "from-amber-950 via-slate-950 to-slate-900",
  house: "from-violet-950 via-slate-950 to-slate-900",
  square: "from-rose-950 via-slate-950 to-slate-900",
  castle: "from-slate-950 via-rose-950 to-black"
};

const portraitStyles: Record<AdventureScene["portrait"], { icon: string; color: string; label: string }> = {
  narrator: { icon: "✦", color: "border-slate-200/20 bg-slate-800/80", label: "Scene illustration" },
  lem: { icon: "📖", color: "border-amber-200/40 bg-amber-300/15", label: "Lem portrait placeholder" },
  marge: { icon: "☕", color: "border-orange-200/40 bg-orange-300/15", label: "Marge portrait placeholder" },
  rookus: { icon: "🛡️", color: "border-rose-200/40 bg-rose-300/15", label: "Rookus portrait placeholder" },
  castler: { icon: "♜", color: "border-sky-200/40 bg-sky-300/15", label: "Castler portrait placeholder" },
  nate: { icon: "🃏", color: "border-fuchsia-200/40 bg-fuchsia-300/15", label: "Stale Nate portrait placeholder" },
  kingpin: { icon: "♛", color: "border-red-200/40 bg-red-300/15", label: "Kingpin portrait placeholder" },
  pip: { icon: "♟", color: "border-emerald-200/40 bg-emerald-300/15", label: "Pip portrait placeholder" }
};

function mergeUnique(existing: string[], additions: string[]) {
  return [...new Set([...existing, ...additions])];
}

function ScenePortrait({ portrait }: { portrait: AdventureScene["portrait"] }) {
  const style = portraitStyles[portrait];
  return (
    <div className={`grid h-28 w-28 place-items-center rounded-[2rem] border text-5xl shadow-[0_0_42px_rgba(255,255,255,.08)] sm:h-36 sm:w-36 sm:text-6xl ${style.color}`} role="img" aria-label={style.label}>
      {style.icon}
    </div>
  );
}

function RestorationMoment({ title, durationMs }: { title: string; durationMs: number }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), durationMs);
    return () => window.clearTimeout(timer);
  }, [durationMs]);

  if (!visible) return null;
  return <div className="adventure-restoration pointer-events-none absolute inset-0 z-30 grid place-items-center bg-[radial-gradient(circle_at_61%_58%,rgba(250,204,21,.48),rgba(15,23,42,.36)_34%,rgba(2,6,23,.72)_72%)] p-6" style={{ animationDuration: `${durationMs}ms` }} role="status" aria-live="polite">
    <div className="rounded-3xl border border-amber-100/60 bg-slate-950/80 px-7 py-5 text-center shadow-[0_0_70px_rgba(250,204,21,.48)] backdrop-blur-sm">
      <p className="text-xs font-black uppercase tracking-[0.3em] text-amber-200">Dad's army stirs</p>
      <p className="mt-2 text-3xl font-black text-white sm:text-5xl">{title}</p>
    </div>
  </div>;
}

const pieceMoveTargets: Record<AdventureLessonPiece, Array<[number, number]>> = {
  pawn: [[0, 0], [1, 0], [2, 0]],
  rook: [[1, 0], [0, 1], [2, 1], [1, 2]],
  bishop: [[0, 0], [2, 0], [0, 2], [2, 2]],
  queen: [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]],
  king: [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]],
  knight: [[1, 0], [3, 0], [0, 1], [4, 1], [0, 3], [4, 3], [1, 4], [3, 4]]
};

function PieceMoveDiagram({ piece }: { piece: AdventureLessonPiece }) {
  const intro = PIECE_LESSON_INTROS[piece];
  const boardSize = piece === "knight" ? 5 : 3;
  const center = Math.floor(boardSize / 2);
  const targets = pieceMoveTargets[piece];
  const caption = piece === "pawn"
    ? "Move forward ↑ · capture diagonally ↖ ↗"
    : piece === "knight"
      ? "An L: two squares, then one · jumps over pieces"
      : piece === "king"
        ? "One square in every direction"
        : "Glowing squares show the directions it can travel";

  return (
    <figure className="w-full max-w-[220px] rounded-2xl border border-cyan-100/20 bg-slate-950/60 p-3 text-center">
      <div className="mx-auto grid aspect-square w-full max-w-[160px] overflow-hidden rounded-lg border border-cyan-100/15" style={{ gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))` }} role="img" aria-label={`${intro.name} movement diagram`}>
        {Array.from({ length: boardSize * boardSize }, (_, index) => {
          const column = index % boardSize;
          const row = Math.floor(index / boardSize);
          const isCenter = column === center && row === center;
          const isTarget = targets.some(([targetColumn, targetRow]) => targetColumn === column && targetRow === row);
          return <div key={index} className={`grid place-items-center text-lg ${((column + row) % 2 === 0) ? "bg-cyan-950/80" : "bg-slate-800"}`}>{isCenter ? <span className="text-3xl drop-shadow-[0_0_12px_rgba(250,204,21,.8)]">{intro.symbol}</span> : isTarget ? <span className="text-amber-300 drop-shadow-[0_0_8px_rgba(250,204,21,.8)]">✦</span> : null}</div>;
        })}
      </div>
      <figcaption className="mt-3 text-xs font-bold leading-5 text-cyan-50">{caption}</figcaption>
    </figure>
  );
}

function PieceLessonStoryCard({ piece }: { piece: AdventureLessonPiece }) {
  const intro = PIECE_LESSON_INTROS[piece];
  return (
    <section className="mt-5 flex flex-col gap-4 rounded-2xl border border-cyan-200/25 bg-cyan-300/5 p-4 sm:flex-row sm:items-center sm:p-5" aria-label={`Meet the ${intro.name}`}>
      <PieceMoveDiagram piece={piece} />
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Meet {intro.character}</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1"><h3 className="text-2xl font-black text-white">{intro.name}</h3><span className="rounded-full border border-amber-200/30 bg-amber-300/10 px-3 py-1 text-xs font-black text-amber-100">Worth {intro.value}</span></div>
        <p className="mt-3 text-sm font-semibold leading-6 text-white">{intro.rule}</p>
        <p className="mt-2 text-sm leading-6 text-slate-300"><span className="font-black text-amber-200">Lem says:</span> {intro.reminder}</p>
      </div>
    </section>
  );
}

function InventoryPanel({ progress, onClose }: { progress: AdventureProgress; onClose: () => void }) {
  const hintCharms = progress.inventory["hint-charm"] ?? 0;
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/90 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="adventure-inventory-title">
      <section className="w-full max-w-lg rounded-2xl border border-cyan-200/30 bg-slate-950 p-6 shadow-[0_0_70px_rgba(34,211,238,.16)] sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200">Local prototype inventory</p>
            <h2 id="adventure-inventory-title" className="mt-1 text-3xl font-black text-white">Adventure Pack</h2>
          </div>
          <Button type="button" variant="ghost" onClick={onClose}>Close</Button>
        </div>
        <div className="mt-6 rounded-xl border border-amber-300/30 bg-amber-300/10 p-4">
          <p className="text-xs font-black uppercase tracking-wider text-amber-200">Prototype coins</p>
          <p className="mt-1 text-3xl font-black text-white">{progress.prototypeCoins}</p>
          <p className="mt-1 text-xs leading-5 text-slate-300">These are local Adventure rewards only. Your Academy balance is not changed in this slice.</p>
        </div>
        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between gap-3"><p className="font-black text-white">✨ Hint Charm</p><span className="rounded-full bg-cyan-300/15 px-3 py-1 text-sm font-black text-cyan-100">×{hintCharms}</span></div>
          <p className="mt-2 text-sm leading-6 text-slate-300">Use one during a board challenge to ask Lem for a more direct clue. It does not reveal the exact move.</p>
        </div>
      </section>
    </div>
  );
}

function InspectionPanel({ title, description, onClose }: { title: string; description: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/82 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="adventure-inspection-title">
      <section className="w-full max-w-lg rounded-2xl border border-cyan-200/30 bg-slate-950 p-6 shadow-[0_0_70px_rgba(34,211,238,.16)] sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200">Look closer</p>
        <h2 id="adventure-inspection-title" className="mt-2 text-3xl font-black text-white">{title}</h2>
        <p className="mt-4 text-base leading-7 text-slate-200">{description}</p>
        <Button type="button" className="mt-6" onClick={onClose} autoFocus>Return to the scene</Button>
      </section>
    </div>
  );
}

function StoryDebugPanel({ currentSceneId, onJump, onReplayCurrent, onClose }: { currentSceneId: string; onJump: (sceneId: string) => void; onReplayCurrent: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/90 p-4 backdrop-blur-sm sm:p-8" role="dialog" aria-modal="true" aria-labelledby="adventure-debug-title">
      <section className="mx-auto w-full max-w-4xl rounded-2xl border border-fuchsia-200/30 bg-slate-950 p-5 shadow-[0_0_80px_rgba(217,70,239,.14)] sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-200">Local prototype tool</p>
            <h2 id="adventure-debug-title" className="mt-1 text-3xl font-black text-white">Story Debug</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Jump straight to any Chapter 1 scene or board stage. This only changes Adventure progress saved in this browser.</p>
          </div>
          <Button type="button" variant="ghost" onClick={onClose}>Close</Button>
        </div>

        <div className="mt-6 rounded-xl border border-fuchsia-200/20 bg-fuchsia-300/5 p-4">
          <p className="text-xs font-black uppercase tracking-wider text-fuchsia-100">Current stage</p>
          <p className="mt-1 text-sm font-bold text-white">{STORY_SCENES[currentSceneId]?.title ?? STORY_SCENES[currentSceneId]?.speaker ?? currentSceneId}</p>
          <Button type="button" variant="secondary" className="mt-3" onClick={onReplayCurrent}>Restart this stage</Button>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {STORY_DEBUG_SCENE_GROUPS.map((group) => (
            <section key={group.label} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <h3 className="text-sm font-black text-cyan-100">{group.label}</h3>
              <div className="mt-3 grid gap-2">
                {group.sceneIds.map((sceneId) => {
                  const scene = STORY_SCENES[sceneId];
                  const challenge = scene.challengeId ? ADVENTURE_CHALLENGES[scene.challengeId] : null;
                  const label = challenge ? `${challenge.title} challenge` : scene.title ?? `${scene.speaker}'s scene`;
                  return <Button key={sceneId} type="button" variant={sceneId === currentSceneId ? "primary" : "secondary"} className="min-h-10 justify-start text-left text-sm" onClick={() => onJump(sceneId)}>{label}<span className="ml-auto text-xs opacity-60">{sceneId}</span></Button>;
                })}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}

export function AdventureExperience() {
  const [progress, setProgress] = useState<AdventureProgress | null>(null);
  const [mode, setMode] = useState<"loading" | "landing" | "story">("loading");
  const [showBook, setShowBook] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [showStoryDebug, setShowStoryDebug] = useState(false);
  const [practiceChallengeId, setPracticeChallengeId] = useState<string | null>(null);
  const [cinematicOpen, setCinematicOpen] = useState(false);
  const [bossActive, setBossActive] = useState(false);
  const [challengeRunKey, setChallengeRunKey] = useState(0);
  const [bossRunKey, setBossRunKey] = useState(0);
  const [activeInspection, setActiveInspection] = useState<{ title: string; description: string } | null>(null);

  useEffect(() => {
    setProgress(loadAdventureProgress());
    setMode("landing");
  }, []);

  useEffect(() => {
    setBossActive(false);
  }, [progress?.currentSceneId]);

  function updateProgress(update: (current: AdventureProgress) => AdventureProgress) {
    setProgress((current) => {
      if (!current) return current;
      const next = update(current);
      saveAdventureProgress(next);
      return next;
    });
  }

  function startNewAdventure() {
    if (progress && !window.confirm("Start Chapter 1 over? Your current local Adventure progress will be replaced.")) return;
    clearAdventureProgress();
    const fresh = createNewAdventureProgress();
    saveAdventureProgress(fresh);
    setProgress(fresh);
    setMode("story");
  }

  function goToScene(sceneId: string) {
    const nextScene = STORY_SCENES[sceneId];
    if (!nextScene) return;
    setActiveInspection(null);
    updateProgress((current) => enterAdventureScene(current, nextScene));
  }

  function openStoryDebug() {
    if (!progress) {
      const fresh = createNewAdventureProgress();
      saveAdventureProgress(fresh);
      setProgress(fresh);
    }
    setMode("story");
    setShowStoryDebug(true);
  }

  function jumpToDebugScene(sceneId: string) {
    setPracticeChallengeId(null);
    setCinematicOpen(false);
    setBossActive(false);
    setChallengeRunKey((key) => key + 1);
    setBossRunKey((key) => key + 1);
    goToScene(sceneId);
    setShowStoryDebug(false);
  }

  function replayCurrentStage() {
    setCinematicOpen(false);
    setChallengeRunKey((key) => key + 1);
    setBossRunKey((key) => key + 1);
    if (progress && STORY_SCENES[progress.currentSceneId]?.isBossSetup) setBossActive(true);
    setShowStoryDebug(false);
  }

  function choose(choice: AdventureChoice) {
    updateProgress((current) => {
      const targetScene = STORY_SCENES[choice.next];
      if (!targetScene) return current;
      const next = enterAdventureScene({ ...current, difficulty: choice.difficulty ?? current.difficulty }, targetScene);
      if (choice.difficulty && choice.difficulty !== "beginner") next.unlockedKnowledgeIds = mergeUnique(current.unlockedKnowledgeIds, PIECE_KNOWLEDGE_IDS);
      return next;
    });
  }

  function savePuzzleRating(puzzleId: string, rating: AdventurePuzzleRating) {
    updateProgress((current) => {
      const existing = current.puzzleRatings[puzzleId];
      const isBetter = !existing
        || rating.stars > existing.stars
        || (rating.stars === existing.stars && rating.bestMoves < existing.bestMoves);
      if (!isBetter) return current;
      return { ...current, puzzleRatings: { ...current.puzzleRatings, [puzzleId]: rating } };
    });
  }

  function completeChallenge(challengeId: string) {
    const challenge = ADVENTURE_CHALLENGES[challengeId];
    const nextSceneId = CHALLENGE_NEXT_SCENE[challengeId];
    if (!challenge || !nextSceneId) return;
    updateProgress((current) => {
      const rewardedProgress = applyAdventureChallengeCompletion(current, challenge);
      const nextScene = STORY_SCENES[nextSceneId];
      return nextScene ? enterAdventureScene(rewardedProgress, nextScene) : rewardedProgress;
    });
  }

  function finishChapter() {
    updateProgress((current) => enterAdventureScene({ ...current, chapterComplete: true }, STORY_SCENES.ending));
  }

  function handleSceneHotspotAction(action: AdventureSceneHotspotAction) {
    switch (action.type) {
      case "gotoScene":
        goToScene(action.sceneId);
        return;
      case "dialogue":
        goToScene(action.dialogueId);
        return;
      case "inspect":
        setActiveInspection({ title: action.title, description: action.description });
        return;
      case "startChallenge": {
        const challengeScene = Object.values(STORY_SCENES).find((candidate) => candidate.challengeId === action.challengeId);
        if (challengeScene) goToScene(challengeScene.id);
        return;
      }
      case "startEncounter": {
        const targetSceneId = ADVENTURE_ENCOUNTER_START_SCENES[action.encounterId];
        if (!targetSceneId) return;
        if (targetSceneId === progress?.currentSceneId && STORY_SCENES[targetSceneId]?.isBossSetup) {
          setBossActive(true);
          return;
        }
        goToScene(targetSceneId);
      }
    }
  }

  if (mode === "loading") return <div className="rounded-xl border border-white/10 bg-slate-950/60 p-6 text-sm text-slate-300">Opening the Adventure book…</div>;

  if (mode === "landing") {
    const canContinue = Boolean(progress?.started && !progress.chapterComplete);
    return (
      <section className="relative overflow-hidden rounded-2xl border border-cyan-100/20 bg-[radial-gradient(circle_at_75%_20%,rgba(250,204,21,.2),transparent_25rem),linear-gradient(135deg,#0c4a6e_0%,#111827_46%,#4c0519_100%)] p-6 shadow-[0_0_60px_rgba(34,211,238,.15)] sm:p-10">
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.07)_1px,transparent_1px)] [background-size:36px_36px]" />
        <div className="relative max-w-2xl">
          <p className="text-xs font-black uppercase tracking-[0.32em] text-cyan-100">A local Chapter 1 vertical slice</p>
          <h2 className="mt-3 text-4xl font-black text-white sm:text-6xl">Chess Adventure</h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-200 sm:text-lg">Return to occupied Pawnhaven, restore Dad's wooden chess army, and stand up to Kingpin.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            {canContinue && <Button type="button" onClick={() => setMode("story")}>Continue Adventure</Button>}
            <Button type="button" variant={canContinue ? "secondary" : "primary"} onClick={startNewAdventure}>{canContinue ? "Start Over" : "New Adventure"}</Button>
            {progress && <Button type="button" variant="ghost" onClick={() => setShowBook(true)}>Lem's Book</Button>}
            {progress && <Button type="button" variant="ghost" onClick={() => setShowInventory(true)}>Inventory</Button>}
            <Button type="button" variant="ghost" onClick={openStoryDebug}>Story Debug</Button>
          </div>
          <p className="mt-6 text-xs leading-5 text-slate-400">Progress and rewards are saved only in this browser for the prototype.</p>
        </div>
      </section>
    );
  }

  if (!progress) return null;
  const scene = STORY_SCENES[progress.currentSceneId] ?? STORY_SCENES.arrival;
  const challenge = scene.challengeId ? ADVENTURE_CHALLENGES[scene.challengeId] : null;
  const hintCharms = progress.inventory["hint-charm"] ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/60 p-3">
        <p className="text-xs font-bold text-slate-400">Saved locally ✓ · {progress.prototypeCoins} prototype coins · Hint Charm ×{hintCharms}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" onClick={() => setShowBook(true)}>Lem's Book</Button>
          <Button type="button" variant="ghost" onClick={() => setShowInventory(true)}>Inventory</Button>
          <Button type="button" variant="ghost" onClick={() => setShowStoryDebug(true)}>Story Debug</Button>
          <Button type="button" variant="ghost" onClick={() => setMode("landing")}>Adventure Home</Button>
        </div>
      </div>

      <section key={scene.id} className={`adventure-scene-fade relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${backgrounds[scene.background]} shadow-[0_0_50px_rgba(15,23,42,.55)]`}>
        <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_20%_25%,rgba(255,255,255,.26)_0_2px,transparent_3px),radial-gradient(circle_at_75%_55%,rgba(255,255,255,.17)_0_1px,transparent_2px)] [background-size:80px_80px]" />
        {scene.restoration && <RestorationMoment title={scene.restoration.title} durationMs={scene.restoration.durationMs} />}
        <div className="relative p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              {scene.title && <p className="text-xs font-black uppercase tracking-[0.26em] text-cyan-100">{scene.title}</p>}
              <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400">Interactive scene · {scene.background}</p>
            </div>
            {scene.hotspots?.length ? <p className="max-w-48 text-right text-[11px] font-bold text-cyan-100">Tap the marked people and objects to explore.</p> : null}
          </div>
          <div className="mt-4">
            <AdventureSceneImage
              scene={scene}
              runtimeState={progress}
              interactionLocked={Boolean(challenge || bossActive || activeInspection || practiceChallengeId || showBook || showInventory || showStoryDebug || cinematicOpen)}
              developerTools={ADVENTURE_SCENE_DEVELOPER_TOOLS}
              portrait={<ScenePortrait portrait={scene.portrait} />}
              avatar={<AdventureAvatar label="Your existing student avatar" />}
              onAction={handleSceneHotspotAction}
            />
          </div>
        </div>
        <div className="relative border-t border-white/10 bg-slate-950/90 p-5 sm:p-7">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-200">{scene.speaker}</p>
          <p className="mt-2 max-w-4xl text-base leading-7 text-white sm:text-lg">{scene.text}</p>
          {scene.pieceLesson && <PieceLessonStoryCard piece={scene.pieceLesson} />}
          {scene.choices && <div className="mt-5 grid gap-3 sm:grid-cols-2">{scene.choices.map((choice) => <Button key={choice.label} type="button" variant="secondary" className="min-h-12 justify-start text-left" onClick={() => choose(choice)}>{choice.label}</Button>)}</div>}
          {scene.next && !scene.choices && <Button type="button" className="mt-5" onClick={() => goToScene(scene.next!)}>Next <span aria-hidden="true">▶</span></Button>}
        </div>
      </section>

      {challenge && <AdventureBoardChallenge key={`${challenge.id}-${challengeRunKey}`} challenge={challenge} onComplete={() => completeChallenge(challenge.id)} puzzleRatings={progress.puzzleRatings} onPuzzleRated={savePuzzleRating} />}

      {scene.isBossSetup && !bossActive && <section className="rounded-2xl border border-rose-200/25 bg-rose-950/25 p-6 sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-rose-200">Boss preparation</p>
        <h2 className="mt-2 text-3xl font-black text-white">Ready to challenge Kingpin?</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200">This first boss is untimed and uses the existing in-browser Academy chess opponent. You can review rules or your local items first.</p>
        <div className="mt-6 flex flex-wrap gap-3"><Button type="button" variant="secondary" onClick={() => setShowBook(true)}>Review Lem's Book</Button><Button type="button" variant="secondary" onClick={() => setShowInventory(true)}>Inventory</Button><Button type="button" onClick={() => setBossActive(true)}>Challenge Kingpin</Button></div>
      </section>}

      {scene.isBossSetup && bossActive && <AdventureBossGame key={bossRunKey} onRetreat={() => setBossActive(false)} onCheckmate={() => setCinematicOpen(true)} onFinishChapter={finishChapter} />}

      {scene.isEnding && <section className="rounded-2xl border border-emerald-200/30 bg-emerald-300/10 p-7 text-center shadow-[0_0_48px_rgba(52,211,153,.1)]">
        <p className="text-xs font-black uppercase tracking-[0.26em] text-emerald-200">Chapter complete</p>
        <h2 className="mt-2 text-3xl font-black text-white">Pawnhaven is free — for now.</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-200">Chapter 2 and the final battlefield scenes are not part of this local slice yet. Your Chapter 1 completion remains saved in this browser.</p>
        <Button type="button" className="mt-6" onClick={() => setMode("landing")}>Back to Adventure Home</Button>
      </section>}

      {showBook && <AdventureBook progress={progress} onClose={() => setShowBook(false)} onPractice={(challengeId) => { setShowBook(false); setPracticeChallengeId(challengeId); }} />}
      {showInventory && <InventoryPanel progress={progress} onClose={() => setShowInventory(false)} />}
      {showStoryDebug && <StoryDebugPanel currentSceneId={scene.id} onJump={jumpToDebugScene} onReplayCurrent={replayCurrentStage} onClose={() => setShowStoryDebug(false)} />}
      {activeInspection && <InspectionPanel title={activeInspection.title} description={activeInspection.description} onClose={() => setActiveInspection(null)} />}
      {practiceChallengeId && ADVENTURE_CHALLENGES[practiceChallengeId] && <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/95 p-4 backdrop-blur-sm sm:p-8" role="dialog" aria-modal="true" aria-label="Practice challenge"><div className="mx-auto w-full max-w-5xl"><div className="mb-4 flex items-center justify-between gap-3"><p className="text-sm font-black text-cyan-100">Lem's Book · practice again</p><Button type="button" variant="ghost" onClick={() => setPracticeChallengeId(null)}>Close practice</Button></div><AdventureBoardChallenge key={`${practiceChallengeId}-${challengeRunKey}`} compact challenge={ADVENTURE_CHALLENGES[practiceChallengeId]} onComplete={() => setPracticeChallengeId(null)} puzzleRatings={progress.puzzleRatings} onPuzzleRated={savePuzzleRating} /></div></div>}
      {cinematicOpen && <BattlefieldCinematicHook onDismiss={() => setCinematicOpen(false)} />}
    </div>
  );
}
