"use client";

import { useEffect, useRef } from "react";
import { shouldClearBoardAnnotations } from "@/chess/components/boardAnnotations";

export function useOutsideBoardAnnotationClear(onClear?: () => void) {
  const boardRef = useRef<HTMLDivElement>(null);
  const onClearRef = useRef(onClear);

  useEffect(() => {
    onClearRef.current = onClear;
  }, [onClear]);

  useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      const target = event.target;
      const clickedInsideBoard = target instanceof Node && Boolean(boardRef.current?.contains(target));
      if (onClearRef.current && shouldClearBoardAnnotations(event.button, clickedInsideBoard)) {
        onClearRef.current();
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  return boardRef;
}
