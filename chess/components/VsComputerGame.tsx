"use client";

import { useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import { AcademyChessboard } from "@/chess/components/AcademyChessboard";
import { BoardCaptureParticles } from "@/chess/components/BoardCaptureParticles";
import { GameControls } from "@/chess/components/GameControls";
import { GameDialog } from "@/chess/components/GameDialog";
import { GameSetup } from "@/chess/components/GameSetup";
import { MoveHistory } from "@/chess/components/MoveHistory";
import { PlayerPanel } from "@/chess/components/PlayerPanel";
import { PromotionDialog } from "@/chess/components/PromotionDialog";
import { VictoryCelebration } from "@/chess/components/VictoryCelebration";
import { useComputerGame } from "@/chess/hooks/useComputerGame";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { AddToStudyDialog } from "@/chess/components/AddToStudyDialog";
import { createAnalysisTree } from "@/chess/analysis/tree";
import { BOARD_ANNOTATION_COLORS } from "@/chess/components/boardAnnotations";
import type { AvatarItem, StudentAvatarConfig } from "@/lib/types";

type Confirmation = "resign" | "new-game" | null;

const boardColumnStyle = {
  width: "min(100%, 700px, max(220px, calc(100svh - 25rem)))"
};

export function VsComputerGame({ studentName, studentAvatar, avatarItems, initialUnlockedBotIds }: { studentName: string; studentAvatar: StudentAvatarConfig; avatarItems: AvatarItem[]; initialUnlockedBotIds: string[] }) {
  const [unlockedBotIds, setUnlockedBotIds] = useState(initialUnlockedBotIds);
  const game = useComputerGame(setUnlockedBotIds);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [addStudyOpen, setAddStudyOpen] = useState(false);
  const [annotationMode, setAnnotationMode] = useState<"arrow" | "circle" | null>(null);
  const [annotationStart, setAnnotationStart] = useState<string | null>(null);
  const [boardArrows, setBoardArrows] = useState<Array<{ startSquare: string; endSquare: string; color: string }>>([]);
  const [boardCircles, setBoardCircles] = useState<Array<{ square: string; color: string }>>([]);
  const completedTree = useMemo(() => game.savedGameId ? createAnalysisTree(new Chess().fen(), game.moves) : null, [game.moves, game.savedGameId]);

  useEffect(() => {
    setBoardArrows([]);
    setBoardCircles([]);
    setAnnotationStart(null);
  }, [game.fen]);

  if (!game.config) return <GameSetup unlockedBotIds={unlockedBotIds} onStart={(config) => {
    clearBoardAnnotations();
    setAnnotationMode(null);
    game.startGame(config);
  }} />;

  const { config } = game;
  const opponentColor = config.humanColor === "white" ? "black" : "white";
  const opponentClock = opponentColor === "white" ? game.clockTimes.white : game.clockTimes.black;
  const playerClock = config.humanColor === "white" ? game.clockTimes.white : game.clockTimes.black;
  const status = game.outcome
    ? `${game.outcome.title}: ${game.outcome.message}`
    : game.engineError
      ? game.engineError
      : game.thinking
        ? `${config.bot.name} is thinking...`
        : game.humanTurn
          ? "Your move. Drag a piece or tap its start and destination squares."
          : "Preparing the computer's move...";

  function confirmAction() {
    if (confirmation === "resign") game.resign();
    if (confirmation === "new-game") game.leaveGame();
    setConfirmation(null);
  }

  function toggleLiveCircle(square: string, color = BOARD_ANNOTATION_COLORS.primary) {
    setBoardCircles((current) => {
      const existing = current.find((circle) => circle.square === square);
      return existing?.color === color
        ? current.filter((circle) => circle.square !== square)
        : [...current.filter((circle) => circle.square !== square), { square, color }];
    });
  }

  function handleAnnotationSquare(square: string) {
    if (annotationMode === "circle") {
      toggleLiveCircle(square);
      return;
    }
    if (annotationMode !== "arrow") return;
    if (!annotationStart) {
      setAnnotationStart(square);
      return;
    }
    if (annotationStart !== square) {
      setBoardArrows((current) => current.some((arrow) => arrow.startSquare === annotationStart && arrow.endSquare === square)
        ? current.filter((arrow) => !(arrow.startSquare === annotationStart && arrow.endSquare === square))
        : [...current, { startSquare: annotationStart, endSquare: square, color: BOARD_ANNOTATION_COLORS.primary }]);
    }
    setAnnotationStart(null);
  }

  function clearBoardAnnotations() {
    setBoardArrows((current) => current.length ? [] : current);
    setBoardCircles((current) => current.length ? [] : current);
    setAnnotationStart(null);
  }

  return (
    <div className="space-y-4">
      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,700px)_minmax(300px,1fr)]">
        <div
          className="mx-auto min-w-0 space-y-3"
          data-testid="game-board-column"
          style={boardColumnStyle}
        >
          <PlayerPanel
            name={config.bot.name}
            subtitle={`${config.bot.title} · estimated ${config.bot.estimatedRating}`}
            portrait={config.bot.portrait}
            clockMs={opponentClock}
            active={game.activeColor === opponentColor}
            thinking={game.thinking}
          />

          <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-cyan-200/20 bg-slate-950/70 p-1 sm:p-2">
            <AcademyChessboard
              fen={game.fen}
              orientation={game.boardOrientation}
              humanColor={config.humanColor}
              interactive={game.humanTurn}
              lastMove={game.lastMove}
              onMove={game.attemptHumanMove}
              arrows={boardArrows}
              circles={boardCircles}
              allowDrawingArrows
              annotationMode={annotationMode}
              onAnnotationSquare={handleAnnotationSquare}
              onArrowsChange={setBoardArrows}
              onCircleToggle={toggleLiveCircle}
              onClearAnnotations={clearBoardAnnotations}
            />
            <BoardCaptureParticles effect={game.captureEffect} orientation={game.boardOrientation} />
          </div>

          <PlayerPanel
            name={studentName}
            subtitle={`Playing ${config.humanColor} · ${config.timeControl.name}`}
            clockMs={playerClock}
            active={game.activeColor === config.humanColor}
            avatar={studentAvatar}
            avatarItems={avatarItems}
          />
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4">
          <Card className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-cyan-200">Game status</p>
                <h2 className="mt-1 text-xl font-black text-white">Vs {config.bot.name}</h2>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-slate-300">{config.timeControl.name}</span>
            </div>
            <div className={`mt-4 rounded-md border p-3 text-sm font-bold leading-5 ${game.engineError ? "border-rose-300/35 bg-rose-300/10 text-rose-100" : game.outcome ? "border-amber-300/35 bg-amber-300/10 text-amber-100" : "border-white/10 bg-white/5 text-slate-200"}`} aria-live="polite">
              {status}
            </div>
            {game.engineError && !game.outcome && <Button type="button" variant="secondary" className="mt-3" onClick={game.retryComputerMove}>Retry Computer Move</Button>}
            {game.saveStatus !== "idle" && (
              <p className={`mt-3 text-xs ${game.saveStatus === "failed" ? "text-rose-200" : game.saveStatus === "saved" ? "text-emerald-200" : "text-slate-400"}`} aria-live="polite">
                {game.saveStatus === "saving" ? "Saving completed game..." : game.saveMessage}
              </p>
            )}
          </Card>

          <Card className="p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-black text-white">Moves</h2>
              <span className="text-xs text-slate-500">SAN notation</span>
            </div>
            <MoveHistory moves={game.moves} />
          </Card>

          <Card className="p-4 sm:p-5">
            <h2 className="mb-3 font-black text-white">Game controls</h2>
            <GameControls
              canTakeBack={game.canTakeBack}
              muted={game.muted}
              onTakeBack={game.takeBack}
              onFlip={() => game.setBoardOrientation((value) => value === "white" ? "black" : "white")}
              onToggleMute={() => game.setMuted((value) => !value)}
              onResign={() => setConfirmation("resign")}
              onNewGame={() => game.outcome ? game.leaveGame() : setConfirmation("new-game")}
            />
            <div className="mt-4 border-t border-white/10 pt-4">
              <p className="mb-2 text-xs font-black uppercase tracking-wider text-cyan-200">Board drawings</p>
              <div className="flex flex-wrap gap-2" aria-label="Live board drawing tools">
                <Button type="button" aria-pressed={annotationMode === null} variant={annotationMode === null ? "secondary" : "ghost"} onClick={() => { setAnnotationMode(null); setAnnotationStart(null); }}>Move</Button>
                <Button type="button" aria-pressed={annotationMode === "arrow"} variant={annotationMode === "arrow" ? "secondary" : "ghost"} onClick={() => { setAnnotationMode("arrow"); setAnnotationStart(null); }}>Arrow</Button>
                <Button type="button" aria-pressed={annotationMode === "circle"} variant={annotationMode === "circle" ? "secondary" : "ghost"} onClick={() => { setAnnotationMode("circle"); setAnnotationStart(null); }}>Circle</Button>
                <Button type="button" variant="ghost" disabled={!boardArrows.length && !boardCircles.length} onClick={clearBoardAnnotations}>Clear</Button>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-400">Right-click a square for a circle or right-drag for an arrow. Shift/Ctrl draws red, Alt/Command blue, and both yellow. Touch players can use Arrow or Circle mode.</p>
            </div>
          </Card>
        </aside>
      </div>

      {game.pendingPromotion && (
        <PromotionDialog
          color={config.humanColor}
          onChoose={game.choosePromotion}
          onCancel={() => game.setPendingPromotion(null)}
        />
      )}

      {confirmation && (
        <GameDialog
          title={confirmation === "resign" ? "Resign this game?" : "Start a new game?"}
          description={confirmation === "resign" ? "This will end the current game as a loss." : "The current game is still active and will not be saved as completed."}
          primaryLabel={confirmation === "resign" ? "Resign" : "Start New Game"}
          onPrimary={confirmAction}
          secondaryLabel="Keep Playing"
          onSecondary={() => setConfirmation(null)}
        />
      )}

      {game.outcome && game.resultOpen && (
        <>
          {game.outcome.result === "win" ? <VictoryCelebration /> : null}
          <GameDialog
            title={game.outcome.title}
            description={game.outcome.message}
            primaryLabel="New Game"
            onPrimary={game.leaveGame}
            secondaryLabel="Review Board"
            onSecondary={() => game.setResultOpen(false)}
          >
            <div className={`mt-4 rounded-lg border p-4 text-center ${game.outcome.result === "win" ? "border-emerald-300/35 bg-emerald-300/10" : game.outcome.result === "loss" ? "border-rose-300/35 bg-rose-300/10" : "border-cyan-200/35 bg-cyan-300/10"}`}>
              <p className="text-3xl font-black text-white">{game.outcome.result === "win" ? "Victory!" : game.outcome.result === "loss" ? "Good game!" : "Draw"}</p>
            </div>
            {game.savedGameId && <Button className="mt-3 w-full" variant="secondary" href={`/student/play/game/${game.savedGameId}/analysis`}>Analyze Game</Button>}
            {game.savedGameId && <Button className="mt-2 w-full" variant="ghost" type="button" onClick={() => setAddStudyOpen(true)}>Add to Study</Button>}
          </GameDialog>
        </>
      )}
      {addStudyOpen && game.savedGameId && completedTree && <AddToStudyDialog gameId={game.savedGameId} gameTitle={`Game vs ${config.bot.name}`} analysisTree={completedTree} basePath="/student" onClose={() => setAddStudyOpen(false)} />}
    </div>
  );
}
