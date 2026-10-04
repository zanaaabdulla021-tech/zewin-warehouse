"use client";

import { useEffect, useState } from "react";

/** Uses the viewer's local clock, so it is rendered on the client. */
export function Greeting({ morning, afternoon, evening }: { morning: string; afternoon: string; evening: string }) {
  const [text, setText] = useState(morning);
  useEffect(() => {
    const h = new Date().getHours();
    setText(h < 12 ? morning : h < 17 ? afternoon : evening);
  }, [morning, afternoon, evening]);
  return <span suppressHydrationWarning>{text}</span>;
}
