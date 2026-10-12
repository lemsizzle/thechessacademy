"use client";

import { GameBoardWorkspace } from "@/chess/components/GameBoardWorkspace";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import { AcademyChessboard } from "@/chess/components/AcademyChessboard";
import { BoardSettings } from "@/chess/components/BoardSettings";
import { BoardCaptureParticles } from "@/chess/components/BoardCaptureParticles";
import { GameControls } from "@/chess/components/GameControls";
import { GameDialog } from "@/chess/components/GameDialog";
import { CompletedGameActions } from "@/chess/components/CompletedGameActions";
import { GameSetup } from "@/chess/components/GameSetup";
import { MoveHistory } from "@/chess/components/MoveHistory";
import { PlayerPanel } from "@/chess/components/PlayerPanel";
import { PromotionDialog } from "@/chess/components/PromotionDialog";
import { useComputerGame } from "@/chess/hooks/useComputerGame";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { AddToStudyDialog } from "@/chess/components/AddToStudyDialog";
import { createAnalysisTree } from "@/chess/analysis/tree";
import { BOARD_ANNOTATION_COLORS } from "@/chess/components/boardAnnotations";
import { materialAdvantageForColor, whiteMaterialAdvantage } from "@/chess/game/material";
import type { AvatarItem, StudentAvatarConfig, DisplayedBadge } from "@/lib/types";

type Confirmation = "resign" | "new-game" | null;

