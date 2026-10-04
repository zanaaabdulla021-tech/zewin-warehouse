"use client";

import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success" | "link";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-[0_1px_0_rgba(255,255,255,.15)_inset,0_1px_2px_rgba(10,136,115,.35)]",
  secondary: "bg-white text-ink border border-line-strong hover:bg-canvas hover:border-ink-faint",
  ghost: "text-ink-soft hover:bg-canvas hover:text-ink",
  danger: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
  success: "bg-emerald-600 text-white hover:bg-emerald-700",
  link: "text-brand-700 hover:text-brand-800 hover:underline underline-offset-4 px-0 h-auto",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-[14px] gap-2 rounded-field",
  lg: "h-12 px-5 text-[15px] gap-2 rounded-field",
  icon: "h-9 w-9 rounded-lg",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  loadingText?: string;
  icon?: React.ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, loadingText, icon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-colors",
        "focus-visible:outline-none focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {loading && loadingText ? loadingText : children}
    </button>
  );
});
