import React, { useState, useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import { apiClient } from "@/api/client";
import { CashflowDay } from "@/api/contracts/types";
import { envelopeMode, useAnalysisContext, useEnvelope } from "@/hooks/useEnvelope";
import { TimeTravelScrubber } from "./TimeTravelScrubber";
import { CashflowPreviewForm } from "./CashflowPreviewForm";
import { DataKindBadge } from "@/components/signature/DataKindBadge";
import { StateRenderer } from "@/components/ui/StateRenderer";
import { missingDataLabel } from "@/api/dataAvailability";
import { useT } from "@/i18n";
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

  const { accepted, stale } = useAnalysisContext();
  const t = useT();
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const load = useCallback(() => apiClient.getCashflowTimeline(), []);
  const state = useEnvelope<CashflowDay[]>(load);
  const { envelope: timelineEnvelope, loading, error, reload: loadData } = state;
  const mode = envelopeMode(state, (rows) => rows.length === 0);
  const money = (value: number | null | undefined) =>
    value == null ? t("common.noData") : `฿${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  // Cash-flow statement lines come from the statement that was analysed. The
  // dated timeline contract does not return them, so they are not invented.
  const statementLine = (field: string) => {
    const value = accepted?.input?.[field];
    return value == null || value === "" ? null : Number(value);
  };
  const inputText = (field: string) => {
    const value = accepted?.input?.[field];
    return value == null || value === "" ? undefined : String(value);
  };
  // ฟอร์ม preview ใช้ได้ทั้งตอนมีและไม่มี timeline ที่บันทึกไว้
  const previewForm = (
    <CashflowPreviewForm
      key={accepted?.revision || "no-statement"}
      defaultAsOf={accepted?.input.period_end}
      defaultOpeningCash={inputText("cash_balance")}
      defaultReserve={inputText("minimum_cash_reserve")}
    />
  );

  if (loading) {
    return (
      <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6" role="status" aria-label={t("cash.loadingLabel")}>
        <p className="text-xs text-ink-muted">{t("cash.loading")}</p>
        <div className="h-64 skeleton rounded-card" />
        <div className="h-96 skeleton rounded-card" />
      </div>
    );
  }

  const timeline = timelineEnvelope?.data || [];
  const missing = timelineEnvelope?.missing || [];

  if (!timelineEnvelope || mode === "error" || mode === "unavailable" || mode === "insufficient_data") {
    const reportedLines = [
      { field: "cash_balance", label: t("cash.line.balance") },
      { field: "operating_cash_flow", label: t("missing.operating_cash_flow") },
      { field: "investing_cash_flow", label: t("missing.investing_cash_flow") },
      { field: "financing_cash_flow", label: t("missing.financing_cash_flow") },
    ].map((line) => ({ ...line, value: statementLine(line.field) }))
      .filter((line) => line.value !== null);

    return (
      <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-5 text-ink animate-fade-in">
        <div className="border-b border-borderLine pb-4">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-display font-bold text-ink">{t("cash.title")}</h1>
            <DataKindBadge kind={accepted?.input.kind ?? "simulated"} size="md" />
          </div>
          <p className="text-xs text-ink-muted mt-1">
            {accepted
              ? t("cash.periodNote", { start: accepted.input.period_start, end: accepted.input.period_end })
              : t("cash.noStatement")}
          </p>
        </div>
        {reportedLines.length > 0 && (
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3" aria-label={t("cash.reportedTotals")}>
            {reportedLines.map((line) => (
              <div key={line.field} className="p-4 rounded-card bg-white border border-borderLine">
                <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">{line.label}</span>
                <div className="mt-2 text-lg font-bold font-mono tabular-nums">{money(line.value)}</div>
                <span className="text-[10px] text-ink-muted">{t("common.reportedInStatement")}</span>
              </div>
            ))}
          </section>
        )}
        <div className={`rounded-xl border p-3 text-xs ${mode === "error" ? "border-rose-200 bg-rose-50 text-rose-950" : "border-amber-200 bg-amber-50 text-amber-950"}`} role="status">
          <div className="font-semibold">
            {mode === "error" ? t("cash.loadError")
              : mode === "unavailable" ? t("cash.unavailable")
              : t("cash.noDated")}
          </div>
          <p className="mt-1">{error || (accepted
            ? t("cash.statementOnly")
            : t("cash.noDbEvents"))}</p>
          {missing.length > 0 && (
            <p className="mt-1 text-[11px]">{t("common.missingList", { list: missing.map(missingDataLabel).join(", ") })}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-3">
            <button type="button" onClick={loadData} className="font-semibold underline">{t("common.tryLoadingAgain")}</button>
            {!accepted && <button type="button" onClick={() => setCurrentPage("import")} className="font-semibold underline">{t("common.importStatement")}</button>}
          </div>
        </div>
        {previewForm}
      </div>
    );
  }

  const currentDay = timeline.find((d) => d.dayIndex === selectedDayIndex) || timeline[0];
  // Lowest balance in the returned series, and the days below the reserve line
  // the backend returned. Both are selections over returned values.
  const minCashDay = timeline.reduce((min, cur) => (cur.projectedCash < min.projectedCash ? cur : min));
  const breachDays = timeline.filter((day) => day.projectedCash < day.reserveLine);
  const defaultSme = missing.includes("sme_id_not_supplied_default_sme_selected");

  return (
    <StateRenderer currentMode={stale ? "stale" : undefined} onRetry={loadData} onReanalyze={() => setCurrentPage("import")}>
      <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6 text-ink animate-fade-in">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-borderLine pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-display font-bold text-ink">
                {t("cash.title")}
              </h1>
              <DataKindBadge kind={timelineEnvelope.kind} size="md" />
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              {t("cash.subtitle")}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAIPanelOpen(true)}
              className="px-3.5 py-1.5 bg-brand/10 hover:bg-brand/20 border border-brand/30 text-brand text-xs font-bold rounded-btn flex items-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t("cash.askAi")}</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentPage("funding")}
              className="px-4 py-1.5 bg-brand hover:bg-brand-dark text-white text-xs font-semibold rounded-btn flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Coins className="w-3.5 h-3.5" />
              <span>{t("cash.rankFunders")}</span>
            </button>
          </div>
        </div>

        {/* Cash Shortage Spotlight Banner */}
        <div className={`p-4 rounded-card border-2 flex ${breachDays.length ? "bg-red-50 border-danger" : "bg-emerald-50 border-emerald-300"} flex-col md:flex-row md:items-center justify-between gap-4 shadow-soft-sm`}>
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl text-white flex items-center justify-center shrink-0 ${breachDays.length ? "bg-danger" : "bg-emerald-600"}`}>
              {breachDays.length ? <AlertTriangle className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`text-xs font-bold uppercase tracking-wider ${breachDays.length ? "text-danger" : "text-emerald-800"}`}>
                  {breachDays.length
                    ? t("cash.belowDays", { n: breachDays.length, from: breachDays[0].date, to: breachDays[breachDays.length - 1].date })
                    : t("cash.staysAbove")}
                </h3>
                <span className={`text-[10px] bg-white px-2 py-0.2 rounded border font-bold ${breachDays.length ? "text-danger border-danger/30" : "text-emerald-700 border-emerald-300"}`}>
                  {minCashDay.projectedCash < 0 ? t("cash.negative") : breachDays.length ? t("chart.belowReserve") : t("cash.notNegative")}
                </span>
              </div>
              <p className={`text-xs mt-1 leading-relaxed ${breachDays.length ? "text-red-900" : "text-emerald-900"}`}>
                {t("cash.lowestLine", { amount: money(minCashDay.projectedCash), date: minCashDay.date, reserve: money(minCashDay.reserveLine) })}{" "}·{" "}
                {timelineEnvelope.kind === "forecast" ? t("cash.basedForecast") : t("cash.basedSaved")}
                {defaultSme ? ` · ${t("cash.defaultSme")}` : ""}
                {missing.length ? ` · ${t("common.missingList", { list: missing.map(missingDataLabel).join(", ") })}` : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSelectedDayIndex(minCashDay.dayIndex)}
              className="px-3 py-1.5 bg-white border border-danger/40 text-danger text-xs font-semibold rounded-lg hover:bg-red-100 transition-colors"
            >
              {t("cash.viewLowest", { date: minCashDay.date })}
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage("funding")}
              className="px-4 py-1.5 bg-danger text-white text-xs font-bold rounded-lg hover:bg-danger-dark transition-all flex items-center gap-1 shadow-sm"
            >
              <span>{t("cash.mitigation")}</span>
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
              1. {t("missing.operating_cash_flow")}
            </span>
            <div className="text-lg font-bold font-mono text-emerald-700 tabular-nums">
              {money(statementLine("operating_cash_flow"))}
            </div>
            <p className="text-[11px] text-ink-muted mt-1 leading-tight">
              {statementLine("operating_cash_flow") == null
                ? t("cash.addOperating")
                : t("cash.basedReported")}
            </p>
          </div>

          <div className="p-4 rounded-card bg-white border border-borderLine">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              2. {t("missing.investing_cash_flow")}
            </span>
            <div className="text-lg font-bold font-mono text-ink tabular-nums">
              {money(statementLine("investing_cash_flow"))}
            </div>
            <p className="text-[11px] text-ink-muted mt-1 leading-tight">
              {statementLine("investing_cash_flow") == null
                ? t("cash.addInvesting")
                : t("cash.basedReported")}
            </p>
          </div>

          <div className="p-4 rounded-card bg-white border border-borderLine">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              3. {t("missing.financing_cash_flow")}
            </span>
            <div className="text-lg font-bold font-mono text-brand tabular-nums">
              {money(statementLine("financing_cash_flow"))}
            </div>
            <p className="text-[11px] text-ink-muted mt-1 leading-tight">
              {statementLine("financing_cash_flow") == null
                ? t("cash.addFinancing")
                : t("cash.notCredit")}
            </p>
          </div>
        </div>

        {/* Financial Events Table for Selected Day */}
        <div className="bg-white rounded-card border border-borderLine p-4 space-y-3 shadow-soft-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-display font-bold text-ink flex items-center gap-2">
              <Calendar className="w-4 h-4 text-brand" />
              <span>{t("cash.txOn", { date: currentDay.date })}</span>
            </h3>
            <span className="text-xs text-ink-muted">
              {t("cash.txCount", { n: currentDay.events.length })}
            </span>
          </div>

          {currentDay.events.length === 0 ? (
            <div className="p-8 text-center text-xs text-ink-muted bg-slate-50 rounded-xl">
              {t("cash.noTxOn", { date: currentDay.date })}
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
                        {ev.partner || t("cash.internal")}
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

        {/* เพิ่ม preview ให้ลองใส่รายการเองได้ แม้จะมี timeline จริงอยู่แล้ว */}
        {previewForm}
      </div>
    </StateRenderer>
  );
};
