"use client";

import { useCallback, useRef } from "react";

/**
 * Keyboard navigation for editable tables.
 * Mark every editable control with `data-grid-cell`. Inside the container:
 *   Enter  → next cell (Shift+Enter → previous); on the last cell, `onEnd()` (e.g. add a row)
 *   Tab    → native behaviour (already moves to the next cell)
 *   Escape → restore the value the field had when it got focus, then blur
 */
export function useGridNav(onEnd?: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const snapshot = useRef<{ el: HTMLElement; value: string } | null>(null);

  const cells = () =>
    Array.from(ref.current?.querySelectorAll<HTMLElement>("[data-grid-cell]:not([disabled])") ?? []).filter(
      (el) => el.offsetParent !== null, // visible only (desktop table vs mobile cards)
    );

  const focusCell = useCallback((el: HTMLElement | undefined) => {
    if (!el) return;
    el.focus();
    if (el instanceof HTMLInputElement && el.type !== "date") el.select();
  }, []);

  /** Move focus to the cell after `from` (or after the active element). */
  const next = useCallback(
    (from?: HTMLElement | null, dir: 1 | -1 = 1) => {
      const list = cells();
      const cur = from ?? (document.activeElement as HTMLElement | null);
      const i = cur ? list.indexOf(cur) : -1;
      if (dir === 1 && i === list.length - 1) {
        onEnd?.();
        return;
      }
      focusCell(list[i + dir]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onEnd, focusCell],
  );

  const onFocus = (e: React.FocusEvent) => {
    const el = e.target as HTMLElement;
    if (!el.hasAttribute("data-grid-cell")) return;
    if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) snapshot.current = { el, value: el.value };
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const el = e.target as HTMLElement;
    if (!el.hasAttribute("data-grid-cell")) return;
    // let open comboboxes / selects handle their own keys
    if (el.getAttribute("aria-expanded") === "true") return;

    if (e.key === "Enter" && !(el instanceof HTMLButtonElement)) {
      e.preventDefault();
      next(el, e.shiftKey ? -1 : 1);
    } else if (e.key === "Escape" && snapshot.current?.el === el) {
      e.preventDefault();
      const input = el as HTMLInputElement;
      if (input.value !== snapshot.current.value) {
        // set through the native setter so React's onChange fires
        const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(input, snapshot.current.value);
        input.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
      }
      input.blur();
    }
  };

  return { ref, next, focusCell, cells, containerProps: { ref, onFocus, onKeyDown } };
}
