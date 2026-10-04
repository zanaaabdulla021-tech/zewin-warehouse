"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Coins, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SwitchField } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatDate } from "@/lib/utils";
import { deleteCurrency, saveCurrency } from "./currency-actions";

type Cur = { code: string; name: string; symbol: string | null; rate: number; active: boolean; updatedAt: string };

export function CurrencyManager({ currencies, base, readOnly }: { currencies: Cur[]; base: string; readOnly: boolean }) {
  const { dict, t } = useI18n();
  const c = dict.currency;
  const toast = useToast();
  const router = useRouter();
  const [editing, setEditing] = useState<{ existing: string | null; code: string; name: string; symbol: string; rate: string; active: boolean } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [del, setDel] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const save = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!editing || busy) return;
    start(async () => {
      const res = await saveCurrency(editing.existing, editing);
      if (res.ok) {
        toast({ tone: "success", title: `✓ ${c.saved}` });
        setEditing(null);
        router.refresh();
      } else {
        setErrors(res.errors ?? {});
        toast({ tone: "error", title: res.message });
      }
    });
  };

  return (
    <div className="zw-card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line p-5 sm:flex-row sm:items-center">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <Coins className="h-4 w-4" />
        </span>
        <div className="flex-1">
          <h2 className="text-[15px] font-semibold">{c.title}</h2>
          <p className="text-[13px] text-ink-muted">{c.subtitle}</p>
        </div>
        {!readOnly && (
          <Button
            variant="secondary"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setErrors({});
              setEditing({ existing: null, code: "", name: "", symbol: "", rate: "", active: true });
            }}
          >
            {c.add}
          </Button>
        )}
      </div>
      <ul className="divide-y divide-line">
        {currencies.map((cur) => {
          const isBase = cur.code === base;
          return (
            <li key={cur.code} className="flex items-center gap-4 px-5 py-3.5">
              <span className="w-14 font-mono text-[15px] font-bold" dir="ltr">{cur.code}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[14px] font-medium">
                  {cur.name}
                  {isBase && <Badge tone="brand" dot={false}><Lock className="h-3 w-3" />{c.base}</Badge>}
                  {!cur.active && <Badge tone="gray">{dict.status.INACTIVE}</Badge>}
                </div>
                <div className="text-[12px] text-ink-muted">
                  {c.updated} {formatDate(cur.updatedAt)}
                </div>
              </div>
              <div className="text-end font-mono text-[13.5px] tabular" dir="ltr">
                {t(c.rateLine, { code: cur.code, rate: cur.rate.toLocaleString("en-US", { maximumFractionDigits: 6 }), base })}
              </div>
              {!readOnly && (
                <DropdownMenu
                  items={[
                    {
                      label: dict.common.edit,
                      icon: <Pencil />,
                      onSelect: () => {
                        setErrors({});
                        setEditing({ existing: cur.code, code: cur.code, name: cur.name, symbol: cur.symbol ?? "", rate: String(cur.rate), active: cur.active });
                      },
                    },
                    { label: dict.common.delete, icon: <Trash2 />, danger: true, hidden: isBase, onSelect: () => setDel(cur.code) },
                  ]}
                />
              )}
            </li>
          );
        })}
      </ul>
      <p className="border-t border-line bg-canvas/50 px-5 py-3 text-[12.5px] text-ink-muted">{c.baseDesc}</p>

      <Modal
        open={!!editing}
        onClose={() => !busy && setEditing(null)}
        size="sm"
        title={editing?.existing ? c.edit : c.add}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={busy}>
              {dict.common.cancel}
            </Button>
            <Button onClick={() => save()} loading={busy} loadingText={dict.common.saving}>
              {dict.common.save}
            </Button>
          </>
        }
      >
        {editing && (
          <form onSubmit={save} noValidate className="space-y-4">
            <div className="grid grid-cols-[110px_1fr] gap-4">
              <Field label={c.code} htmlFor="cur-code" required error={errors.code}>
                <Input
                  id="cur-code"
                  value={editing.code}
                  maxLength={3}
                  disabled={!!editing.existing}
                  invalid={!!errors.code}
                  onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })}
                  className="font-mono uppercase"
                  dir="ltr"
                  placeholder="EUR"
                />
              </Field>
              <Field label={c.name} htmlFor="cur-name" required error={errors.name}>
                <Input id="cur-name" value={editing.name} invalid={!!errors.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Euro" />
              </Field>
            </div>
            <div className="grid grid-cols-[110px_1fr] gap-4">
              <Field label={c.symbol} htmlFor="cur-symbol" optionalLabel={dict.common.optional}>
                <Input id="cur-symbol" value={editing.symbol} maxLength={8} onChange={(e) => setEditing({ ...editing, symbol: e.target.value })} dir="ltr" placeholder="€" />
              </Field>
              <Field label={c.rate} htmlFor="cur-rate" required error={errors.rate} hint={t(c.rateHint, { base })}>
                <Input
                  id="cur-rate"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min={0}
                  value={editing.code === base ? "1" : editing.rate}
                  disabled={editing.code === base}
                  invalid={!!errors.rate}
                  onChange={(e) => setEditing({ ...editing, rate: e.target.value })}
                  suffix={base}
                  dir="ltr"
                />
              </Field>
            </div>
            {editing.code !== base && (
              <SwitchField id="cur-active" checked={editing.active} onChange={(v) => setEditing({ ...editing, active: v })} label={c.active} />
            )}
            <button type="submit" hidden />
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!del}
        onClose={() => setDel(null)}
        loading={busy}
        title={t(c.deleteTitle, { code: del ?? "" })}
        body={dict.common.deleteBody}
        confirmLabel={dict.common.delete}
        cancelLabel={dict.common.cancel}
        onConfirm={() =>
          start(async () => {
            const res = await deleteCurrency(del!);
            setDel(null);
            toast(res.ok ? { tone: "success", title: c.deleted } : { tone: "error", title: res.message });
            router.refresh();
          })
        }
      />
    </div>
  );
}
