"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { useForm } from "@/hooks/use-form";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { createWarehouse } from "./actions";
import { emptyWarehouse, warehouseSchema, WAREHOUSE_TYPES } from "./schema";

/** Quick-create modal: only the essentials. Full details live on the edit page. */
export function AddWarehouseModal({
  open,
  onClose,
  nextCode,
  managers,
}: {
  open: boolean;
  onClose: () => void;
  nextCode: string;
  managers: ComboOption[];
}) {
  const { dict } = useI18n();
  const w = dict.warehouses;
  const toast = useToast();
  const router = useRouter();
  const schema = useMemo(() => warehouseSchema(dict), [dict]);
  const form = useForm(emptyWarehouse(nextCode), schema);
  const [saving, start] = useTransition();

  const close = () => {
    if (saving) return;
    form.reset();
    onClose();
  };

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const data = form.validate();
    if (!data) return;
    start(async () => {
      const res = await createWarehouse(data);
      if (res.ok) {
        toast({ tone: "success", title: `✓ ${w.created}` });
        form.reset();
        onClose();
        router.refresh();
      } else {
        if (res.errors) form.setServerErrors(res.errors);
        toast({ tone: "error", title: res.message });
      }
    });
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={w.add}
      description={w.addSubtitle}
      dismissible={!saving}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={saving}>
            {dict.common.cancel}
          </Button>
          <Button onClick={() => submit()} loading={saving} loadingText={dict.common.saving}>
            {w.create}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Field label={w.name} htmlFor="f-name" required error={form.errors.name} span="full">
          <Input {...form.bind("name")} placeholder={w.namePh} autoComplete="off" />
        </Field>
        <Field label={w.code} htmlFor="f-code" required error={form.errors.code} hint={w.codeHint}>
          <Input {...form.bind("code")} className="font-mono uppercase" dir="ltr" autoComplete="off" />
        </Field>
        <Field label={w.type} htmlFor="f-type" required>
          <Select {...form.bind("type")}>
            {WAREHOUSE_TYPES.map((t) => (
              <option key={t} value={t}>
                {w.types[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={w.city} htmlFor="f-city" error={form.errors.city} optionalLabel={dict.common.optional}>
          <Input {...form.bind("city")} placeholder={w.cityPh} />
        </Field>
        <Field label={w.manager} htmlFor="f-managerId" optionalLabel={dict.common.optional}>
          <Combobox
            id="f-managerId"
            options={managers}
            value={form.values.managerId || null}
            onChange={(v) => form.set("managerId", v ?? "")}
            placeholder={w.managerPh}
            emptyText={dict.common.noResults}
          />
        </Field>
        {/* lets Enter submit from any field */}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
