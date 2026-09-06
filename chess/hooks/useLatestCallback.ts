"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

/** Third-party drag handlers can retain callbacks for the entire gesture. */
export function useLatestCallback<Args extends unknown[], Result>(callback: (...args: Args) => Result) {
  const latest = useRef(callback);
  useLayoutEffect(() => { latest.current = callback; });
  return useCallback((...args: Args) => latest.current(...args), []);
}
