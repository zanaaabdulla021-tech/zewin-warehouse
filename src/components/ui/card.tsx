import Link from "next/link";
import { cn } from "@/lib/utils";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("zw-card", className)}>{children}</div>;
}

export function CardHeader({
  title,
  description,
  action,
  href,
  hrefLabel,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-line px-5 py-4">
      <div className="flex-1">
        <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
        {description && <p className="mt-0.5 text-[13px] text-ink-muted">{description}</p>}
      </div>
      {action}
      {href && (
        <Link href={href} className="text-[13px] font-medium text-brand-700 hover:text-brand-800">
          {hrefLabel}
        </Link>
      )}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
  badge,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end">
      <div className="flex-1">
        {breadcrumb && <div className="mb-2 text-[13px] text-ink-muted">{breadcrumb}</div>}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[22px] font-semibold tracking-tight text-ink sm:text-[26px]">{title}</h1>
          {badge}
        </div>
        {description && <div className="mt-1 text-[14px] text-ink-muted">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
