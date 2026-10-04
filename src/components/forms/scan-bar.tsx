"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, ScanLine } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ScanProduct = { id: string; name: string; code: string; barcode?: string | null };

/** Short confirmation beep (no audio file needed). */
function beep(ok = true) {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = ok ? 1200 : 320;
    g.gain.value = 0.08;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + (ok ? 0.08 : 0.2));
    o.onended = () => ctx.close();
  } catch {
    /* audio not allowed — ignore */
  }
}

/**
 * Scan bar for item tables.
 *  - USB / Bluetooth scanners type the code and press Enter → product is found by barcode or code
 *  - "Camera" opens the phone/laptop camera scanner
 * `onProduct` receives the product; the form decides whether to add a row or +1 the quantity.
 */
export function ScanBar({
  products,
  onProduct,
  disabled,
}: {
  products: ScanProduct[];
  onProduct: (p: ScanProduct) => "added" | "increased";
  disabled?: boolean;
}) {
  const { dict, t } = useI18n();
  const s = dict.scan;
  const toast = useToast();
  const [value, setValue] = useState("");
  const [camera, setCamera] = useState(false);
  const [last, setLast] = useState<string | null>(null);

  const index = useRef(new Map<string, ScanProduct>());
  useEffect(() => {
    const m = new Map<string, ScanProduct>();
    for (const p of products) {
      m.set(p.code.toUpperCase(), p);
      if (p.barcode) m.set(p.barcode.trim().toUpperCase(), p);
    }
    index.current = m;
  }, [products]);

  const handle = useCallback(
    (raw: string) => {
      const code = raw.trim();
      if (!code) return false;
      const p = index.current.get(code.toUpperCase());
      if (!p) {
        beep(false);
        toast({ tone: "warning", title: t(s.notFound, { code }) });
        return false;
      }
      const what = onProduct(p);
      beep(true);
      setLast(p.name);
      toast({ tone: "success", title: t(what === "added" ? s.added : s.increased, { name: p.name }) });
      return true;
    },
    [onProduct, toast, t, s],
  );

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <ScanLine className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-600" />
        <input
          value={value}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              handle(value);
              setValue("");
            }
          }}
          placeholder={s.placeholder}
          aria-label={s.placeholder}
          inputMode="text"
          autoComplete="off"
          className="zw-field h-10 border-dashed border-brand-300 bg-brand-50/30 ps-9 font-mono text-[13px] placeholder:font-sans"
        />
      </div>
      <Button type="button" variant="secondary" icon={<Camera className="h-4 w-4" />} onClick={() => setCamera(true)} disabled={disabled}>
        <span className="hidden sm:inline">{s.camera}</span>
      </Button>
      {camera && <CameraScanner onClose={() => setCamera(false)} onCode={handle} last={last} />}
    </div>
  );
}

/**
 * Camera scanner. Uses the browser's BarcodeDetector when available
 * (Chrome / Android), otherwise ZXing (iOS Safari, Firefox).
 */
function CameraScanner({ onClose, onCode, last }: { onClose: () => void; onCode: (c: string) => boolean; last: string | null }) {
  const { dict } = useI18n();
  const s = dict.scan;
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(false);
  const [flash, setFlash] = useState(false);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let raf = 0;
    let zxingControls: { stop: () => void } | null = null;
    let lastCode = "";
    let lastAt = 0;

    const found = (code: string) => {
      const now = Date.now();
      if (code === lastCode && now - lastAt < 1800) return; // same label still in view
      lastCode = code;
      lastAt = now;
      if (onCodeRef.current(code)) {
        setFlash(true);
        setTimeout(() => setFlash(false), 350);
      }
    };

    (async () => {
      try {
        const Detector = (window as unknown as { BarcodeDetector?: new (o?: object) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
        if (Detector) {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
          if (stopped) return;
          video.current!.srcObject = stream;
          await video.current!.play();
          const detector = new Detector({ formats: ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e", "qr_code", "itf"] });
          const loop = async () => {
            if (stopped) return;
            try {
              const codes = await detector.detect(video.current!);
              if (codes[0]?.rawValue) found(codes[0].rawValue);
            } catch {
              /* frame not ready */
            }
            raf = requestAnimationFrame(loop);
          };
          loop();
        } else {
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          const reader = new BrowserMultiFormatReader();
          zxingControls = await reader.decodeFromConstraints(
            { video: { facingMode: { ideal: "environment" } } },
            video.current!,
            (result) => result && found(result.getText()),
          );
        }
      } catch {
        if (!stopped) setError(true);
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      zxingControls?.stop();
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  return (
    <Modal open onClose={onClose} title={s.cameraTitle} description={s.cameraHint} size="md">
      {error ? (
        <p className="rounded-lg bg-red-50 px-4 py-6 text-center text-[14px] text-red-700">{s.cameraError}</p>
      ) : (
        <div className="relative overflow-hidden rounded-xl bg-black">
          <video ref={video} className="aspect-[4/3] w-full object-cover" muted playsInline />
          {/* aiming frame */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className={cn("h-1/3 w-3/4 rounded-xl border-2 transition-colors", flash ? "border-emerald-400 bg-emerald-400/20" : "border-white/80")} />
          </div>
        </div>
      )}
      {last && (
        <p className="mt-3 flex items-center gap-2 text-[13.5px] text-ink-soft">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          {s.lastScanned}: <strong className="font-semibold text-ink">{last}</strong>
        </p>
      )}
    </Modal>
  );
}
