"use client";

import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from "react";
import {
  isAdventureHotspotDisabled,
  isAdventureHotspotVisible
} from "@/adventure/sceneHotspots";
import type {
  AdventureScene,
  AdventureSceneHotspotAction,
  AdventureSceneRuntimeState
} from "@/adventure/types";

type PercentRect = { x: number; y: number; width: number; height: number };

type AdventureSceneImageProps = {
  scene: AdventureScene;
  runtimeState: AdventureSceneRuntimeState;
  interactionLocked?: boolean;
  developerTools?: boolean;
  portrait: ReactNode;
  avatar: ReactNode;
  onAction: (action: AdventureSceneHotspotAction) => void;
};

const fullArtworkRect: PercentRect = { x: 0, y: 0, width: 100, height: 100 };

export function containedArtworkRect(imageWidth: number, imageHeight: number, stageAspectRatio = 16 / 9): PercentRect {
  if (imageWidth <= 0 || imageHeight <= 0) return fullArtworkRect;
  const imageAspectRatio = imageWidth / imageHeight;

  if (imageAspectRatio > stageAspectRatio) {
    const height = (stageAspectRatio / imageAspectRatio) * 100;
    return { x: 0, y: (100 - height) / 2, width: 100, height };
  }

  if (imageAspectRatio < stageAspectRatio) {
    const width = (imageAspectRatio / stageAspectRatio) * 100;
    return { x: (100 - width) / 2, y: 0, width, height: 100 };
  }

  return fullArtworkRect;
}

function roundPercent(value: number) {
  return Math.round(value * 10) / 10;
}

function pointerPercent(event: ReactPointerEvent<HTMLDivElement>) {
  const bounds = event.currentTarget.getBoundingClientRect();
  return {
    x: Math.min(100, Math.max(0, ((event.clientX - bounds.left) / bounds.width) * 100)),
    y: Math.min(100, Math.max(0, ((event.clientY - bounds.top) / bounds.height) * 100))
  };
}

function hotspotStyle(hotspot: PercentRect): CSSProperties {
  return {
    left: `${hotspot.x}%`,
    top: `${hotspot.y}%`,
    width: `${hotspot.width}%`,
    height: `${hotspot.height}%`
  };
}

