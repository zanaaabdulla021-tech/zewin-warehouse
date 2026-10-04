"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FolderTree, Pencil, Plus, Ruler, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast";
import { deleteCategory, deleteUnit, saveCategory, saveUnit } from "./actions";

type Cat = { id: string; name: string; parentId: string | null; products: number };
type Unit = { id: string; name: string; symbol: string; products: number };

type Editing =
  | { kind: "category"; id: string | null; name: string; parentId: string }
  | { kind: "unit"; id: string | null; name: string; symbol: string };

export function CatalogManager({ categories, units }: { categories: Cat[]; units: Unit[] }) {
  const { dict, t } = useI18n();
  const c = dict.catalog;
  const toast = useToast();
  const router = useRouter();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [del, setDel] = useState<{ kind: "category" | "unit"; id: string; name: string } | null>(null);
  const [saving, start] = useTransition();

  const open = (e: Editing) => {
    setErrors({});
    setEditing(e);
  };

  const save = (ev?: React.FormEvent) => {
    ev?.preventDefault();
    if (!editing || saving) return;
    start(async () => {
      const res =
        editing.kind === "category"
          ? await saveCategory(editing.id, { name: editing.name, parentId: editing.parentId })
          : await saveUnit(editing.id, { name: editing.name, symbol: editing.symbol });
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

  const remove = () =>
    start(async () => {
      const res = del!.kind === "category" ? await deleteCategory(del!.id) : await deleteUnit(del!.id);
      setDel(null);
      toast(res.ok ? { tone: "success", title: c.deleted } : { tone: "error", title: res.message });
      router.refresh();
    });

  const parentName = (id: string | null) => categories.find((x) => x.id === id)?.name;

  const listHeader = (title: string, count: number, icon: React.ReactNode, onAdd: () => void, addLabel: string) => (
    <div className="flex items-center gap-3 border-b border-line px-5 py-4">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">{icon}</span>
      <h2 className="flex-1 text-[15px] font-semibold">
        {title} <span className="ms-1 text-[13px] font-normal text-ink-faint">{count}</span>
      </h2>
      <Button size="sm" variant="secondary" icon={<Plus className="h-3.5 w-3.5" />} onClick={onAdd}>
        {addLabel}
      </Button>
    </div>
  );

  const row = (key: string, title: React.ReactNode, sub: React.ReactNode, onEdit: () => void, onDelete: () => void) => (
    <li key={key} className="group flex items-center gap-3 px-5 py-3">
      <button onClick={onEdit} className="min-w-0 flex-1 text-start">
        <div className="truncate text-[14px] font-medium text-ink group-hover:text-brand-700">{title}</div>
        <div className="truncate text-[12.5px] text-ink-muted">{sub}</div>
      </button>
      <DropdownMenu
        items={[
          { label: dict.common.edit, icon: <Pencil />, onSelect: onEdit },
          { label: dict.common.delete, icon: <Trash2 />, danger: true, onSelect: onDelete },
        ]}
      />
    </li>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        {listHeader(c.categories, categories.length, <FolderTree className="h-4 w-4" />, () => open({ kind: "category", id: null, name: "", parentId: "" }), c.addCategory)}
        {categories.length === 0 ? (
          <EmptyState compact title={c.noCategories} body={c.noCategoriesBody} />
        ) : (
          <ul className="divide-y divide-line">
            {categories.map((x) =>
              row(
                x.id,
                x.name,
                <>
                  {parentName(x.parentId) && <span>{parentName(x.parentId)} · </span>}
                  {t(c.productsCount, { n: x.products })}
                </>,
                () => open({ kind: "category", id: x.id, name: x.name, parentId: x.parentId ?? "" }),
                () => setDel({ kind: "category", id: x.id, name: x.name }),
              ),
            )}
          </ul>
        )}
      </Card>

      <Card>
        {listHeader(c.units, units.length, <Ruler className="h-4 w-4" />, () => open({ kind: "unit", id: null, name: "", symbol: "" }), c.addUnit)}
        {units.length === 0 ? (
          <EmptyState compact title={c.noUnits} body={c.noUnitsBody} />
        ) : (
          <ul className="divide-y divide-line">
            {units.map((u) =>
              row(
                u.id,
                <>
                  {u.name} <span className="ms-1 rounded bg-canvas px-1.5 py-0.5 font-mono text-[12px] text-ink-muted" dir="ltr">{u.symbol}</span>
                </>,
                t(c.productsCount, { n: u.products }),
                () => open({ kind: "unit", id: u.id, name: u.name, symbol: u.symbol }),
                () => setDel({ kind: "unit", id: u.id, name: u.name }),
              ),
            )}
          </ul>
        )}
      </Card>

      {/* Add / edit modal */}
      <Modal
        open={!!editing}
        onClose={() => !saving && setEditing(null)}
        size="sm"
        title={
          editing?.kind === "category"
            ? editing.id ? c.editCategory : c.addCategory
            : editing?.id ? c.editUnit : c.addUnit
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
              {dict.common.cancel}
            </Button>
            <Button onClick={() => save()} loading={saving} loadingText={dict.common.saving}>
              {dict.common.save}
            </Button>
          </>
        }
      >
        {editing && (
          <form onSubmit={save} noValidate className="space-y-4">
            {editing.kind === "category" ? (
              <>
                <Field label={c.categoryName} htmlFor="cat-name" required error={errors.name}>
                  <Input
                    id="cat-name"
                    value={editing.name}
                    invalid={!!errors.name}
                    placeholder={c.categoryNamePh}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                </Field>
                <Field label={c.parent} htmlFor="cat-parent" optionalLabel={dict.common.optional}>
                  <Combobox
                    id="cat-parent"
                    options={categories.filter((x) => x.id !== editing.id).map((x) => ({ value: x.id, label: x.name }))}
                    value={editing.parentId || null}
                    onChange={(v) => setEditing({ ...editing, parentId: v ?? "" })}
                    placeholder={c.parentPh}
                    emptyText={dict.common.noResults}
                  />
                </Field>
              </>
            ) : (
              <div className="grid grid-cols-[1fr_120px] gap-4">
                <Field label={c.unitName} htmlFor="unit-name" required error={errors.name}>
                  <Input
                    id="unit-name"
                    value={editing.name}
                    invalid={!!errors.name}
                    placeholder={c.unitNamePh}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                </Field>
                <Field label={c.symbol} htmlFor="unit-symbol" required error={errors.symbol}>
                  <Input
                    id="unit-symbol"
                    value={editing.symbol}
                    invalid={!!errors.symbol}
                    placeholder={c.symbolPh}
                    dir="ltr"
                    className="font-mono"
                    onChange={(e) => setEditing({ ...editing, symbol: e.target.value })}
                  />
                </Field>
              </div>
            )}
            <button type="submit" hidden />
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!del}
        onClose={() => setDel(null)}
        loading={saving}
        title={del?.kind === "category" ? c.deleteCategory : c.deleteUnit}
        body={
          <p>
            <strong className="text-ink">{del?.name}</strong> — {dict.common.deleteBody}
          </p>
        }
        confirmLabel={dict.common.delete}
        cancelLabel={dict.common.cancel}
        onConfirm={remove}
      />
    </div>
  );
}
