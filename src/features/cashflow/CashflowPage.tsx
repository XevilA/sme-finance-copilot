import React, { useState, useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { apiClient } from "@/api/client";
import { CashflowDay, Envelope } from "@/api/contracts/types";
import { TimeTravelScrubber } from "./TimeTravelScrubber";
import { DataKindBadge } from "@/components/signature/DataKindBadge";
import { StateRenderer } from "@/components/ui/StateRenderer";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ArrowRight,
  PlusCircle,
  Coins,
  ShieldCheck,
  Calendar,
  Clock,
  Sparkles,
} from "lucide-react";

export const CashflowPage: React.FC = () => {
  const {
    setCurrentPage,
    simulatedDepositPercent,
    setSimulatedDeposit,
    isSimulating,
    resetSimulation,
    setAIPanelOpen,
  } = useAppStore();

  const [timelineEnvelope, setTimelineEnvelope] = useState<Envelope<CashflowDay[]> | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(3); // Start at Day 3 where cash dips!
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    setLoading(true);
    apiClient
      .getCashflowTimeline()
      .then((res) => {
        setTimelineEnvelope(res);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading || !timelineEnvelope) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="h-64 bg-slate-200 rounded-card animate-pulse" />
        <div className="h-96 bg-slate-200 rounded-card animate-pulse" />
      </div>
    );
  }

  const timeline = timelineEnvelope.data;
  const currentDay = timeline.find((d) => d.dayIndex === selectedDayIndex) || timeline[0];

  // Cash gap statistics for Shop 1
  const minCashDay = timeline.reduce((min, cur) =>
    cur.projectedCash < min.projectedCash ? cur : min
  );

  return (
    <StateRenderer onRetry={loadData}>
      <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6 text-ink animate-fade-in">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-borderLine pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-display font-bold text-ink">
                เงินสดและกระแสเงินสด (Cashflow Forecast)
              </h1>
              <DataKindBadge kind="forecast" size="md" />
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              ตรวจจังหวะเงินเข้า-ออก รายการครบกำหนด และเลื่อนดูเงินคงเหลือในอนาคตด้วย Time Travel
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAIPanelOpen(true)}
              className="px-3.5 py-1.5 bg-brand/10 hover:bg-brand/20 border border-brand/30 text-brand text-xs font-bold rounded-btn flex items-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI วิเคราะห์จุดเงินขาด</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentPage("funding")}
              className="px-4 py-1.5 bg-brand hover:bg-brand-dark text-white text-xs font-semibold rounded-btn flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Coins className="w-3.5 h-3.5" />
              <span>จับคู่ทุนปิดจุดเงินขาด</span>
            </button>
          </div>
        </div>

        {/* Cash Shortage Spotlight Banner */}
        <div className="p-4 rounded-card bg-red-50 border-2 border-danger flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-soft-sm">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-danger text-white flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-danger uppercase tracking-wider">
                  ตรวจพบช่วงเงินสดต่ำกว่าเงินสำรองปลอดภัย (Day 1–24 พ.ย.)
                </h3>
                <span className="text-[10px] bg-white text-danger px-2 py-0.2 rounded border border-danger/30 font-bold">
                  วิกฤติติดลบ
                </span>
              </div>
              <p className="text-xs text-red-900 mt-1 leading-relaxed">
                เงินสดดิ่งลงต่ำสุดที่ <strong>-฿8,000</strong> ในวันที่ <strong>3 พ.ย.</strong>{" "}
                (ขาดทุนหมุนเวียน 14,000 ฿ เมื่อเทียบกับเงินสำรอง 15,000 ฿) เนื่องจากต้องมัดจำวัตถุดิบและกล่องอาหารล่วงหน้าก่อนที่เงินจากลูกค้าจะเข้า
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSelectedDayIndex(3)}
              className="px-3 py-1.5 bg-white border border-danger/40 text-danger text-xs font-semibold rounded-lg hover:bg-red-100 transition-colors"
            >
              ดูวันที่เงินดิ่ง (3 พ.ย.)
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage("funding")}
              className="px-4 py-1.5 bg-danger text-white text-xs font-bold rounded-lg hover:bg-danger-dark transition-all flex items-center gap-1 shadow-sm"
            >
              <span>เปิดแผนแก้ปัญหา</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Signature S4: Time Travel Scrubber Component */}
        <TimeTravelScrubber
          timeline={timeline}
          selectedDayIndex={selectedDayIndex}
          onSelectDay={(day) => setSelectedDayIndex(day)}
          depositPercent={simulatedDepositPercent}
          onDepositPercentChange={(p) => setSimulatedDeposit(p)}
          isSimulating={isSimulating}
          onResetSimulation={resetSimulation}
        />

        {/* Cashflow Stream Breakdown (Operating / Investing / Financing) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-card bg-white border border-borderLine">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              1. กระแสเงินสดจากการดำเนินงาน (Operating)
            </span>
            <div className="text-lg font-bold font-mono text-emerald-700 tabular-nums">
              +฿12,000
            </div>
            <p className="text-[11px] text-ink-muted mt-1 leading-tight">
              กำไรสุทธิโครงการหลังหักค่าของสด ค่าแรง และค่าส่งมอบ
            </p>
          </div>

          <div className="p-4 rounded-card bg-white border border-borderLine">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              2. กระแสเงินสดจากการลงทุน (Investing)
            </span>
            <div className="text-lg font-bold font-mono text-ink tabular-nums">
              -฿0.00
            </div>
            <p className="text-[11px] text-ink-muted mt-1 leading-tight">
              ใช้ทรัพยากรร่วมผ่าน SME UNLOCK จึงไม่มีรายจ่ายลงทุนเครื่องจักรใหม่
            </p>
          </div>

          <div className="p-4 rounded-card bg-white border border-borderLine">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              3. กระแสเงินสดจากการจัดหาเงิน (Financing)
            </span>
            <div className="text-lg font-bold font-mono text-brand tabular-nums">
              +฿14,000 (เสนอใช้ Factoring)
            </div>
            <p className="text-[11px] text-ink-muted mt-1 leading-tight">
              วงเงินเบิกล่วงหน้า 24 ชม. ปิดช่องว่างเงินสดวันที่ 1 พ.ย.
            </p>
          </div>
        </div>

        {/* Financial Events Table for Selected Day */}
        <div className="bg-white rounded-card border border-borderLine p-4 space-y-3 shadow-soft-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-display font-bold text-ink flex items-center gap-2">
              <Calendar className="w-4 h-4 text-brand" />
              <span>รายการเงินรับ-เงินจ่ายในวันที่ {currentDay.date}</span>
            </h3>
            <span className="text-xs text-ink-muted">
              {currentDay.events.length} รายการในวันนี้
            </span>
          </div>

          {currentDay.events.length === 0 ? (
            <div className="p-8 text-center text-xs text-ink-muted bg-slate-50 rounded-xl">
              ไม่มีรายการธุรกรรมเงินสดเข้าออกในวันที่ {currentDay.date}
            </div>
          ) : (
            <div className="space-y-2">
              {currentDay.events.map((ev) => (
                <div
                  key={ev.id}
                  className="p-3 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="font-semibold text-ink flex items-center gap-2">
                      <span>{ev.title}</span>
                      <span className="text-[10px] bg-slate-200 px-1.5 py-0.2 rounded font-normal text-slate-600">
                        {ev.partner || "ภายในร้าน"}
                      </span>
                    </div>
                    <div className="text-[11px] text-ink-muted">{ev.impactReason}</div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`font-mono font-bold text-sm tabular-nums ${
                        ev.isInflow ? "text-emerald-700" : "text-danger"
                      }`}
                    >
                      {ev.isInflow ? "+" : "-"}฿{ev.amount.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-400 block">{ev.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </StateRenderer>
  );
};
