import React, { useCallback, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { apiClient } from "@/api/client";
import { BusinessOverview } from "@/api/contracts/types";
import { envelopeMode, useEnvelope } from "@/hooks/useEnvelope";
import { HeroAssembly } from "./HeroAssembly";
import { DataKindBadge } from "@/components/signature/DataKindBadge";
import { StateRenderer } from "@/components/ui/StateRenderer";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Coins,
  ShieldCheck,
  CreditCard,
  FileText,
  Calendar,
} from "lucide-react";

export const OverviewPage: React.FC = () => {
  const { setCurrentPage, setAIPanelOpen, activeEvidenceTargetId } = useAppStore();
  const load = useCallback(() => apiClient.getOverview(), []);
  const state = useEnvelope<BusinessOverview>(load);
  const { envelope: dataEnvelope, loading, error, reload: loadData } = state;
  const mode = envelopeMode(state, (value) =>
    value.revenue == null && value.expense == null && value.netProfit == null
    && value.cashBalance == null && value.actionableItems.length === 0);
  const amount = (value: number | null | undefined) => value == null ? "No data" : value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  const change = (value: number | null | undefined) => value == null ? "No prior-period comparison" : `${value > 0 ? "+" : ""}฿${amount(value)} vs. previous period`;
  const [selectedMetric, setSelectedMetric] = useState<"cash" | "profit" | "revenue" | "expense">("cash");

  if (!loading && (error || mode === "error")) {
    return (
      <StateRenderer currentMode="error" errorMessage={error || "Could not load the business overview from the backend"} onRetry={loadData}>
        {null}
      </StateRenderer>
    );
  }

  if (!loading && dataEnvelope && (mode === "unavailable" || mode === "insufficient_data")) {
    return (
      <StateRenderer
        currentMode={mode === "unavailable" ? "unavailable" : "insufficient_data"}
        unavailableReason="No analyzed financial statements are available for this business."
        missingItems={dataEnvelope.missing}
        onRetry={loadData}
        onAddData={() => setCurrentPage("import")}
      >
        {null}
      </StateRenderer>
    );
  }

  if (loading || !dataEnvelope) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="h-64 bg-slate-200 rounded-card animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="h-28 bg-slate-200 rounded-card animate-pulse" />
          <div className="h-28 bg-slate-200 rounded-card animate-pulse" />
          <div className="h-28 bg-slate-200 rounded-card animate-pulse" />
          <div className="h-28 bg-slate-200 rounded-card animate-pulse" />
        </div>
      </div>
    );
  }

  const { data, kind, asOf, analyzedAt } = dataEnvelope;
  const margin = (data as BusinessOverview & { netProfitMargin?: number }).netProfitMargin;

  return (
    <StateRenderer
      currentMode={mode === "stale" ? "stale" : undefined}
      missingItems={dataEnvelope.missing}
      onAddData={() => setCurrentPage("import")}
      onRetry={loadData}
      onReanalyze={() => setCurrentPage("import")}
    >
      <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in text-ink">
        {/* Signature S1: Hero Assembly Studio */}
        <HeroAssembly />

        {/* Header Bar with timestamps and AI explain trigger */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-borderLine pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-display font-bold text-ink">
                Financial Health & Business Opportunities
              </h2>
              <DataKindBadge kind={kind} size="md" />
            </div>
            <p className="text-xs text-ink-muted flex items-center gap-2 mt-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                Period: <strong>{data.period}</strong> · Source: {dataEnvelope.source}
                {asOf ? ` · Last updated: ${new Date(asOf).toLocaleDateString("en-US")}` : " · Data date not specified"}
                {dataEnvelope.missing.length ? ` · ${dataEnvelope.missing.length} missing data items` : ""}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage("import")}
              className="px-3 py-1.5 bg-white border border-borderLine hover:border-brand/40 text-xs font-medium rounded-btn flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3 h-3 text-ink-muted" />
              <span>Edit data and reanalyze</span>
            </button>

            <button
              type="button"
              onClick={() => setAIPanelOpen(true)}
              className="px-3.5 py-1.5 bg-brand/10 hover:bg-brand/20 border border-brand/30 text-brand text-xs font-bold rounded-btn flex items-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ask AI to explain the overview</span>
            </button>
          </div>
        </div>

        {/* 5 Financial Metric Cards (Distinct Profit vs Cash) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* 1. Revenue */}
          <div
            onClick={() => setSelectedMetric("revenue")}
            className={`p-4 rounded-card border transition-all cursor-pointer bg-white ${
              selectedMetric === "revenue"
                ? "border-brand ring-2 ring-brand/20 shadow-soft-md"
                : "border-borderLine hover:border-brand/30"
            }`}
          >
            <div className="flex items-center justify-between text-xs text-ink-muted mb-1">
              <span>Total revenue</span>
              <DataKindBadge kind={kind} size="sm" />
            </div>
            <div className="text-xl font-bold font-display text-ink tabular-nums">
              ฿{amount(data.revenue)}
            </div>
            <div className="text-[11px] text-emerald-600 flex items-center gap-1 mt-1 font-medium">
              <TrendingUp className="w-3 h-3" />
              <span>{change(data.lastPeriodDiff.revenue)}</span>
            </div>
          </div>

          {/* 2. Expense */}
          <div
            onClick={() => setSelectedMetric("expense")}
            className={`p-4 rounded-card border transition-all cursor-pointer bg-white ${
              selectedMetric === "expense"
                ? "border-brand ring-2 ring-brand/20 shadow-soft-md"
                : "border-borderLine hover:border-brand/30"
            }`}
          >
            <div className="flex items-center justify-between text-xs text-ink-muted mb-1">
              <span>Total expenses</span>
              <DataKindBadge kind={kind} size="sm" />
            </div>
            <div className="text-xl font-bold font-display text-ink tabular-nums">
              ฿{amount(data.expense)}
            </div>
            <div className="text-[11px] text-amber-600 flex items-center gap-1 mt-1 font-medium">
              <TrendingUp className="w-3 h-3" />
              <span>{change(data.lastPeriodDiff.expense)}</span>
            </div>
          </div>

          {/* 3. Net Profit (Distinct from Cash) */}
          <div
            id="stat-net-profit"
            onClick={() => setSelectedMetric("profit")}
            className={`p-4 rounded-card border transition-all cursor-pointer bg-white relative ${
              activeEvidenceTargetId === "stat-net-profit"
                ? "border-brand ring-4 ring-brand/40 shadow-glow-primary animate-pulse"
                : selectedMetric === "profit"
                ? "border-brand ring-2 ring-brand/20 shadow-soft-md"
                : "border-borderLine hover:border-brand/30"
            }`}
          >
            <div className="flex items-center justify-between text-xs text-ink-muted mb-1">
              <span className="font-semibold text-brand">Accounting net profit</span>
              <DataKindBadge kind={kind} size="sm" />
            </div>
            <div className="text-xl font-bold font-display text-brand tabular-nums">
              ฿{amount(data.netProfit)}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Net margin {margin == null ? "No data" : `${amount(margin)}%`}
            </div>
          </div>

          {/* 4. Cash Balance (In Hand) */}
          <div
            id="stat-cash-balance"
            onClick={() => setSelectedMetric("cash")}
            className={`p-4 rounded-card border transition-all cursor-pointer bg-white relative ${
              activeEvidenceTargetId === "stat-cash-balance"
                ? "border-danger ring-4 ring-danger/40 shadow-glow-danger animate-pulse"
                : selectedMetric === "cash"
                ? "border-attention ring-2 ring-attention/20 shadow-soft-md"
                : "border-borderLine hover:border-attention/40"
            }`}
          >
            <div className="flex items-center justify-between text-xs text-ink-muted mb-1">
              <span className="font-semibold text-ink">{kind === "actual" ? "Actual cash balance" : "Cash balance as reported"}</span>
              <DataKindBadge kind={kind} size="sm" />
            </div>
            <div className="text-xl font-bold font-display text-attention-dark tabular-nums">
              ฿{amount(data.cashBalance)}
            </div>
            <div className="text-[11px] text-danger flex items-center gap-1 mt-1 font-medium">
              <TrendingDown className="w-3 h-3" />
              <span>{change(data.lastPeriodDiff.cashBalance)}</span>
            </div>
          </div>

          {/* 5. Usable Cash after Reserve */}
          <div
            id="stat-reserve-line"
            className="p-4 rounded-card border border-danger/30 bg-red-50/40 relative"
          >
            <div className="flex items-center justify-between text-xs text-danger mb-1">
              <span className="font-bold">Cash available after reserve</span>
              <DataKindBadge kind={kind} size="sm" />
            </div>
            <div className="text-xl font-bold font-display text-danger tabular-nums">
              ฿{amount(data.usableCashAfterReserve)}
            </div>
            <div className="text-[10px] text-danger font-medium mt-1">
              Reported reserve: ฿{amount(data.reserveThreshold)}
            </div>
          </div>
        </div>

        {/* Essential Contrast Callout: "แยกกำไร vs เงินสด" (Hard Rule & UX Principle) */}
        <div className="p-4 rounded-card bg-gradient-to-r from-brand/5 via-white to-amber-50/50 border border-brand/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0 mt-0.5">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-ink uppercase tracking-wider">
                Accounting profit ฿{amount(data.netProfit)} · Cash balance ฿{amount(data.cashBalance)}
              </h4>
              <p className="text-xs text-ink-muted leading-relaxed mt-0.5">
                {data.cashVsProfitInsight}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setCurrentPage("cashflow")}
            className="px-4 py-2 bg-brand text-white text-xs font-semibold rounded-btn hover:bg-brand-dark flex items-center gap-1.5 shrink-0 shadow-sm transition-all"
          >
            <span>View the 90-day Time Travel cash chart</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 4 Actionable Items (เรื่องที่ควรทำต่อ per Screen G3) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-display font-bold text-ink flex items-center gap-1.5">
              <span>Recommended actions to maintain liquidity</span>
              <span className="text-[10px] bg-slate-100 text-ink-muted px-2 py-0.5 rounded-chip font-normal">
                {data.actionableItems.length} recommendations
              </span>
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {data.actionableItems.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-card bg-white border border-borderLine hover:border-brand/40 hover:shadow-soft-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-chip ${
                        item.priority === "high"
                          ? "bg-red-50 text-danger border border-danger/20"
                          : item.priority === "medium"
                          ? "bg-amber-50 text-attention border border-attention/20"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {item.priority === "high" ? "Urgent" : item.priority === "medium" ? "Important" : "Recommendation"}
                    </span>
                    {item.dueDate && (
                      <span className="text-[11px] text-ink-muted font-mono">
                        Due: {item.dueDate}
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs font-display font-bold text-ink mb-1">
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-ink-muted leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                  {item.amount ? (
                    <span className="text-xs font-bold font-mono text-ink">
                      Amount: ฿{item.amount.toLocaleString("en-US")}
                    </span>
                  ) : <span />}

                  <button
                    type="button"
                    onClick={() => setCurrentPage(item.targetPage as any)}
                    className="text-xs font-semibold text-brand hover:text-brand-dark flex items-center gap-1"
                  >
                    <span>{item.actionText}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3 Quick Launch Opportunity Studios */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-borderLine">
          <div
            onClick={() => setCurrentPage("import")}
            className="p-4 rounded-card bg-white border border-borderLine hover:border-brand hover:shadow-soft-md transition-all cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-xl bg-slate-100 group-hover:bg-brand group-hover:text-white transition-colors flex items-center justify-center text-ink mb-2">
              <FileText className="w-4 h-4" />
            </div>
            <h4 className="font-display font-bold text-xs text-ink mb-1">
              Understand your business finances
            </h4>
            <p className="text-[11px] text-ink-muted">
              Upload an Excel file (.xlsx) or complete the 8-category form to assess your business.
            </p>
          </div>

          <div
            onClick={() => setCurrentPage("swarm")}
            className="p-4 rounded-card bg-gradient-to-br from-white to-brand/5 border border-borderLine hover:border-brand hover:shadow-soft-md transition-all cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-xl bg-brand/10 group-hover:bg-brand group-hover:text-white transition-colors flex items-center justify-center text-brand mb-2">
              <Sparkles className="w-4 h-4" />
            </div>
            <h4 className="font-display font-bold text-xs text-ink mb-1">
              Assemble a team for a large order (SME SWARM)
            </h4>
            <p className="text-[11px] text-ink-muted">
              Open an order and calculate work allocation using available shop data.
            </p>
          </div>

          <div
            onClick={() => setCurrentPage("unlock")}
            className="p-4 rounded-card bg-white border border-borderLine hover:border-resource hover:shadow-soft-md transition-all cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-xl bg-resource-light group-hover:bg-resource group-hover:text-white transition-colors flex items-center justify-center text-resource-dark mb-2">
              <Coins className="w-4 h-4" />
            </div>
            <h4 className="font-display font-bold text-xs text-ink mb-1">
              Unlock existing resources (SME UNLOCK)
            </h4>
            <p className="text-[11px] text-ink-muted">
              Share kitchens, delivery vehicles, or machinery to reduce upfront costs.
            </p>
          </div>
        </div>
      </div>
    </StateRenderer>
  );
};