export function AdventureSceneImage({
  scene,
  runtimeState,
  interactionLocked = false,
  developerTools = false,
  portrait,
  avatar,
  onAction
}: AdventureSceneImageProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [forceFallback, setForceFallback] = useState(false);
  const [artworkRect, setArtworkRect] = useState<PercentRect>(fullArtworkRect);
  const [editorOpen, setEditorOpen] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [selection, setSelection] = useState<PercentRect | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const draftStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setImageFailed(false);
    setForceFallback(false);
    setArtworkRect(fullArtworkRect);
    setEditorOpen(false);
    setCursor(null);
    setSelection(null);
    setStatusMessage("");
  }, [scene.backgroundImage, scene.id]);

  const hasArtwork = Boolean(scene.backgroundImage) && !imageFailed && !forceFallback;
  const hotspots = (scene.hotspots ?? []).filter((hotspot) => isAdventureHotspotVisible(hotspot, runtimeState));
  const snippet = selection
    ? JSON.stringify({
        x: roundPercent(selection.x),
        y: roundPercent(selection.y),
        width: roundPercent(selection.width),
        height: roundPercent(selection.height)
      })
    : "";

  function handleEditorPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const point = pointerPercent(event);
    setCursor(point);
    const start = draftStartRef.current;
    if (!start) return;
    setSelection({
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      width: Math.abs(point.x - start.x),
      height: Math.abs(point.y - start.y)
    });
  }

  function handleEditorPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const point = pointerPercent(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    draftStartRef.current = point;
    setCursor(point);
    setSelection({ x: point.x, y: point.y, width: 0, height: 0 });
  }

  function handleEditorPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    handleEditorPointerMove(event);
    draftStartRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  async function copySelection() {
    if (!snippet) return;
    console.info(`[Adventure hotspot] ${scene.id}`, snippet);
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(snippet);
      setStatusMessage("Hotspot coordinates copied and logged.");
    } catch {
      setStatusMessage("Hotspot coordinates logged. Clipboard access was unavailable.");
    }
  }

  return (
    <figure className="relative" aria-label={`${scene.title ?? scene.speaker} scene artwork`}>
      <div
        className="relative aspect-video overflow-hidden rounded-2xl border border-cyan-100/20 bg-slate-950 shadow-[inset_0_0_60px_rgba(2,6,23,.35)]"
        data-scene-id={scene.id}
        data-scene-fallback={hasArtwork ? undefined : "true"}
      >
        {hasArtwork && scene.backgroundImage ? (
          <Image
            src={scene.backgroundImage}
            alt={scene.backgroundAlt ?? `${scene.title ?? scene.speaker} scene`}
            fill
            priority={scene.id === "arrival"}
            sizes="(max-width: 768px) 100vw, 900px"
            className="object-contain"
            unoptimized
            onLoad={(event) => setArtworkRect(containedArtworkRect(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight))}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_68%_26%,rgba(250,204,21,.16),transparent_22rem),linear-gradient(135deg,#082f49_0%,#111827_52%,#3f0b1f_100%)] p-6 text-center">
            <div>
              <span className="text-5xl" aria-hidden="true">✦</span>
              <p className="mt-3 text-xs font-black uppercase tracking-[0.24em] text-cyan-100">Scene artwork unavailable</p>
              <p className="mt-2 max-w-md text-sm text-slate-300">The story and every scene action still work while this placeholder is shown.</p>
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/55 via-transparent to-slate-950/15" />

        <div
          className="absolute"
          style={{ left: `${artworkRect.x}%`, top: `${artworkRect.y}%`, width: `${artworkRect.width}%`, height: `${artworkRect.height}%` }}
          data-artwork-coordinate-layer
        >
          {hotspots.map((hotspot) => {
            const conditionDisabled = isAdventureHotspotDisabled(hotspot, runtimeState);
            const disabledReason = hotspot.disabledReason ?? "This path is not available yet.";
            return (
              <button
                key={hotspot.id}
                type="button"
                className={`group absolute z-20 rounded-xl border transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 ${editorOpen ? "pointer-events-none border-fuchsia-300/80 bg-fuchsia-300/15" : hotspot.importance === "primary" ? "border-amber-200/35 bg-amber-300/[0.06] hover:border-amber-100 hover:bg-amber-300/15" : "border-cyan-100/20 bg-cyan-300/[0.04] hover:border-cyan-100/70 hover:bg-cyan-300/12"} ${conditionDisabled ? "cursor-not-allowed border-slate-300/20 bg-slate-950/20" : "cursor-pointer"}`}
                style={hotspotStyle(hotspot)}
                disabled={interactionLocked}
                aria-disabled={conditionDisabled || interactionLocked}
                aria-label={conditionDisabled ? `${hotspot.label}. ${disabledReason}` : hotspot.label}
                data-hotspot-id={hotspot.id}
                data-hotspot-action={hotspot.action.type}
                onClick={() => {
                  if (conditionDisabled) {
                    setStatusMessage(disabledReason);
                    return;
                  }
                  setStatusMessage("");
                  onAction(hotspot.action);
                }}
              >
                <span className="absolute bottom-1 left-1/2 flex min-h-8 max-w-[calc(100%-0.5rem)] -translate-x-1/2 items-center gap-1 rounded-full border border-white/20 bg-slate-950/88 px-2 py-1 text-[10px] font-black leading-none text-white shadow-lg sm:text-xs">
                  <span aria-hidden="true">{conditionDisabled ? "🔒" : hotspot.icon ?? "✦"}</span>
                  <span className="truncate">{hotspot.shortLabel ?? hotspot.label}</span>
                </span>
                {editorOpen && <span className="absolute left-1 top-1 rounded bg-fuchsia-950/90 px-1.5 py-1 text-[10px] font-black text-fuchsia-100">{hotspot.id} · {hotspot.x}, {hotspot.y}, {hotspot.width}, {hotspot.height}</span>}
              </button>
            );
          })}

          {developerTools && editorOpen && (
            <div
              className="absolute inset-0 z-30 cursor-crosshair touch-none border-2 border-dashed border-fuchsia-300/80 bg-fuchsia-300/[0.03]"
              aria-label="Hotspot coordinate editor"
              onPointerMove={handleEditorPointerMove}
              onPointerDown={handleEditorPointerDown}
              onPointerUp={handleEditorPointerUp}
              onPointerCancel={() => { draftStartRef.current = null; }}
            >
              {selection && <div className="absolute border-2 border-amber-300 bg-amber-300/20" style={hotspotStyle(selection)} />}
            </div>
          )}
        </div>

        {!scene.hideArtworkOverlays && <div className="pointer-events-none absolute bottom-3 left-3 z-10 scale-75 origin-bottom-left sm:bottom-5 sm:left-5 sm:scale-100">{portrait}</div>}
        {!scene.hideArtworkOverlays && <div className="pointer-events-none absolute bottom-3 right-3 z-10 scale-75 origin-bottom-right sm:bottom-5 sm:right-5 sm:scale-100">{avatar}</div>}

        {developerTools && (
          <div className="absolute right-2 top-2 z-40 flex flex-wrap justify-end gap-2">
            <button type="button" className="min-h-9 rounded-md border border-fuchsia-200/50 bg-slate-950/90 px-3 py-2 text-xs font-black text-fuchsia-100 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-200" onClick={() => setEditorOpen((open) => !open)} aria-pressed={editorOpen}>{editorOpen ? "Close hotspot editor" : "Edit hotspots"}</button>
            <button type="button" className="min-h-9 rounded-md border border-slate-200/30 bg-slate-950/90 px-3 py-2 text-xs font-black text-slate-100 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200" onClick={() => setForceFallback((forced) => !forced)} aria-pressed={forceFallback}>{forceFallback ? "Restore artwork" : "Test fallback"}</button>
          </div>
        )}
      </div>

      {statusMessage && <p className="mt-2 rounded-lg border border-amber-200/25 bg-amber-300/10 px-3 py-2 text-sm font-bold text-amber-100" role="status">{statusMessage}</p>}

      {developerTools && editorOpen && (
        <figcaption className="mt-2 flex flex-col gap-2 rounded-xl border border-fuchsia-200/30 bg-fuchsia-950/25 p-3 text-xs text-fuchsia-50 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-black uppercase tracking-wider">Developer hotspot helper · {scene.id}</p>
            <p className="mt-1 font-mono">Cursor: {cursor ? `${roundPercent(cursor.x)}%, ${roundPercent(cursor.y)}%` : "move over the artwork"}</p>
            <p className="mt-1 font-mono break-all">Selection: {snippet || "drag a rectangle to measure x / y / width / height"}</p>
          </div>
          <button type="button" className="min-h-10 shrink-0 rounded-md border border-amber-200/50 bg-amber-300/15 px-3 py-2 font-black text-amber-100 disabled:cursor-not-allowed disabled:opacity-40" disabled={!selection || selection.width < 0.1 || selection.height < 0.1} onClick={() => void copySelection()}>Copy coordinates</button>
        </figcaption>
      )}
    </figure>
  );
}
