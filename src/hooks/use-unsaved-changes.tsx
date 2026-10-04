"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/**
 * Guards a dirty form:
 *  - browser close / reload → native prompt
 *  - in-app link clicks     → Zewin "Unsaved Changes" dialog (Stay / Leave)
 *  - `guard(href)`          → use for Cancel buttons
 */
export function useUnsavedChanges(dirty: boolean) {
  const router = useRouter();
  const { dict } = useI18n();
  const [pending, setPending] = useState<string | null>(null);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      if (!dirtyRef.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
      const a = (e.target as HTMLElement).closest("a");
      if (!a || a.target === "_blank" || !a.href) return;
      const url = new URL(a.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      setPending(url.pathname + url.search);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  const guard = useCallback(
    (href: string) => {
      if (dirtyRef.current) setPending(href);
      else router.push(href);
    },
    [router],
  );

  const dialog = (
    <ConfirmDialog
      open={pending !== null}
      onClose={() => setPending(null)}
      onConfirm={() => {
        const href = pending!;
        dirtyRef.current = false;
        setPending(null);
        router.push(href);
      }}
      title={dict.common.unsavedTitle}
      body={dict.common.unsavedBody}
      confirmLabel={dict.common.leave}
      cancelLabel={dict.common.stay}
    />
  );

  return { guard, dialog };
}
