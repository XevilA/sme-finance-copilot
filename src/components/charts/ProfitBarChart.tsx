import React, { useState } from "react";
import { compactBaht, fullBaht, useChartWidth } from "./chartUtils";
import { useT } from "@/i18n";

export type ProfitBar = {
  label: string;
  value: number; // กำไร/ขาดทุนที่ backend คืนมา
  detail: string; // เช่น margin หรือยอดขาย (แสดงใน tooltip)
};

type Props = { title: string; bars: ProfitBar[] };

const BRAND = "#6C4CF1";
const DANGER = "#E5484D";
const MUTED = "#5B678A";

// กราฟแท่งแนวนอน มีเส้น 0 ตรงกลางถ้ามีขาดทุน กำไรไปขวา ขาดทุนไปซ้าย
export const ProfitBarChart: React.FC<Props> = ({ title, bars }) => {
  const { ref, width } = useChartWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const t = useT();
  if (!bars.length) return null;

  const narrow = width < 480;
  const labelW = narrow ? 92 : 140;
  const valueW = narrow ? 56 : 72;
  const row = 34;
  const barH = 20;
  const height = bars.length * row + 8;
  const plotLeft = labelW;
  const plotW = Math.max(width - labelW - valueW * 2, 40);

  const maxPos = Math.max(0, ...bars.map((b) => b.value));
  const maxNeg = Math.max(0, ...bars.map((b) => -b.value));
  const span = maxPos + maxNeg || 1;
  // ตำแหน่งเส้น 0 (ถ้าไม่มีขาดทุนเลย เส้น 0 อยู่ซ้ายสุด)
  const zeroX = plotLeft + valueW + (maxNeg / span) * plotW;
  const scale = plotW / span;

  return (
    <figure className="space-y-2">
      <figcaption className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-ink">{title}</span>
        {maxNeg > 0 && (
          <span className="flex items-center gap-3 text-[11px] text-ink-muted">
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: BRAND }} />{t("chart.profit")}</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: DANGER }} />{t("chart.loss")}</span>
          </span>
        )}
      </figcaption>
      <div ref={ref} className="relative w-full">
        <svg width={width} height={height} role="list" aria-label={title} className="block">
          <line x1={zeroX} x2={zeroX} y1={0} y2={height} stroke="#C9C2B2" strokeWidth="1" />
          {bars.map((bar, i) => {
            const cy = i * row + row / 2 + 4;
            const w = Math.max(Math.abs(bar.value) * scale, bar.value === 0 ? 0 : 2);
            const loss = bar.value < 0;
            const x0 = loss ? zeroX - w : zeroX;
            const r = Math.min(4, w / 2);
            // มุมโค้งเฉพาะปลายแท่ง ฝั่งเส้น 0 เป็นมุมฉาก
            const d = loss
              ? `M${zeroX},${cy - barH / 2} H${x0 + r} Q${x0},${cy - barH / 2} ${x0},${cy - barH / 2 + r} V${cy + barH / 2 - r} Q${x0},${cy + barH / 2} ${x0 + r},${cy + barH / 2} H${zeroX} Z`
              : `M${zeroX},${cy - barH / 2} H${zeroX + w - r} Q${zeroX + w},${cy - barH / 2} ${zeroX + w},${cy - barH / 2 + r} V${cy + barH / 2 - r} Q${zeroX + w},${cy + barH / 2} ${zeroX + w - r},${cy + barH / 2} H${zeroX} Z`;
            const valueX = loss ? x0 - 6 : zeroX + w + 6;
            return (
              <g
                key={`${i}-${bar.label}`}
                tabIndex={0}
                role="listitem"
                aria-label={`${bar.label}: ${loss ? t("chart.lossLower") : t("chart.profitLower")} ${fullBaht(bar.value)}, ${bar.detail}`}
                onPointerEnter={() => setActive(i)}
                onPointerDown={() => setActive(i)}
                onPointerLeave={(e) => { if (e.pointerType === "mouse") setActive(null); }}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="cursor-default outline-none"
              >
                {/* พื้นที่กดใหญ่กว่าแท่งจริง */}
                <rect x={0} y={cy - row / 2} width={width} height={row} fill={active === i ? "#F4F1EA" : "transparent"} rx="8" />
                <text x={labelW - 8} y={cy} dy="0.32em" textAnchor="end" fontSize="11" fill="#14224A" fontWeight="600">
                  {bar.label.length > (narrow ? 12 : 20) ? `${bar.label.slice(0, narrow ? 11 : 19)}…` : bar.label}
                </text>
                <path d={d} fill={loss ? DANGER : BRAND} className={loss ? "chart-grow-left" : "chart-grow-right"}
                  style={{ transformOrigin: `${zeroX}px ${cy}px`, animationDelay: `${Math.min(i, 8) * 70}ms` }} />
                <text x={valueX} y={cy} dy="0.32em" textAnchor={loss ? "end" : "start"} fontSize="11" fill={MUTED}
                  style={{ fontVariantNumeric: "tabular-nums" }} className="chart-dot" >
                  {loss ? `−${compactBaht(-bar.value)}` : compactBaht(bar.value)}
                </text>
              </g>
            );
          })}
        </svg>
        {active != null && (
          <div role="status"
            className={narrow
              ? "mt-2 rounded-xl border border-borderLine bg-slate-50 p-2 text-[11px] animate-fade-in"
              : "pointer-events-none absolute right-0 rounded-xl border border-borderLine bg-white/95 p-2 text-[11px] shadow-soft-md animate-fade-in"}
            style={narrow ? undefined : { top: Math.max(active * row - 40, 0) }}>
            <div className="font-mono text-sm font-bold text-ink">{fullBaht(bars[active].value)}</div>
            <div className="text-ink">{bars[active].label} · {bars[active].value < 0 ? t("chart.lossLower") : t("chart.profitLower")}</div>
            <div className="text-ink-muted">{bars[active].detail}</div>
          </div>
        )}
      </div>
    </figure>
  );
};
