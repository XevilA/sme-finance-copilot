import React, { useState, useEffect, useRef } from "react";
import { CashflowDay, FinancialEvent } from "@/api/contracts/types";
import { EventPin } from "@/components/signature/EventPin";
import { DataKindBadge } from "@/components/signature/DataKindBadge";
import {
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Sliders,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

interface TimeTravelScrubberProps {
  timeline: CashflowDay[];
  selectedDayIndex: number;
  onSelectDay: (dayIndex: number) => void;
  depositPercent: number;
  onDepositPercentChange: (percent: number) => void;
  isSimulating: boolean;
  onResetSimulation: () => void;
}

export const TimeTravelScrubber: React.FC<TimeTravelScrubberProps> = ({
  timeline,
  selectedDayIndex,
  onSelectDay,
  depositPercent,
  onDepositPercentChange,
  isSimulating,
  onResetSimulation,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState<1 | 2 | 4>(1);
  const intervalRef = useRef<number | null>(null);

  const currentDay = timeline.find((d) => d.dayIndex === selectedDayIndex) || timeline[0];
  // Track geometry follows the returned series instead of a fixed 30-day demo
  // window, and the warning band marks the days that are actually below the
  // reserve line the backend returned.
  const span = Math.max(1, timeline.length - 1);
  const breaches = timeline.reduce<number[]>((found, day, index) =>
    day.projectedCash < day.reserveLine ? [...found, index] : found, []);
  const firstBreach = breaches.length ? breaches[0] : -1;
  const lastBreach = breaches.length ? breaches[breaches.length - 1] : -1;
  // Dated rows are not one row per calendar day, so the scrubber steps through
  // the positions that exist rather than assuming a contiguous 1..30 range.
  const selectedIndex = Math.max(0, timeline.findIndex((day) => day.dayIndex === selectedDayIndex));

  // Play / Pause auto ticker
  useEffect(() => {
    if (isPlaying) {
      const delay = 1000 / playSpeed;
      intervalRef.current = window.setInterval(() => {
        onSelectDay(selectedDayIndex >= 30 ? 1 : selectedDayIndex + 1);
      }, delay);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, playSpeed, selectedDayIndex, onSelectDay]);

  const handleTogglePlay = () => setIsPlaying(!isPlaying);

  return (
    <div className="bg-white rounded-card p-5 border border-borderLine shadow-soft-sm space-y-4 select-none">
      {/* Top Header of Scrubber */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand/10 text-brand flex items-center justify-center font-bold">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-display font-bold text-ink text-sm flex items-center gap-1.5">
              <span>Time Travel — เลื่อนดูอนาคตของร้าน (30 วัน)</span>
              <DataKindBadge kind={isSimulating ? "simulated" : "forecast"} size="sm" />
            </h3>
            <span className="text-[11px] text-ink-muted">
              ส่องดูยอดเงินสดล่วงหน้า ตรวจจุดติดลบ และจำลองการปรับเงินมัดจำ
            </span>
          </div>
        </div>

        {/* Playback Controls (Play/Pause/Speed/Reset) */}
        <div className="flex items-center gap-2">
          {/* Speed selector */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-xs font-mono">
            {([1, 2, 4] as const).map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => setPlaySpeed(spd)}
                className={`px-2 py-0.5 rounded font-bold transition-all ${
                  playSpeed === spd ? "bg-white text-brand shadow-2xs" : "text-slate-500"
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          {/* Step Back button (Non-drag accessibility) */}
          <button
            type="button"
            onClick={() => onSelectDay(Math.max(1, selectedDayIndex - 1))}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-ink transition-colors"
            title="ย้อน 1 วัน (◀)"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Play / Pause button */}
          <button
            type="button"
            onClick={handleTogglePlay}
            className={`px-3 py-1.5 rounded-btn text-xs font-bold flex items-center gap-1.5 transition-all ${
              isPlaying
                ? "bg-amber-500 text-white shadow-sm"
                : "bg-brand text-white hover:bg-brand-dark shadow-glow-primary"
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>หยุด</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>เล่นแผน</span>
              </>
            )}
          </button>

          {/* Step Forward button (Non-drag accessibility) */}
          <button
            type="button"
            onClick={() => onSelectDay(Math.min(30, selectedDayIndex + 1))}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-ink transition-colors"
            title="เดินหน้า 1 วัน (▶)"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Today reset */}
          <button
            type="button"
            onClick={() => onSelectDay(1)}
            className="px-2.5 py-1 text-xs text-ink-muted hover:text-ink font-medium"
          >
            กลับวันนี้
          </button>
        </div>
      </div>

      {/* Selected Day Status Odometer Callout */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
        <div>
          <span className="text-[10px] text-ink-muted block">วันที่เลือกในไทม์ไลน์</span>
          <span className="text-base font-bold font-display text-ink">
            {currentDay.date} (วันที่ {currentDay.dayIndex} ของงวด)
          </span>
        </div>

        <div>
          <span className="text-[10px] text-ink-muted block">เงินสดคาดการณ์</span>
          <span
            className={`text-base font-extrabold font-mono tabular-nums ${
              currentDay.projectedCash < 0
                ? "text-danger"
                : currentDay.projectedCash < currentDay.reserveLine
                ? "text-attention"
                : "text-ink"
            }`}
          >
            ฿{currentDay.projectedCash.toLocaleString()}
          </span>
        </div>

        {isSimulating && currentDay.simulatedCash !== undefined && (
          <div>
            <span className="text-[10px] text-brand block">เงินสดหลังจำลอง (Factoring/มัดจำ)</span>
            <span className="text-base font-extrabold font-mono text-brand tabular-nums">
              ฿{currentDay.simulatedCash.toLocaleString()}
            </span>
          </div>
        )}

        <div className="flex flex-col justify-center">
          {currentDay.isDeficit ? (
            <div className="text-xs font-bold text-danger bg-red-100/70 px-2.5 py-1 rounded-lg border border-red-200 flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5 shrink-0" />
              <span>ต่ำกว่าสำรอง ฿{currentDay.deficitAmount?.toLocaleString()}</span>
            </div>
          ) : (
            <div className="text-xs font-semibold text-emerald-700 bg-emerald-100/60 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 shrink-0" />
              <span>สภาพคล่องปลอดภัย</span>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Time Track & Capsule Scrubber */}
      <div className="relative pt-6 pb-2">
        {/* Day Tick Track */}
        <div className="relative w-full h-3 bg-slate-200 rounded-full cursor-pointer flex items-center">
          {/* Days below the reserve line, taken from the returned series */}
          {firstBreach >= 0 && (
            <div
              className="absolute left-0 h-full bg-red-300/60 rounded-l-full border-r-2 border-red-400 pointer-events-none"
              style={{ marginLeft: `${(firstBreach / span) * 100}%`, width: `${((lastBreach - firstBreach) / span) * 100}%` }}
              title={`ช่วงวันที่เงินสดต่ำกว่าเงินสำรอง: ${timeline[firstBreach].date} ถึง ${timeline[lastBreach].date}`}
            />
          )}

          {/* Event Pins placed across timeline days */}
          {timeline.map((day, index) => {
            if (day.events.length === 0) return null;
            const leftPercent = (index / span) * 100;
            return (
              <div
                key={day.dayIndex}
                className="absolute -top-7 -translate-x-1/2 z-20"
                style={{ left: `${leftPercent}%` }}
              >
                <EventPin
                  event={day.events[0]}
                  isActive={selectedDayIndex === day.dayIndex}
                  isBouncing={selectedDayIndex === day.dayIndex && day.events[0].amount < 0}
                  onClick={() => onSelectDay(day.dayIndex)}
                />
              </div>
            );
          })}

          {/* Moving Scrubber Capsule */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-brand border-2 border-white shadow-glow-primary z-30 transition-all pointer-events-none flex items-center justify-center text-[10px] text-white font-bold"
            style={{ left: `${(selectedIndex / span) * 100}%` }}
          >
            {currentDay?.dayIndex ?? selectedDayIndex}
          </div>
        </div>

        {/* Date slider input fallback (Part B Rule #6: Non-drag alternative) */}
        <input
          type="range"
          min="0"
          max={span}
          value={selectedIndex}
          onChange={(e) => {
            const row = timeline[parseInt(e.target.value, 10)];
            if (row) onSelectDay(row.dayIndex);
          }}
          className="w-full opacity-0 cursor-pointer h-6 -mt-3 absolute inset-x-0 z-40"
          aria-label="เลือกวันที่ในอนาคต"
        />

        {/* Day Ticks Label */}
        <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-2">
          <span>{timeline[0]?.date || "—"}</span>
          <span className="hidden sm:inline">{timeline[Math.floor(timeline.length * 0.2)]?.date || ""}</span>
          <span className="hidden sm:inline">{timeline[Math.floor(timeline.length * 0.4)]?.date || ""}</span>
          <span className="hidden sm:inline">{timeline[Math.floor(timeline.length * 0.6)]?.date || ""}</span>
          <span className="hidden sm:inline">{timeline[Math.floor(timeline.length * 0.8)]?.date || ""}</span>
          <span>{timeline[timeline.length - 1]?.date || "—"}</span>
        </div>
      </div>

      {/* Deposit Simulation Slider Sandbox */}
      <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-brand" />
          <div>
            <span className="font-bold text-ink">ปรับมัดจำผู้ว่าจ้าง:</span>
            <span className="font-mono font-bold text-brand ml-1">{depositPercent}%</span>
            <span className="text-ink-muted text-[11px] ml-1">
              (หน้านี้ยังไม่มีการคำนวณใหม่ · ใช้ตัวปรับมัดจำในห้องจำลองเพื่อให้ engine คำนวณจริง)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="range"
            min="20"
            max="50"
            step="5"
            value={depositPercent}
            disabled
            title="การเปลี่ยนมัดจำต้องให้ backend คำนวณใหม่ · ใช้ได้ที่ห้องจำลอง (เฉพาะขอบเขตออเดอร์)"
            onChange={(e) => onDepositPercentChange(parseInt(e.target.value, 10))}
            className="w-32 accent-brand cursor-pointer"
          />

          {isSimulating && (
            <button
              type="button"
              onClick={onResetSimulation}
              className="text-xs text-brand font-semibold hover:underline flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>คืนค่าเดิม</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
