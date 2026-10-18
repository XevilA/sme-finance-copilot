import React, { useState } from "react";
import { CashflowDay } from "@/api/contracts/types";
import { compactBaht, fullBaht, niceTicks, useChartWidth } from "./chartUtils";
import { useT } from "@/i18n";
import { useAppStore } from "@/store/useAppStore";

type Props = {
  asOf: string;
  // ยอดตั้งต้นที่ผู้ใช้กรอกเอง (จุดแรกของกราฟ)
  openingCash: number;
  days: CashflowDay[];
};

type Point = { date: string; value: number; deficit: boolean; titles: string[]; opening?: boolean };

const BRAND = "#6C4CF1";
const DANGER = "#E5484D";
const GRID = "#ECE7DC";
const MUTED = "#5B678A";

const toTime = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
// ชื่อเดือนตามภาษาที่เลือก (แสดงแค่วัน+เดือน)
const localeFor = { en: "en-US", th: "th-TH" } as const;
const shortDate = (iso: string, lang: keyof typeof localeFor) =>
  new Date(toTime(iso)).toLocaleDateString(localeFor[lang], { day: "numeric", month: "short", timeZone: "UTC" });

// กราฟยอดเงินสดแบบขั้นบันได (ยอดเปลี่ยนเฉพาะวันที่มีรายการ) ใช้ค่าที่ backend คืนมาเท่านั้น
export const CashBalanceChart: React.FC<Props> = ({ asOf, openingCash, days }) => {
  const { ref, width } = useChartWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const t = useT();
  const lang = useAppStore((st) => st.language);
  if (!days.length) return null;

  const points: Point[] = [
    { date: asOf, value: openingCash, deficit: false, titles: [t("chart.openingInput")], opening: true },
    ...days.map((day) => ({
      date: day.date,
      value: day.simulatedCash ?? day.projectedCash,
      deficit: day.isDeficit,
      titles: day.events.map((ev) => `${ev.isInflow ? "+" : "-"}${fullBaht(ev.amount)} ${ev.title}`),
    })),
  ];
  const reserve = days[0].reserveLine;

  const narrow = width < 480;
  const height = narrow ? 220 : 260;
  const pad = { top: 18, right: width < 480 ? 16 : 28, bottom: 28, left: width < 480 ? 44 : 56 };
  const innerW = Math.max(width - pad.left - pad.right, 50);
  const innerH = height - pad.top - pad.bottom;

  const values = [...points.map((p) => p.value), reserve, 0];
  const ticks = niceTicks(Math.min(...values), Math.max(...values));
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const t0 = toTime(points[0].date);
  const t1 = Math.max(toTime(points[points.length - 1].date), t0 + 86400000);
  const x = (iso: string) => pad.left + ((toTime(iso) - t0) / (t1 - t0)) * innerW;
  const y = (v: number) => pad.top + (1 - (v - yMin) / (yMax - yMin)) * innerH;

  // เส้นแบบ step: ลากแนวนอนไปจนถึงวันถัดไปแล้วค่อยขึ้น/ลง
  let path = `M${x(points[0].date)},${y(points[0].value)}`;
  for (let i = 1; i < points.length; i += 1) {
    path += ` H${x(points[i].date)} V${y(points[i].value)}`;
  }
  const lastX = x(points[points.length - 1].date);
  const areaPath = `${path} V${y(yMin)} H${x(points[0].date)} Z`;

  // label เฉพาะจุดต่ำสุด กับจุดสุดท้าย (ไม่ใส่ตัวเลขทุกจุด)
  const lowestIndex = points.reduce((low, p, i) => (p.value < points[low].value ? i : low), 0);
  const lastIndex = points.length - 1;
  // เลือกวันที่บนแกน x ไม่ให้ตัวหนังสือชนกัน (เว้นอย่างน้อย ~56px)
  const dateTicks: Point[] = [];
  points.forEach((p, i) => {
    const prev = dateTicks[dateTicks.length - 1];
    if (!prev || (x(p.date) - x(prev.date) >= 56 && (i === lastIndex || x(points[lastIndex].date) - x(p.date) >= 56))) dateTicks.push(p);
  });
  if (dateTicks[dateTicks.length - 1] !== points[lastIndex]) dateTicks.push(points[lastIndex]);

  const pickNearest = (clientX: number, box: DOMRect) => {
    const px = ((clientX - box.left) / box.width) * width;
    let best = 0;
    points.forEach((p, i) => { if (Math.abs(x(p.date) - px) < Math.abs(x(points[best].date) - px)) best = i; });
    setActive(best);
  };

  const shown = active == null ? null : points[active];
  const tipLeft = shown ? Math.min(Math.max(x(shown.date) - 90, 4), width - 184) : 0;

  return (
    <figure className="space-y-2">
      <figcaption className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-ink">{t("chart.cashTitle")}</span>
        <span className="flex items-center gap-3 text-[11px] text-ink-muted">
          <span className="flex items-center gap-1"><svg width="16" height="6" aria-hidden="true"><line x1="0" y1="3" x2="16" y2="3" stroke={MUTED} strokeWidth="1.5" strokeDasharray="4 3" /></svg>{t("chart.reserve", { amount: compactBaht(reserve) })}</span>
          <span className="flex items-center gap-1"><svg width="10" height="10" aria-hidden="true"><circle cx="5" cy="5" r="4" fill={DANGER} /></svg>{t("chart.belowReserve")}</span>
        </span>
      </figcaption>

      <div ref={ref} className="relative w-full">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={t("chart.cashAria", { from: points[0].date, to: points[lastIndex].date, lowest: fullBaht(points[lowestIndex].value), lowDate: points[lowestIndex].date })}
          tabIndex={0}
          className="block touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-brand/40 rounded-lg"
          onPointerMove={(e) => pickNearest(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerDown={(e) => pickNearest(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerLeave={(e) => { if (e.pointerType === "mouse") setActive(null); }}
          onBlur={() => setActive(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") { e.preventDefault(); setActive((i) => Math.min((i ?? -1) + 1, lastIndex)); }
            if (e.key === "ArrowLeft") { e.preventDefault(); setActive((i) => Math.max((i ?? 1) - 1, 0)); }
            if (e.key === "Escape") setActive(null);
          }}
        >
          {/* gridline + tick แกน y */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? "#C9C2B2" : GRID} strokeWidth="1" />
              <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="10" fill={MUTED} style={{ fontVariantNumeric: "tabular-nums" }}>{compactBaht(t)}</text>
            </g>
          ))}

          {/* โซนต่ำกว่าเงินสำรอง */}
          {reserve > yMin && (
            <rect x={pad.left} width={innerW} y={y(reserve)} height={y(yMin) - y(reserve)} fill={DANGER} fillOpacity="0.07" />
          )}
          <line x1={pad.left} x2={width - pad.right} y1={y(reserve)} y2={y(reserve)} stroke={MUTED} strokeWidth="1.5" strokeDasharray="4 3" />

          {/* พื้นที่ใต้เส้นจาง ๆ + เส้นหลักที่ค่อย ๆ วาด */}
          <path d={areaPath} fill={BRAND} fillOpacity="0.1" className="animate-fade-in" />
          <path d={path} fill="none" stroke={BRAND} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="chart-draw" />

          {/* crosshair */}
          {shown && <line x1={x(shown.date)} x2={x(shown.date)} y1={pad.top} y2={pad.top + innerH} stroke={MUTED} strokeWidth="1" opacity="0.5" />}

          {points.map((p, i) => (
            <circle
              key={`${p.date}-${i}`}
              cx={x(p.date)}
              cy={y(p.value)}
              r={active === i ? 6 : 4}
              fill={p.deficit ? DANGER : BRAND}
              stroke="#fff"
              strokeWidth="2"
              className="chart-dot"
              style={{ animationDelay: `${300 + Math.min(i, 10) * 60}ms` }}
            />
          ))}

          {/* label ที่จุดต่ำสุดและจุดสุดท้าย */}
          {[lowestIndex, lastIndex].filter((v, i, arr) => arr.indexOf(v) === i).map((i) => {
            const p = points[i];
            const nearRight = x(p.date) > width - 90;
            return (
              <text key={`label-${i}`} x={x(p.date) + (nearRight ? -8 : 8)} y={y(p.value) - 9} textAnchor={nearRight ? "end" : "start"} fontSize="11" fontWeight="600" fill="#14224A" className="chart-dot" style={{ animationDelay: "700ms" }}>
                {i === lowestIndex && i !== lastIndex ? t("chart.lowest", { amount: compactBaht(p.value) }) : compactBaht(p.value)}
              </text>
            );
          })}

          {dateTicks.map((p, i) => (
            <text key={`d-${p.date}-${i}`} x={x(p.date)} y={height - 8} fontSize="10" fill={MUTED}
              textAnchor={x(p.date) < pad.left + 20 ? "start" : x(p.date) > lastX - 20 ? "end" : "middle"}>
              {shortDate(p.date, lang)}
            </text>
          ))}
        </svg>

        {shown && (
          <div role="status"
            className={narrow
              ? "mt-2 rounded-xl border border-borderLine bg-slate-50 p-2 text-[11px] animate-fade-in"
              : "pointer-events-none absolute top-1 w-[180px] rounded-xl border border-borderLine bg-white/95 p-2 text-[11px] shadow-soft-md animate-fade-in"}
            style={narrow ? undefined : { left: tipLeft }}>
            <div className="font-mono text-sm font-bold text-ink">{fullBaht(shown.value)}</div>
            <div className="text-ink-muted">{shown.date}{shown.opening ? ` · ${t("chart.start")}` : ""}</div>
            {shown.deficit && <div className="mt-0.5 font-semibold text-danger">▼ {t("chart.belowReserve")}</div>}
            {shown.titles.slice(0, 3).map((t, i) => <div key={i} className="truncate text-ink">{t}</div>)}
            {shown.titles.length > 3 && <div className="text-ink-muted">{t("chart.more", { n: shown.titles.length - 3 })}</div>}
          </div>
        )}
      </div>
    </figure>
  );
};
