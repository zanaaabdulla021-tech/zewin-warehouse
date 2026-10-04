"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock, RotateCcw } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { useToast } from "@/components/ui/toast";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { Button } from "@/components/ui/button";
import { ACTIONS, MODULES, type Action, type Module } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { saveRolePermissions } from "../actions";

type RoleRow = { id: string; key: string; name: string; users: number; matrix: Partial<Record<Module, Action[]>> };

/** Which actions make sense per module — the rest are shown as "—". */
const APPLICABLE: Record<Module, Action[]> = {
  dashboard: ["view"],
  warehouses: ["view", "create", "edit", "delete", "export"],
  products: ["view", "create", "edit", "delete", "export"],
  stock: ["view", "create", "edit", "approve", "export"],
  documents: ["view", "create", "edit", "delete", "approve", "export"],
  accounting: ["view", "verify", "approve", "export"],
  suppliers: ["view", "create", "edit", "delete", "export"],
  reports: ["view", "export"],
  employees: ["view", "create", "edit", "delete", "export"],
  settings: ["view", "edit"],
};

export function RoleMatrix({ roles }: { roles: RoleRow[] }) {
  const { dict, t } = useI18n();
  const e = dict.employees;
  const toast = useToast();
  const router = useRouter();
  const [activeId, setActiveId] = useState(roles.find((r) => r.key !== "SUPER_ADMIN")?.id ?? roles[0]!.id);
  const role = roles.find((r) => r.id === activeId)!;
  const [draft, setDraft] = useState(() => structuredClone(role.matrix));
  const [saving, start] = useTransition();
  const locked = role.key === "SUPER_ADMIN";
  const dirty = useMemo(() => JSON.stringify(normalise(draft)) !== JSON.stringify(normalise(role.matrix)), [draft, role]);
  const { dialog } = useUnsavedChanges(dirty);

  function normalise(m: Partial<Record<Module, Action[]>>) {
    return MODULES.map((mod) => [mod, [...(m[mod] ?? [])].sort()]);
  }

  const pick = (id: string) => {
    if (dirty && !confirm(dict.common.unsavedBody)) return;
    const r = roles.find((x) => x.id === id)!;
    setActiveId(id);
    setDraft(structuredClone(r.matrix));
  };

  const has = (m: Module, a: Action) => locked || (draft[m] ?? []).includes(a);
  const toggle = (m: Module, a: Action) => {
    if (locked) return;
    setDraft((d) => {
      const cur = new Set(d[m] ?? []);
      if (cur.has(a)) {
        cur.delete(a);
        if (a === "view") cur.clear(); // no view → nothing else in that module
      } else {
        cur.add(a);
        cur.add("view"); // any action implies view
      }
      return { ...d, [m]: [...cur] };
    });
  };
  const toggleRow = (m: Module) => {
    if (locked) return;
    const all = APPLICABLE[m].every((a) => has(m, a));
    setDraft((d) => ({ ...d, [m]: all ? [] : [...APPLICABLE[m]] }));
  };

  const save = () =>
    start(async () => {
      const res = await saveRolePermissions(role.id, draft);
      if (res.ok) {
        toast({ tone: "success", title: `✓ ${t(e.roleSaved, { role: role.name })}` });
        router.refresh();
      } else toast({ tone: "error", title: res.message });
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      {/* Role list */}
      <div className="zw-scroll -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0">
        {roles.map((r) => (
          <button
            key={r.id}
            onClick={() => pick(r.id)}
            aria-pressed={r.id === activeId}
            className={cn(
              "zw-card flex shrink-0 items-center gap-3 px-4 py-3 text-start transition-all",
              r.id === activeId ? "border-brand-500 ring-2 ring-brand-500/15" : "hover:border-line-strong",
            )}
          >
            <span className="flex-1">
              <span className="block text-[14px] font-semibold text-ink">{r.name}</span>
              <span className="block text-[12px] text-ink-muted">{t(e.usersInRole, { n: r.users })}</span>
            </span>
            {r.key === "SUPER_ADMIN" && <Lock className="h-4 w-4 text-ink-faint" />}
          </button>
        ))}
      </div>

      {/* Matrix */}
      <div className="zw-card overflow-hidden">
        {locked && (
          <div className="flex items-center gap-2 border-b border-line bg-canvas/70 px-5 py-3 text-[13.5px] text-ink-muted">
            <Lock className="h-4 w-4" />
            {e.superAdminLocked}
          </div>
        )}
        <div className="zw-scroll overflow-x-auto">
          <table className="w-full min-w-[720px] text-[14px]">
            <thead>
              <tr className="border-b border-line bg-canvas/60 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
                <th className="sticky start-0 bg-canvas px-5 py-3 text-start">{dict.settings.auditModule}</th>
                {ACTIONS.map((a) => (
                  <th key={a} className="px-2 py-3 text-center">
                    {e.actions[a]}
                  </th>
                ))}
                <th className="px-3 py-3 text-center">{e.selectAll}</th>
              </tr>
            </thead>
            <tbody>
              {MODULES.map((m) => (
                <tr key={m} className="border-b border-line last:border-0">
                  <th scope="row" className="sticky start-0 bg-white px-5 py-3 text-start font-medium text-ink">
                    {dict.nav[m]}
                  </th>
                  {ACTIONS.map((a) => (
                    <td key={a} className="px-2 py-2 text-center">
                      {APPLICABLE[m].includes(a) ? (
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={has(m, a)}
                          aria-label={`${dict.nav[m]} — ${e.actions[a]}`}
                          disabled={locked}
                          onClick={() => toggle(m, a)}
                          className={cn(
                            "inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors focus-visible:shadow-focus focus-visible:outline-none",
                            has(m, a) ? "border-brand-600 bg-brand-600 text-white" : "border-line-strong bg-white hover:border-brand-400",
                            locked && "opacity-60",
                          )}
                        >
                          {has(m, a) && <Check className="h-4 w-4" strokeWidth={3} />}
                        </button>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => toggleRow(m)}
                      className="rounded-md px-2 py-1 text-[12px] font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-40"
                    >
                      {e.selectAll}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!locked && (
          <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:justify-end">
            {dirty && (
              <Button variant="ghost" icon={<RotateCcw className="h-4 w-4" />} onClick={() => setDraft(structuredClone(role.matrix))} disabled={saving}>
                {dict.common.reset}
              </Button>
            )}
            <Button onClick={save} loading={saving} loadingText={dict.common.saving} disabled={!dirty} icon={<Check className="h-4 w-4" />}>
              {dict.common.saveChanges}
            </Button>
          </div>
        )}
      </div>
      {dialog}
    </div>
  );
}
