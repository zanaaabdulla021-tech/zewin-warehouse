import Link from "next/link";
import { getDict } from "@/i18n/server";
import { cn } from "@/lib/utils";

export function EmployeesTabs({ active, showRoles }: { active: "employees" | "roles"; showRoles: boolean }) {
  const e = getDict().employees;
  const tabs = [
    { key: "employees", href: "/employees", label: e.tabEmployees },
    ...(showRoles ? [{ key: "roles", href: "/employees/roles", label: e.tabRoles }] : []),
  ];
  return (
    <nav className="zw-scroll -mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
      {tabs.map((tb) => (
        <Link
          key={tb.key}
          href={tb.href}
          aria-current={active === tb.key ? "page" : undefined}
          className={cn(
            "-mb-px shrink-0 border-b-2 px-4 py-3 text-[14px] font-medium",
            active === tb.key ? "border-brand-600 text-brand-800" : "border-transparent text-ink-muted hover:text-ink",
          )}
        >
          {tb.label}
        </Link>
      ))}
    </nav>
  );
}
