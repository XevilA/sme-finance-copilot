// ของใช้ร่วมกันสำหรับกราฟ SVG (แค่จัดรูปแบบ/สเกล ไม่ได้คำนวณตัวเลขการเงิน)
import { useEffect, useRef, useState } from "react";

// วัดความกว้างกล่อง เพื่อให้กราฟปรับตามจอ (มือถือ/แท็บเล็ต/คอม)
export function useChartWidth<T extends HTMLElement>(fallback = 640) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth || fallback);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const next = Math.round(entries[0].contentRect.width);
      if (next > 0) setWidth(next);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [fallback]);
  return { ref, width };
}

// ตัวเลขแกนแบบสั้น 0 / 10K / 1.2M
export function compactBaht(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}฿${trim(abs / 1_000_000)}M`;
  if (abs >= 1_000) return `${sign}฿${trim(abs / 1_000)}K`;
  return `${sign}฿${trim(abs)}`;
}
function trim(n: number) {
  return n.toFixed(n >= 100 ? 0 : 1).replace(/\.0$/, "");
}

export const fullBaht = (value: number) => `${value < 0 ? "-" : ""}฿${Math.abs(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

// หา tick สวย ๆ ให้แกน (1, 2, 5 x 10^n)
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) { min -= 1; max += 1; }
  const raw = (max - min) / count;
  const power = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw) || raw;
  const ticks: number[] = [];
  for (let v = Math.floor(min / step) * step; v <= max + step * 0.001; v += step) ticks.push(Number(v.toFixed(6)));
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}
