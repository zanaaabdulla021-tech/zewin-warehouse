/** Print pages render without the app shell. */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-slate-200/70 py-8 print:bg-white print:py-0">{children}</div>;
}
