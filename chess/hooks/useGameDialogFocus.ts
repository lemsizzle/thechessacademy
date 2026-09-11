"use client";

import { useEffect, useRef } from "react";
import { useLatestCallback } from "@/chess/hooks/useLatestCallback";

/** Keep keyboard gameplay inside an open modal and return focus when it closes. */
export function useGameDialogFocus(onDismiss?: () => void) {
  const dialogRef = useRef<HTMLElement>(null);
  const dismiss = useLatestCallback(() => onDismiss?.());

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const controls = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'
    )).filter((element) => element.getClientRects().length > 0);
    const focusFirst = () => (controls()[0] ?? dialog).focus({ preventScroll: true });
    focusFirst();

    function handleFocus(event: FocusEvent) {
      if (!dialog?.contains(event.target as Node)) focusFirst();
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        dismiss();
      }
      if (event.key !== "Tab") return;
      const items = controls();
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) { event.preventDefault(); dialog?.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    }
    document.addEventListener("focusin", handleFocus);
    document.addEventListener("keydown", handleKey, true);
    return () => {
      document.removeEventListener("focusin", handleFocus);
      document.removeEventListener("keydown", handleKey, true);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [dismiss]);

  return dialogRef;
}
