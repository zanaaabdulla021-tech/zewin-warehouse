import { Lock, Hammer } from "lucide-react";
import { getDict } from "@/i18n/server";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/card";
import type { Dictionary } from "@/i18n/en";

export function Forbidden() {
  const dict = getDict();
  return (
    <div className="zw-card">
      <EmptyState icon={<Lock className="h-5 w-5" />} title={dict.common.forbidden} />
    </div>
  );
}

/** Placeholder for modules scheduled in later phases. */
export function ComingSoon({ module }: { module: keyof Dictionary["nav"] }) {
  const dict = getDict();
  return (
    <>
      <PageHeader title={dict.nav[module]} />
      <div className="zw-card">
        <EmptyState icon={<Hammer className="h-5 w-5" />} title={dict.common.comingSoon} body={dict.common.comingSoonBody} />
      </div>
    </>
  );
}
