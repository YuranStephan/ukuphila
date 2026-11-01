"use client";

import { useEffect, useRef, useState } from "react";

/** One tooltip for the whole page: charts stay server-rendered and only declare `data-tip`. */
export function ChartTips() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  const frame = useRef(0);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const target = (event.target as Element | null)?.closest?.("[data-tip]");
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        if (!target) return setTip(null);
        const text = target.getAttribute("data-tip") ?? "";
        const x = Math.min(event.clientX + 14, window.innerWidth - 230);
        const y = Math.min(event.clientY + 14, window.innerHeight - 90);
        setTip({ text, x, y });
      });
    };
    const leave = () => setTip(null);
    document.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("scroll", leave, { passive: true });
    return () => {
      document.removeEventListener("pointermove", move);
      window.removeEventListener("scroll", leave);
    };
  }, []);

  if (!tip) return null;
  return (
    <div className="chart-tip" style={{ left: tip.x, top: tip.y }} role="status">
      {tip.text}
    </div>
  );
}
