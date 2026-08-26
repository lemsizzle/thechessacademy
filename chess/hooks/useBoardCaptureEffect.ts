"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type BoardCaptureEffect = { id: number; square: string };

export function useBoardCaptureEffect() {
  const effectIdRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [captureEffect, setCaptureEffect] = useState<BoardCaptureEffect | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const clearCaptureEffect = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setCaptureEffect(null);
  }, []);

  const triggerCaptureEffect = useCallback((square: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    effectIdRef.current += 1;
    setCaptureEffect({ id: effectIdRef.current, square });
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setCaptureEffect(null);
    }, 800);
  }, []);

  return { captureEffect, clearCaptureEffect, triggerCaptureEffect };
}
