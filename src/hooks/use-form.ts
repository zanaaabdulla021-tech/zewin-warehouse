"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { ZodSchema } from "zod";

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

/**
 * Small form state hook shared by every Zewin form.
 * - tracks values, touched fields and dirtiness
 * - validates with a zod schema whose messages are already translated
 * - validates a field on blur, everything on submit
 */
export function useForm<T extends Record<string, unknown>>(initial: T, schema: ZodSchema<T>) {
  const initialRef = useRef(initial);
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<FieldErrors<T>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});

  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initialRef.current),
    [values],
  );

  const runValidation = useCallback(
    (v: T): FieldErrors<T> => {
      const res = schema.safeParse(v);
      if (res.success) return {};
      const out: FieldErrors<T> = {};
      for (const issue of res.error.issues) {
        const k = issue.path[0] as keyof T;
        if (!out[k]) out[k] = issue.message;
      }
      return out;
    },
    [schema],
  );

  const set = useCallback(
    <K extends keyof T>(key: K, value: T[K]) => {
      setValues((prev) => {
        const next = { ...prev, [key]: value };
        // live re-validate fields that already show an error
        setErrors((errs) => (errs[key] ? { ...errs, [key]: runValidation(next)[key] } : errs));
        return next;
      });
    },
    [runValidation],
  );

  const blur = useCallback(
    (key: keyof T) => {
      setTouched((t) => ({ ...t, [key]: true }));
      setErrors((errs) => ({ ...errs, [key]: runValidation(values)[key] }));
    },
    [runValidation, values],
  );

  /** returns parsed data, or null with errors shown */
  const validate = useCallback((): T | null => {
    const errs = runValidation(values);
    setErrors(errs);
    setTouched(Object.fromEntries(Object.keys(values).map((k) => [k, true])) as Record<keyof T, boolean>);
    if (Object.keys(errs).length) {
      const first = Object.keys(errs)[0];
      document.getElementById(`f-${first}`)?.focus();
      return null;
    }
    return schema.parse(values);
  }, [runValidation, schema, values]);

  const reset = useCallback(() => {
    setValues(initialRef.current);
    setErrors({});
    setTouched({});
  }, []);

  /** after a successful save the new values become the baseline */
  const commit = useCallback((v?: T) => {
    initialRef.current = v ?? values;
    setValues(initialRef.current);
  }, [values]);

  const setServerErrors = useCallback((errs: FieldErrors<T>) => setErrors((e) => ({ ...e, ...errs })), []);

  /** spread onto inputs: id, value, onChange, onBlur, invalid */
  const bind = useCallback(
    (key: keyof T & string) => ({
      id: `f-${key}`,
      name: key,
      value: (values[key] ?? "") as string,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        set(key, e.target.value as T[typeof key]),
      onBlur: () => blur(key),
      invalid: !!errors[key],
      "aria-describedby": errors[key] ? `f-${key}-error` : undefined,
    }),
    [values, errors, set, blur],
  );

  return { values, errors, touched, dirty, set, blur, bind, validate, reset, commit, setServerErrors };
}
