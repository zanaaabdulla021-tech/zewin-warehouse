"use client";

import { useEffect } from "react";
import { ArrowLeft, Printer } from "lucide-react";

export function PrintToolbar({ back, label, backLabel }: { back: string; label: string; backLabel: string }) {
  useEffect(() => {
    if (new URLSearchParams(location.search).get("auto") === "1") setTimeout(() => window.print(), 400);
  }, []);
  return (
    <div className="no-print mx-auto mb-4 flex w-[210mm] max-w-full items-center justify-between px-2">
      <a href={back} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        {backLabel}
      </a>
      <button
        onClick={() => window.print()}
        className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-brand-600 px-4 text-[14px] font-medium text-white hover:bg-brand-700"
      >
        <Printer className="h-4 w-4" />
        {label}
      </button>
    </div>
  );
}
