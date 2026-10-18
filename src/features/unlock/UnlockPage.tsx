import React, { useCallback, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { apiClient } from "@/api/client";
import { Capabilities, UnlockResource } from "@/api/contracts/types";
import { OrderComparison, OrderContext } from "@/api/client";
import { envelopeMode, useEnvelope } from "@/hooks/useEnvelope";
import { ResourceTile } from "@/components/signature/ResourceTile";
import { DataKindBadge } from "@/components/signature/DataKindBadge";
import { StateRenderer } from "@/components/ui/StateRenderer";
import {
  Wrench,
  Sparkles,
  RotateCcw,
  Coins,
  Truck,
  ChefHat,
  Cog,
  Users,
  Building2,
  TrendingDown,
  TrendingUp,
  ArrowRight,
  Sliders,
  CheckCircle2,
} from "lucide-react";

export const UnlockPage: React.FC = () => {
  const {
    detachedResourceIds,
    toggleDetachResource,
    resetSimulation,
    addToast,
    setCurrentPage,
  } = useAppStore();

  // Before/After Value Split Slider (0 to 100%)
  const [splitRatio, setSplitRatio] = useState(50);

  // Active Category Filter
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const state = useEnvelope<UnlockResource[]>(useCallback(() => apiClient.getUnlockResources(), []));
  const { envelope: resourcesEnvelope, loading, error, reload: loadData } = state;
  const mode = envelopeMode(state, (rows) => rows.length === 0);
  const capabilityState = useEnvelope<Capabilities>(useCallback(
    () => (apiClient.isDemoMode()
      ? Promise.reject(new Error("The demo mode does not declare backend capabilities"))
      : apiClient.getCapabilities()),
    []));
  const canReserve = capabilityState.envelope?.data.resourceReservation.available === true;
  const reserveBlockedReason = capabilityState.envelope?.data.resourceReservation.reason
    || "The backend does not support resource reservations yet.";

  // Taking a resource out of the plan is recomputed by the engine through
  // POST /simulate/order with unavailable_resource_ids. The browser does not
  // add up a stored "impact if detached" figure and call it the new cost.
  const [outage, setOutage] = useState<{ comparison: OrderComparison | null; error: string; pending: boolean }>(
    { comparison: null, error: "", pending: false });
  const [baseline, setBaseline] = useState<OrderContext | null>(null);
  const outageSequence = React.useRef(0);

  const recomputeOutage = async (resourceIds: string[]) => {
    if (apiClient.isDemoMode()) { setOutage({ comparison: null, error: "The demo mode does not calculate results with the engine.", pending: false }); return; }
    if (resourceIds.length === 0) { setOutage({ comparison: null, error: "", pending: false }); return; }
    const id = ++outageSequence.current;
    setOutage((previous) => ({ ...previous, pending: true, error: "" }));
    try {
      const context = baseline || (await apiClient.getOrderContext()).data;
      if (!baseline) setBaseline(context);
      // Only identifiers present in the baseline may be disabled; the engine
      // answers HTTP 422 for anything else rather than inventing a dependency.
      const known = new Set(context.shops.flatMap((shop) => (shop.resources || []).map((item) => item.resource_id).filter(Boolean)));
      const applicable = resourceIds.filter((value) => known.has(value));
      if (applicable.length === 0) {
        if (outageSequence.current === id) setOutage({ comparison: null, pending: false,
          error: "The selected resource is not linked to the order being assembled, so its impact cannot be calculated." });
        return;
      }
      const result = await apiClient.simulateOrder(context, {
        unit_price: context.unit_price,
        cost_per_unit: null, // Keep each shop's own cost; impose no average.
        deposit_ratio: context.deposit_ratio,
        payment_terms_days: context.payment_terms_days,
        remove_shops: [],
        unavailable_resource_ids: applicable,
      });
      if (outageSequence.current === id) setOutage({ comparison: result, error: "", pending: false });
    } catch (err) {
      if (outageSequence.current === id) setOutage({ comparison: null, error: (err as Error).message, pending: false });
    }
  };

  const handleToggleDetach = (res: UnlockResource) => {
    toggleDetachResource(res.id);
    const isNowDetached = !detachedResourceIds.includes(res.id);
    const next = isNowDetached
      ? [...detachedResourceIds, res.id]
      : detachedResourceIds.filter((value) => value !== res.id);
    void recomputeOutage(next);
    addToast({
      type: "info",
      title: isNowDetached ? "Remove from plan and recalculate" : "Restore to plan and recalculate",
      message: `'${res.title}' · The engine will preview a new order allocation (persist=false)`
        + ` · Live resource status remains unchanged and nothing is reserved (${reserveBlockedReason})`,
      duration: 9000,
    });
  };

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

  const allResources = resourcesEnvelope?.data || [];
  const filteredResources =
    activeCategory === "all"
      ? allResources
      : allResources.filter((r) => r.category === activeCategory);

  if (!resourcesEnvelope || mode === "error" || mode === "unavailable" || mode === "insufficient_data") {
    return (
      <StateRenderer
        currentMode={mode === "error" ? "error" : mode === "unavailable" ? "unavailable" : "insufficient_data"}
        errorMessage={error || "Could not load shareable resources from the backend"}
        unavailableReason="No resources are available for sharing in the database."
        missingItems={resourcesEnvelope?.missing || []}
        onRetry={loadData}
      >
        {null}
      </StateRenderer>
    );
  }

  // Effect of the outage as the engine recomputed it: Plan B against Plan A for
  // this order only. Null means the engine has not produced a comparison.
  const planA = outage.comparison?.data.planA;
  const planB = outage.comparison?.data.planB;
  const amount = (value: number | string | null | undefined) =>
    value == null ? "No data" : `฿${Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  const outageSummary = outage.pending
    ? "The engine is reallocating the order…"
    : outage.error
    ? outage.error
    : planA && planB
    ? `Allocated capacity: ${planB.totalCapacityAssigned} (was ${planA.totalCapacityAssigned})`
      + ` · Capacity shortfall: ${planB.deficitBoxesPerDay} per day (was ${planA.deficitBoxesPerDay})`
      + ` · Order profit: ${amount(planB.totalProfit)} (was ${amount(planA.totalProfit)})`
      + ` · Funding gap: ${amount(planB.totalFundingGap)} (was ${amount(planA.totalFundingGap)})`
    : "No engine results yet.";

  return (
    <StateRenderer onRetry={loadData}>
      <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6 text-ink animate-fade-in">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-borderLine pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-resource text-white flex items-center justify-center font-bold">
                <Wrench className="w-4 h-4" />
              </div>
              <h1 className="text-xl font-display font-bold text-ink">
                SME UNLOCK: Unlock & Share Resources
              </h1>
              <DataKindBadge kind={resourcesEnvelope.kind} size="md" />
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              Review resources offered by their owners · Remove a resource from the plan to preview a new engine allocation
              (nothing is reserved or changed in the live system)
            </p>
          </div>

          <div className="flex items-center gap-2">
            {detachedResourceIds.length > 0 && (
              <button
                type="button"
                onClick={() => { resetSimulation(); void recomputeOutage([]); }}
                className="px-3 py-1.5 bg-white border border-borderLine hover:border-brand/40 text-xs font-semibold rounded-btn flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 text-ink-muted" />
                <span>Restore all resources ({detachedResourceIds.length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setCurrentPage("swarm")}
              className="px-4 py-1.5 bg-brand hover:bg-brand-dark text-white text-xs font-bold rounded-btn flex items-center gap-1.5 shadow-sm transition-all"
            >
              <span>Return to SWARM team assembly</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Signature S5: Detached Part Alert Banner */}
        {detachedResourceIds.length > 0 && (
          <div className="p-4 rounded-card bg-red-50 border-2 border-danger text-danger flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-soft-sm animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-danger text-white flex items-center justify-center shrink-0">
                !
              </div>
              <div>
                <h3 className="font-bold text-xs uppercase tracking-wider">
                  Simulate removing resources ({detachedResourceIds.length}) · Recalculate this order only
                </h3>
                <p className="text-xs text-red-900 mt-0.5">
                  <strong>{outageSummary}</strong>
                  {planB ? " · Preview only; live allocations and resource status are unchanged." : ""}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => { resetSimulation(); void recomputeOutage([]); }}
              className="px-4 py-1.5 bg-danger text-white text-xs font-bold rounded-btn hover:bg-danger-dark transition-all shrink-0"
            >
              Restore all resources in the simulation plan
            </button>
          </div>
        )}

        {/* Value Unlocked Split Comparison Slider (ซื้อเอง vs ใช้ร่วม) */}
        <div className="bg-white rounded-card p-5 border border-borderLine shadow-soft-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-display font-bold text-xs uppercase tracking-wider text-ink flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-resource-dark" />
                <span>Value Unlocked Comparison</span>
              </h3>
              <p className="text-[11px] text-ink-muted">
                Purchase quotes and actual usage hours are required to compare buying vs. sharing ·
                The backend does not store these values yet.
              </p>
            </div>
            <DataKindBadge kind="simulated" size="sm" />
          </div>

          {/* Side-by-Side Split View */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Column A: Buy Individually */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block">
                Previous approach: Each shop buys its own equipment
              </span>
              <div className="text-2xl font-extrabold font-mono text-ink">No data</div>
              <p className="text-[11px] text-ink-muted leading-relaxed">
                A purchase quote for this shop (investment_cash_schedule) is required to calculate total investment.
              </p>
              <div className="text-[10px] text-danger font-medium mt-2">
                ✕ No purchase price evidence in the system
              </div>
            </div>

            {/* Column B: Shared Opportunity via SME UNLOCK */}
            <div className="p-4 rounded-xl bg-resource-light/60 border border-resource/40 space-y-2">
              <span className="text-[10px] font-bold text-resource-dark uppercase tracking-wider block">
                New approach: Share resources through SME UNLOCK
              </span>
              <div className="text-2xl font-extrabold font-mono text-resource-dark">No data</div>
              <p className="text-[11px] text-ink-muted leading-relaxed">
                {allResources.length} resources are available for sharing · Each service rate is shown on its card below,
                but verified usage hours are not available for a combined total.
              </p>
              <div className="text-[11px] text-resource-dark font-bold mt-2 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Savings: Cannot calculate yet</span>
              </div>
            </div>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          {[
            { id: "all", label: `All (${allResources.length})` },
            { id: "kitchen", label: "🍳 Shared kitchens" },
            { id: "truck", label: "🚚 Refrigerated vehicles" },
            { id: "machine", label: "⚙️ Packaging equipment" },
            { id: "team", label: "👥 Temporary staff" },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-chip font-medium whitespace-nowrap transition-all ${
                activeCategory === cat.id
                  ? "bg-resource text-white shadow-xs font-bold"
                  : "bg-white border border-borderLine text-ink hover:border-resource"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Resources Grid with Detach Buttons (Signature S5) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredResources.map((res) => {
            const isDetached = detachedResourceIds.includes(res.id);
            return (
              <ResourceTile
                key={res.id}
                resource={res}
                dataKind={resourcesEnvelope.kind}
                isDetached={isDetached}
                onToggleDetach={() => handleToggleDetach(res)}
              />
            );
          })}
        </div>
      </div>
    </StateRenderer>
  );
};
