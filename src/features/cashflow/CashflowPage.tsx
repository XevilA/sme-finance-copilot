import React, { useState, useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import { apiClient } from "@/api/client";
import { CashflowDay } from "@/api/contracts/types";
import { envelopeMode, useAnalysisContext, useEnvelope } from "@/hooks/useEnvelope";
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

  const { accepted, stale } = useAnalysisContext();
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const load = useCallback(() => apiClient.getCashflowTimeline(), []);
  const state = useEnvelope<CashflowDay[]>(load);
  const { envelope: timelineEnvelope, loading, error, reload: loadData } = state;
  const mode = envelopeMode(state, (rows) => rows.length === 0);
  const money = (value: number | null | undefined) =>
    value == null ? "No data" : `฿${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  // Cash-flow statement lines come from the statement that was analysed. The
  // dated timeline contract does not return them, so they are not invented.
  const statementLine = (field: string) => {
    const value = accepted?.input?.[field];
    return value == null || value === "" ? null : Number(value);
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="h-64 bg-slate-200 rounded-card animate-pulse" />
        <div className="h-96 bg-slate-200 rounded-card animate-pulse" />
      </div>
    );
  }

  const timeline = timelineEnvelope?.data || [];
  const missing = timelineEnvelope?.missing || [];

  if (!timelineEnvelope || mode === "error" || mode === "unavailable" || mode === "insufficient_data") {
    return (
      <StateRenderer
        currentMode={mode === "error" ? "error" : mode === "unavailable" ? "unavailable" : "insufficient_data"}
        errorMessage={error || "Could not load the cash flow schedule from the backend"}
        unavailableReason={accepted
          ? "The imported statement contains period totals but no dated cash transactions · The system will not substitute a sample business schedule or spread totals across days."
          : "No dated cash transactions are available for this business."}
        missingItems={missing}
        onRetry={loadData}
        onAddData={() => setCurrentPage("import")}
      >
        {null}
      </StateRenderer>
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
                Cash & Cash Flow (Cash Flow Forecast)
              </h1>
              <DataKindBadge kind="forecast" size="md" />
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              Review cash inflows and outflows, upcoming obligations, and future balances with Time Travel.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAIPanelOpen(true)}
              className="px-3.5 py-1.5 bg-brand/10 hover:bg-brand/20 border border-brand/30 text-brand text-xs font-bold rounded-btn flex items-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ask AI to identify cash shortfalls</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentPage("funding")}
              className="px-4 py-1.5 bg-brand hover:bg-brand-dark text-white text-xs font-semibold rounded-btn flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Coins className="w-3.5 h-3.5" />
              <span>Rank funders against the shortfall</span>
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
                  {breachDays.length
                    ? `Cash is below the reserve for ${breachDays.length} days (${breachDays[0].date} – ${breachDays[breachDays.length - 1].date})`
                    : "Cash stays above the reserve throughout this schedule"}
                </h3>
                <span className="text-[10px] bg-white text-danger px-2 py-0.2 rounded border border-danger/30 font-bold">
                  {minCashDay.projectedCash < 0 ? "Negative" : breachDays.length ? "Below reserve" : "Not negative"}
                </span>
              </div>
              <p className="text-xs text-red-900 mt-1 leading-relaxed">
                Lowest scheduled cash balance: <strong>{money(minCashDay.projectedCash)}</strong> on{" "}
                <strong>{minCashDay.date}</strong> · Reserve: {money(minCashDay.reserveLine)} ·{" "}
                {timelineEnvelope.kind === "forecast" ? "Forecast based on dated transactions" : "Based on saved transactions"}
                {defaultSme ? " · No business selected; the default business is shown" : ""}
                {missing.length ? ` · Missing data: ${missing.join(", ")}` : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSelectedDayIndex(minCashDay.dayIndex)}
              className="px-3 py-1.5 bg-white border border-danger/40 text-danger text-xs font-semibold rounded-lg hover:bg-red-100 transition-colors"
            >
              View lowest-cash date ({minCashDay.date})
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage("funding")}
              className="px-4 py-1.5 bg-danger text-white text-xs font-bold rounded-lg hover:bg-danger-dark transition-all flex items-center gap-1 shadow-sm"
            >
              <span>Open mitigation plan</span>
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
              1. Operating cash flow
            </span>
            <div className="text-lg font-bold font-mono text-emerald-700 tabular-nums">
              {money(statementLine("operating_cash_flow"))}
            </div>
            <p className="text-[11px] text-ink-muted mt-1 leading-tight">
              {statementLine("operating_cash_flow") == null
                ? "Add operating_cash_flow to the imported statement · The daily schedule does not calculate this figure."
                : "Based on the value reported for this period."}
            </p>
          </div>

          <div className="p-4 rounded-card bg-white border border-borderLine">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              2. Investing cash flow
            </span>
            <div className="text-lg font-bold font-mono text-ink tabular-nums">
              {money(statementLine("investing_cash_flow"))}
            </div>
            <p className="text-[11px] text-ink-muted mt-1 leading-tight">
              {statementLine("investing_cash_flow") == null
                ? "Add investing_cash_flow to the imported statement · A blank value is not treated as zero."
                : "Based on the value reported for this period."}
            </p>
          </div>

          <div className="p-4 rounded-card bg-white border border-borderLine">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              3. Financing cash flow
            </span>
            <div className="text-lg font-bold font-mono text-brand tabular-nums">
              {money(statementLine("financing_cash_flow"))}
            </div>
            <p className="text-[11px] text-ink-muted mt-1 leading-tight">
              {statementLine("financing_cash_flow") == null
                ? "Add financing_cash_flow to the imported statement · No facility has been allocated or approved."
                : "Based on the reported value · This is not an approved credit facility."}
            </p>
          </div>
        </div>

        {/* Financial Events Table for Selected Day */}
        <div className="bg-white rounded-card border border-borderLine p-4 space-y-3 shadow-soft-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-display font-bold text-ink flex items-center gap-2">
              <Calendar className="w-4 h-4 text-brand" />
              <span>Cash transactions on {currentDay.date}</span>
            </h3>
            <span className="text-xs text-ink-muted">
              {currentDay.events.length} transactions today
            </span>
          </div>

          {currentDay.events.length === 0 ? (
            <div className="p-8 text-center text-xs text-ink-muted bg-slate-50 rounded-xl">
              No cash transactions on {currentDay.date}
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
                        {ev.partner || "Internal"}
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