export function VsComputerGame({ studentName, studentAvatar, avatarItems, initialUnlockedBotIds, displayedBadge }: { studentName: string; studentAvatar: StudentAvatarConfig; avatarItems: AvatarItem[]; initialUnlockedBotIds: string[]; displayedBadge?: DisplayedBadge | null }) {
  const [unlockedBotIds, setUnlockedBotIds] = useState(initialUnlockedBotIds);
  const game = useComputerGame(setUnlockedBotIds);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [addStudyOpen, setAddStudyOpen] = useState(false);
  const [annotationMode, setAnnotationMode] = useState<"arrow" | "circle" | null>(null);
  const [annotationStart, setAnnotationStart] = useState<string | null>(null);
  const [boardArrows, setBoardArrows] = useState<Array<{ startSquare: string; endSquare: string; color: string }>>([]);
  const [boardCircles, setBoardCircles] = useState<Array<{ square: string; color: string }>>([]);
  const completedTree = useMemo(() => game.savedGameId ? createAnalysisTree(new Chess().fen(), game.moves) : null, [game.moves, game.savedGameId]);
  const materialBalance = useMemo(() => whiteMaterialAdvantage(game.fen), [game.fen]);

  useEffect(() => {
    setBoardArrows([]);
    setBoardCircles([]);
    setAnnotationStart(null);
  }, [game.fen]);

  const displayedPremove = useMemo<[string, string] | null>(
    () => game.premove ? [game.premove.from, game.premove.to] : null,
    [game.premove]
  );

  const toggleLiveCircle = useCallback((square: string, color = BOARD_ANNOTATION_COLORS.primary) => {
    setBoardCircles((current) => {
      const existing = current.find((circle) => circle.square === square);
      return existing?.color === color
        ? current.filter((circle) => circle.square !== square)
        : [...current.filter((circle) => circle.square !== square), { square, color }];
    });
  }, []);

  const handleAnnotationSquare = useCallback((square: string) => {
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
  }, [annotationMode, annotationStart, toggleLiveCircle]);

  const clearBoardAnnotations = useCallback(() => {
    setBoardArrows((current) => current.length ? [] : current);
    setBoardCircles((current) => current.length ? [] : current);
    setAnnotationStart(null);
  }, []);

  const enableBoardMoves = useCallback(() => {
    setAnnotationMode(null);
    setAnnotationStart(null);
  }, []);

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
      : game.premoveMessage
        ? game.premoveMessage
      : game.thinking
        ? game.premove
          ? `${config.bot.name} is thinking. Your premove is queued.`
          : `${config.bot.name} is thinking. You can queue a premove.`
        : game.humanTurn
          ? "Your move. Drag a piece or tap its start and destination squares."
          : "Preparing the computer's move...";

  function confirmAction() {
    if (confirmation === "resign") game.resign();
    if (confirmation === "new-game") game.leaveGame();
    setConfirmation(null);
  }

  const opponentPanel = <PlayerPanel
    compact
    name={config.bot.name}
    subtitle={config.bot.title}
    portrait={config.bot.portrait}
    clockMs={opponentClock}
    active={game.activeColor === opponentColor}
    thinking={game.thinking}
    materialAdvantage={materialAdvantageForColor(materialBalance, opponentColor)}
  />;
  const studentPanel = <PlayerPanel
    compact
    name={studentName}
    studentId={studentAvatar.studentId}
    displayedBadge={displayedBadge}
    subtitle={`Playing ${config.humanColor} · ${config.timeControl.name}`}
    clockMs={playerClock}
    active={game.activeColor === config.humanColor}
    avatar={studentAvatar}
    avatarItems={avatarItems}
    materialAdvantage={materialAdvantageForColor(materialBalance, config.humanColor)}
  />;

  return (
    <div className="space-y-4">
      <GameBoardWorkspace
        onCancelPremove={game.cancelPremove}
        onEnterZen={enableBoardMoves}
        attentionRequired={Boolean(game.engineError)}
        revealOnMount
        revealResult={game.resultOpen && Boolean(game.outcome)}
        title={`Computer · ${config.timeControl.name}`}
        settings={<BoardSettings muted={game.muted} onToggleMuted={() => game.setMuted((value) => !value)} />}
        opponent={game.boardOrientation === config.humanColor ? opponentPanel : studentPanel}
        player={game.boardOrientation === config.humanColor ? studentPanel : opponentPanel}
        board={
          <div className="game-board-surface">
            <AcademyChessboard
              fen={game.fen}
              orientation={game.boardOrientation}
              humanColor={config.humanColor}
              interactive={game.humanTurn || game.canQueuePremove}
              lastMove={game.lastMove}
              onMove={game.attemptHumanMove}
              allowPremoves={game.canQueuePremove}
              premove={displayedPremove}
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
        }
      >
      {game.outcome && game.resultOpen && (
        <>
          <GameDialog inline             tone={game.outcome.result === "loss" ? "loss" : "default"}
            title={game.outcome.title}
            description={game.outcome.message}
            primaryLabel="New Game"
            onPrimary={game.leaveGame}
            secondaryLabel="Review Board"
            onSecondary={() => game.setResultOpen(false)}
          >
            <CompletedGameActions gameId={game.savedGameId} saveFailed={game.saveStatus === "failed"} />
            <div className={`mt-4 rounded-lg border p-4 text-center ${game.outcome.result === "win" ? "border-emerald-300/35 bg-emerald-300/10" : game.outcome.result === "loss" ? "border-rose-300/35 bg-rose-300/10" : "border-cyan-200/35 bg-cyan-300/10"}`}>
              <p className="text-3xl font-black text-white">{game.outcome.result === "win" ? "Victory!" : game.outcome.result === "loss" ? "Defeat — good effort" : "Draw"}</p>
            </div>
            {game.savedGameId && <Button className="mt-2 w-full" variant="ghost" type="button" onClick={() => setAddStudyOpen(true)}>Add to Study</Button>}
          </GameDialog>
        </>
      )}

          <Card className="game-primary-controls p-3">
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
            <details className="mt-2 border-t border-white/10" onToggle={(event) => { if (!event.currentTarget.open) { setAnnotationMode(null); setAnnotationStart(null); } }}>
              <summary>Board drawings</summary>
              <div className="flex flex-wrap gap-2" aria-label="Live board drawing tools">
                <Button type="button" aria-pressed={annotationMode === null} variant={annotationMode === null ? "secondary" : "ghost"} onClick={() => { setAnnotationMode(null); setAnnotationStart(null); }}>Move</Button>
                <Button type="button" aria-pressed={annotationMode === "arrow"} variant={annotationMode === "arrow" ? "secondary" : "ghost"} onClick={() => { setAnnotationMode("arrow"); setAnnotationStart(null); }}>Arrow</Button>
                <Button type="button" aria-pressed={annotationMode === "circle"} variant={annotationMode === "circle" ? "secondary" : "ghost"} onClick={() => { setAnnotationMode("circle"); setAnnotationStart(null); }}>Circle</Button>
                <Button type="button" variant="ghost" disabled={!boardArrows.length && !boardCircles.length} onClick={clearBoardAnnotations}>Clear</Button>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-400">Right-click a square for a circle or right-drag for an arrow. Shift/Ctrl draws red, Alt/Command blue, and both yellow. Touch players can use Arrow or Circle mode.</p>
            </details>
          </Card>

          <Card className="p-3">
            <div className={`rounded-md border p-3 text-sm font-bold leading-5 ${game.engineError ? "border-rose-300/35 bg-rose-300/10 text-rose-100" : game.outcome ? "border-amber-300/35 bg-amber-300/10 text-amber-100" : "border-white/10 bg-white/5 text-slate-200"}`} aria-live="polite">
              {status}
            </div>
            {game.premove ? (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-fuchsia-300/30 bg-fuchsia-300/10 p-3 text-sm font-bold text-fuchsia-100">
                <span>Premove: {game.premove.from} → {game.premove.to}</span>
                <Button type="button" variant="ghost" className="px-3 py-1.5 text-xs" onClick={game.cancelPremove}>Cancel</Button>
              </div>
            ) : null}
            {game.engineError && !game.outcome && <Button data-game-attention type="button" variant="secondary" className="mt-3" onClick={game.retryComputerMove}>Retry Computer Move</Button>}
            {game.saveStatus !== "idle" && (
              <p className={`mt-3 text-xs ${game.saveStatus === "failed" ? "text-rose-200" : game.saveStatus === "saved" ? "text-emerald-200" : "text-slate-400"}`} aria-live="polite">
                {game.saveStatus === "saving" ? "Saving completed game..." : game.saveMessage}
              </p>
            )}
            {game.outcome && !game.resultOpen && <CompletedGameActions gameId={game.savedGameId} saveFailed={game.saveStatus === "failed"} />}
          </Card>

          <Card className="p-3">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-black text-white">Moves</h2>
              <span className="text-xs text-slate-500">SAN notation</span>
            </div>
            <MoveHistory moves={game.moves} />
          </Card>

      </GameBoardWorkspace>

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

      {addStudyOpen && game.savedGameId && completedTree && <AddToStudyDialog gameId={game.savedGameId} gameTitle={`Game vs ${config.bot.name}`} analysisTree={completedTree} basePath="/student" onClose={() => setAddStudyOpen(false)} />}
    </div>
  );
}
