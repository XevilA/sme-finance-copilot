import React, { useState, useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import { apiClient } from "@/api/client";
import { CostBreakdown } from "@/api/contracts/types";
import { envelopeMode, useEnvelope } from "@/hooks/useEnvelope";
import { DataKindBadge } from "@/components/signature/DataKindBadge";
import { StateRenderer } from "@/components/ui/StateRenderer";
import {
  PieChart,
  Calculator,
  ArrowRight,
  Sparkles,
  TrendingUp,
  CheckCircle2,
} from "lucide-react";

export const CostPage: React.FC = () => {
  const { setCurrentPage } = useAppStore();
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const load = useCallback(() => apiClient.getCostBreakdown(), []);
  const state = useEnvelope<CostBreakdown>(load);
  const { envelope: costEnvelope, loading, error, reload: loadData } = state;
  // An unknown cost metric is null plus a name in missing. It is rendered as
  // "No data", never as a zero placeholder and never via .toLocaleString().
  const money = (value: number | null | undefined) =>
    value == null ? "No data" : `฿${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  const units = (value: number | null | undefined) =>
    value == null ? "No data" : value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  const mode = envelopeMode(state, (data) =>
    data.costPerUnit == null &&
    data.profitPerUnit == null &&
    data.breakevenUnits == null &&
    data.currentMonthlyFixedCost == null &&
    data.currentMonthlyVariableCost == null &&
    data.categories.length === 0 &&
    data.investmentPlans.length === 0);

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="h-40 bg-slate-200 rounded-card animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-64 bg-slate-200 rounded-card animate-pulse" />
          <div className="h-64 bg-slate-200 rounded-card animate-pulse" />
        </div>
      </div>
    );
  }

  const cost = costEnvelope?.data;
  const missing = costEnvelope?.missing || [];

  if (!cost || mode === "error" || mode === "unavailable" || mode === "insufficient_data") {
    return (
      <StateRenderer
        currentMode={mode === "error" ? "error" : mode === "unavailable" ? "unavailable" : "insufficient_data"}
        errorMessage={error || "Could not load the cost breakdown from the backend"}
        unavailableReason="Statement totals do not provide unit-cost evidence or a dated investment schedule."
        missingItems={missing}
        onRetry={loadData}
        onAddData={() => setCurrentPage("import")}
      >
        {null}
      </StateRenderer>
    );
  }

  return (
    <StateRenderer currentMode={mode === "stale" ? "stale" : undefined} onRetry={loadData} onReanalyze={() => setCurrentPage("import")}>
      <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6 text-ink animate-fade-in">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-borderLine pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-brand text-white flex items-center justify-center font-bold">
                <PieChart className="w-4 h-4" />
              </div>
              <h1 className="text-xl font-display font-bold text-ink">
                Cost Breakdown & Investment Appraisal
              </h1>
              <DataKindBadge kind={costEnvelope?.kind ?? "actual"} size="md" />
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              Unit cost structure, break-even analysis, and Plan A vs. Plan B investment comparison.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage("unlock")}
              className="px-3.5 py-1.5 bg-resource-light hover:bg-resource/20 border border-resource/30 text-resource-dark text-xs font-semibold rounded-btn flex items-center gap-1 transition-colors"
            >
              <span>Reduce costs with SME UNLOCK</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Section 1: Current Cost Breakdown & Breakeven */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-white p-5 rounded-card border border-borderLine shadow-soft-sm">
          <div>
            <span className="text-[10px] text-ink-muted block uppercase tracking-wider">Cost per unit</span>
            <span className="text-2xl font-bold font-mono text-ink">{money(cost.costPerUnit)}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {cost.costPerUnit == null ? "Missing cost_per_unit" : "Per unit sold this period"}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-ink-muted block uppercase tracking-wider">Contribution per unit</span>
            <span className="text-2xl font-bold font-mono text-brand">{money(cost.profitPerUnit)}</span>
            <span className="text-[10px] text-brand/80 block mt-0.5">
              {cost.profitPerUnit == null ? "Missing contribution_per_unit" : "Selling price minus variable cost per unit"}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-ink-muted block uppercase tracking-wider">Break-even point</span>
            <span className="text-2xl font-bold font-mono text-emerald-700">{units(cost.breakevenUnits)}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {cost.breakevenUnits == null ? "Missing breakeven_units" : "Units to sell to cover fixed costs"}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-ink-muted block uppercase tracking-wider">Monthly fixed costs</span>
            <span className="text-2xl font-bold font-mono text-ink">{money(cost.currentMonthlyFixedCost)}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {cost.currentMonthlyVariableCost == null
                ? "Variable costs: No data"
                : `Variable costs ${money(cost.currentMonthlyVariableCost)}`}
            </span>
          </div>
        </div>

        {/* Section 2: Investment Appraisal Plans (A vs B in Single Screen) */}
        <div className="bg-white rounded-card p-5 border border-borderLine space-y-4 shadow-soft-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-display font-bold text-xs uppercase tracking-wider text-ink">
                Compare investment plans: Buy equipment (Plan A) vs. share or rent through UNLOCK (Plan B)
              </h3>
              <p className="text-[11px] text-ink-muted">
                {cost.investmentPlans.length
                  ? "Calculate payback period, net present value (NPV), and internal rate of return (IRR)."
                  : "No investment plans are available to compare. A dated investment cash flow schedule (investment_cash_schedule) is required to calculate payback, NPV, and IRR · These figures are not inferred from statement totals."}
              </p>
            </div>
            <DataKindBadge kind="forecast" size="sm" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cost.investmentPlans.map((plan, planIndex) => {
              const isSelected = (selectedPlanId || cost.investmentPlans[0]?.id) === plan.id;
              // Highlight is position in the returned list only. The engine does
              // not return a recommendation, so none is claimed here.
              const isPlanB = planIndex > 0;

              return (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-4 ${
                    isSelected
                      ? isPlanB
                        ? "bg-resource-light/40 border-resource ring-2 ring-resource/30 shadow-soft-md"
                        : "bg-brand/5 border-brand ring-2 ring-brand/30 shadow-soft-md"
                      : "bg-slate-50 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-chip ${isPlanB ? "bg-resource text-white" : "bg-slate-200 text-ink"}`}>
                        {isPlanB ? "Plan B" : "Plan A"}
                      </span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                    </div>

                    <h4 className="font-display font-bold text-sm text-ink mb-3 leading-snug">
                      {plan.name}
                    </h4>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-3 gap-2 p-3 bg-white rounded-xl border border-slate-200 text-center text-xs mb-3">
                      <div>
                        <span className="text-[10px] text-ink-muted block">Initial investment</span>
                        <span className="font-bold font-mono text-ink">฿{plan.initialInvestment.toLocaleString()}</span>
                      </div>
                      <div className="border-x border-slate-200">
                        <span className="text-[10px] text-ink-muted block">Payback period</span>
                        <span className="font-bold font-mono text-emerald-700">{plan.paybackMonths} months</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-ink-muted block">IRR</span>
                        <span className="font-bold font-mono text-brand">{plan.irr}%</span>
                      </div>
                    </div>

                    {/* Assumptions */}
                    <div className="space-y-1.5 text-[11px] text-ink-muted">
                      <span className="font-bold text-ink block text-[10px]">Assumptions:</span>
                      {plan.assumptions.map((asm, idx) => (
                        <div key={idx} className="flex justify-between border-b border-slate-100/60 pb-1">
                          <span>{asm.label}</span>
                          <span className="font-bold font-mono text-ink">
                            {asm.value.toLocaleString()} {asm.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                    <span className="text-ink-muted">NPV: <strong>฿{plan.npv.toLocaleString()}</strong></span>
                    <span className="text-brand font-bold">
                      {isSelected ? "Selected plan" : "Select this plan"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </StateRenderer>
  );
};
