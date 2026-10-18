import React, { useState, useEffect, useRef } from "react";
import { useAppStore } from "@/store/useAppStore";
import { apiClient, OrderContext, OrderComparison, OrderScenario } from "@/api/client";
import { ChaosScenario, Envelope, SavedSimulationSummary } from "@/api/contracts/types";
import { ChaosPlayback } from "./ChaosPlayback";
import { DataKindBadge } from "@/components/signature/DataKindBadge";
import { StateRenderer } from "@/components/ui/StateRenderer";
import {
  Sliders,
  RotateCcw,
  Save,
  Copy,
  TrendingDown,
  TrendingUp,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";

export const SimulatorPage: React.FC = () => {
  const {
    resetSimulation,
    addToast,
  } = useAppStore();

  const [chaosEnvelope, setChaosEnvelope] = useState<Envelope<ChaosScenario[]> | null>(null);
  // Declared by the backend: arbitrary narrative chaos effects are not
  // implemented, so the playback is presented as a stored catalogue reading.
  const [chaosEffects, setChaosEffects] = useState<{ available: boolean; reason: string }>({
    available: false,
    reason: "Backend capabilities are unknown.",
  });
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("chaos-shop-dropout");
  const [loading, setLoading] = useState(true);

  const [context, setContext] = useState<OrderContext | null>(null);
  // Scope for saved plans. A saved read, list or replay without this is refused
  // with HTTP 422, and a wrong project answers 404.
  const [scope, setScope] = useState<{ projectId: string | null; orderRef: string | null }>({ projectId: null, orderRef: null });
  const [savedPlans, setSavedPlans] = useState<SavedSimulationSummary[] | null>(null);
  const [savedNote, setSavedNote] = useState("");
  const [comparison, setComparison] = useState<OrderComparison | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [simUnitPrice, setSimUnitPrice] = useState("");
  const [simCostPerUnit, setSimCostPerUnit] = useState("");
  const [simDepositPercent, setSimDepositPercent] = useState("");
  const [simCreditTermDays, setSimCreditTermDays] = useState("");
  const sequence = useRef(0);
  const busySave = useRef(false);
  const percentRatio = (value: string) => {
    if (!/^\d+(\.\d{1,4})?$/.test(value)) return "invalid_percent";
    const [whole, fraction = ""] = value.split(".");
    return `${whole.length > 2 ? whole.slice(0, -2) : "0"}.${whole.padStart(2, "0").slice(-2)}${fraction}`;
  };
  const amount = (value: number | string | null | undefined) => value == null ? "No data" : Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 });
  const setBaseline = (value: OrderContext) => {
    setSimUnitPrice(value.unit_price);
    // Blank means preserve each shop's actual cost; never impose an average.
    setSimCostPerUnit("");
    setSimDepositPercent(String(Number((Number(value.deposit_ratio) * 100).toFixed(4))));
    setSimCreditTermDays(String(value.payment_terms_days));
  };
  const loadData = () => {
    setLoading(true); setError("");
    if (apiClient.isDemoMode()) {
      apiClient.getChaosScenarios().then((value) => {
        setChaosEnvelope(value);
        setError("Demo mode: set VITE_USE_MOCK=false and connect the backend before calculating or saving a plan.");
      }).catch((err) => setError(err.message)).finally(() => setLoading(false));
      return;
    }
    Promise.all([apiClient.getChaosScenarios(), apiClient.getOrderContext()])
      .then(async ([chaos, value]) => {
        setChaosEnvelope(chaos); setContext(value.data); setBaseline(value.data);
        const next = { projectId: value.projectId, orderRef: value.orderRef };
        setScope(next);
        await refreshSavedPlans(next);
        const declared = await apiClient.getCapabilities()
          .then((res) => res.data.arbitraryChaosEffects)
          .catch(() => null);
        setChaosEffects({
          available: declared?.available === true,
          reason: declared?.reason || "The backend has not declared support for narrative effects.",
        });
        setLoading(false);
      }).catch((err) => { setError(err.message); setLoading(false); });
  };
  useEffect(loadData, []);
  const scenario: OrderScenario = {
    unit_price: simUnitPrice,
    cost_per_unit: simCostPerUnit === "" ? null : simCostPerUnit,
    deposit_ratio: percentRatio(simDepositPercent),
    payment_terms_days: simCreditTermDays === "" ? NaN : Number(simCreditTermDays),
  };
  useEffect(() => {
    if (!context) return;
    const id = ++sequence.current;
    setPending(true); setError(""); setComparison(null);
    const timer = setTimeout(() => {
      apiClient.simulateOrder(context, scenario)
        .then((res) => { if (sequence.current === id) setComparison(res); })
        .catch((err) => { if (sequence.current === id) setError(err.message); })
        .finally(() => { if (sequence.current === id) setPending(false); });
    }, 300);
    return () => { clearTimeout(timer); ++sequence.current; };
  }, [context, simUnitPrice, simCostPerUnit, simDepositPercent, simCreditTermDays]);
  // Scoped read of the plans already stored for this project or order.
  const refreshSavedPlans = async (next: { projectId: string | null; orderRef: string | null }) => {
    if (!next.projectId && !next.orderRef) { setSavedPlans(null); setSavedNote("Project or order is unknown, so saved plans cannot be loaded."); return; }
    try {
      const list = await apiClient.listSimulations(next, 20);
      setSavedPlans(list.data);
      const replayable = list.data.filter((plan) => plan.replayAvailable).length;
      setSavedNote(list.data.length
        ? `${list.data.length} saved plans · ${replayable} replayable`
        : "No saved plans for this project.");
    } catch (err) { setSavedPlans(null); setSavedNote(`Could not load saved plans: ${(err as Error).message}`); }
  };
  const handleReset = () => { if (context) setBaseline(context); resetSimulation(); };
  const handleSave = async () => {
    if (!context || !comparison || pending || busySave.current) return; // No double submit.
    busySave.current = true; setSaving(true);
    try {
      const result = await apiClient.simulateOrder(context, scenario, true);
      if (!result.persisted || !result.simulationId) throw new Error("Could not save the plan. Check the database connection.");
      const simulationId = result.simulationId;
      // Read the stored row back in the same scope before reporting success.
      const stored = await apiClient.readSimulation(simulationId, scope);
      if (!stored.data?.resultHash || !stored.data.request || !stored.data.results) {
        throw new Error("The plan was saved, but the read-back was incomplete. Save is not confirmed.");
      }
      // Replay the saved snapshot to prove the stored plan reproduces.
      const replay = await apiClient.replaySimulation(simulationId, { ...scope, inputRevision: result.context?.inputRevision ?? null });
      const differences = replay.data.contextDifferences || [];
      await refreshSavedPlans(scope);
      addToast({
        type: replay.data.reproduced && !differences.length ? "success" : "warning",
        title: replay.data.reproduced ? "Saved and verified" : "Saved, but replay differs",
        message: `Simulation ID: ${simulationId} · Engine ${stored.data.engine || "Unknown"}`
          + ` · resultHash ${stored.data.resultHash.slice(0, 12)}…`
          + ` · Replay ${replay.data.reproduced ? "matches" : "does not match"}`
          + (differences.length ? ` · Context differences: ${differences.join(", ")}` : ""),
        duration: 12000,
      });
    } catch (err) { addToast({ type: "error", title: "Save failed", message: (err as Error).message, duration: 10000 }); }
    finally { busySave.current = false; setSaving(false); }
  };
  if (!loading && !context && error && !apiClient.isDemoMode()) return <StateRenderer currentMode="error" errorMessage={error} onRetry={loadData}>{null}</StateRenderer>;
  const simProfit = comparison?.data.planB.totalProfit;
  const simFundingGap = comparison?.data.planB.totalFundingGap;
  const simMinCash = comparison?.data.planB.minimumShopCash;

  if (loading || !chaosEnvelope) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="h-40 bg-slate-200 rounded-card animate-pulse" />
        <div className="h-96 bg-slate-200 rounded-card animate-pulse" />
      </div>
    );
  }

  return (
    <StateRenderer onRetry={loadData}>
      <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6 text-ink animate-fade-in">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-borderLine pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-display font-bold text-ink">
                Business Simulation & Chaos Rehearsal
              </h1>
              <DataKindBadge kind="simulated" size="md" />
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              Change price, deposit, and cost assumptions, and rehearse crisis scenarios without affecting live data.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 bg-white border border-borderLine hover:border-brand/40 text-xs font-semibold rounded-btn flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-ink-muted" />
              <span>Reset</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={pending || saving || !comparison}
              className="px-4 py-1.5 bg-brand hover:bg-brand-dark text-white text-xs font-bold rounded-btn flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save new simulation plan</span>
            </button>
          </div>
        </div>

        {/* Signature S6: Chaos Rehearsal Playback Component */}
        <ChaosPlayback
          scenarios={chaosEnvelope.data}
          selectedScenarioId={selectedScenarioId}
          onSelectScenario={(id) => setSelectedScenarioId(id)}
          source={chaosEnvelope.source}
          effectsAvailable={chaosEffects.available}
          effectsReason={chaosEffects.reason}
        />

        {/* Side-by-Side Comparison: แผนเดิม (Plan A) vs แผนจำลอง (Plan B) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Simulation Controls (Left 6 Cols) */}
          <div className="lg:col-span-6 bg-white p-5 rounded-card border border-borderLine shadow-soft-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-display font-bold text-xs uppercase tracking-wider text-ink flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-brand" />
                <span>Assumption controls (slider and input)</span>
              </h3>
              <DataKindBadge kind="simulated" size="sm" />
            </div>

            {/* 1. Deposit Percent */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-ink">Buyer deposit (%)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.0001"
                  value={simDepositPercent}
                  onChange={(e) => setSimDepositPercent(e.target.value)}
                  className="w-20 px-2 py-0.5 border border-slate-200 rounded text-right font-mono text-xs font-bold"
                />
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="0.0001"
                value={simDepositPercent || "0"}
                onChange={(e) => setSimDepositPercent(e.target.value)}
                className="w-full accent-brand cursor-pointer"
              />
            </div>

            {/* 2. Selling Price per Box */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-ink">Selling price per meal box (฿)</span>
                <input
                  type="number"
                  min="0"
                  max="1000"
                  step="0.01"
                  value={simUnitPrice}
                  onChange={(e) => setSimUnitPrice(e.target.value)}
                  className="w-20 px-2 py-0.5 border border-slate-200 rounded text-right font-mono text-xs font-bold"
                />
              </div>
              <input
                type="range"
                min="0"
                max="1000"
                step="0.01"
                value={simUnitPrice || "0"}
                onChange={(e) => setSimUnitPrice(e.target.value)}
                className="w-full accent-brand cursor-pointer"
              />
            </div>

            {/* 3. Cost per Box */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-ink">Ingredient and production cost per box (฿)</span>
                <input
                  type="number"
                  min="0"
                  max="1000"
                  step="0.01"
                  placeholder="Original cost"
                  value={simCostPerUnit}
                  onChange={(e) => setSimCostPerUnit(e.target.value)}
                  className="w-20 px-2 py-0.5 border border-slate-200 rounded text-right font-mono text-xs font-bold"
                />
              </div>
              <input
                type="range"
                min="0"
                max="1000"
                step="0.01"
                placeholder="Original cost"
                title="Set the same cost for every shop"
                value={simCostPerUnit === "" ? context?.shops[0]?.cost_per_unit || "0" : simCostPerUnit}
                onChange={(e) => setSimCostPerUnit(e.target.value)}
                className="w-full accent-brand cursor-pointer"
              />
            </div>

            {/* 4. Payment Terms Days */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-ink">Payment terms for the final installment (days)</span>
                <input
                  type="number"
                  min="0"
                  max="365"
                  value={simCreditTermDays}
                  onChange={(e) => setSimCreditTermDays(e.target.value)}
                  className="w-20 px-2 py-0.5 border border-slate-200 rounded text-right font-mono text-xs font-bold"
                />
              </div>
              <input
                type="range"
                min="0"
                max="365"
                step="1"
                value={simCreditTermDays || "0"}
                onChange={(e) => setSimCreditTermDays(e.target.value)}
                className="w-full accent-brand cursor-pointer"
              />
            </div>
          </div>

          {/* Before-After Results Comparison Table (Right 6 Cols) */}
          <div className="lg:col-span-6 bg-white p-5 rounded-card border border-borderLine shadow-soft-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-display font-bold text-xs uppercase tracking-wider text-ink">
                Compare results: Plan A (baseline) vs. Plan B (simulation)
              </h3>
              <span className="text-[11px] text-ink-muted">
                {context?.order_ref || "Demo mode"} · This order only
                {savedNote ? ` · ${savedNote}` : ""}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              {/* Row 1: Net Profit */}
              <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-ink block">Order profit before other expenses</span>
                  <span className="text-[10px] text-ink-muted">Revenue minus total costs</span>
                </div>
                <div className="flex items-center gap-4 font-mono text-right">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Baseline Plan A</span>
                    <span className="font-bold text-ink">฿{amount(comparison?.data.planA.totalProfit)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-brand block">Simulated Plan B</span>
                    <span className="font-extrabold text-brand">฿{amount(simProfit)}</span>
                  </div>
                </div>
              </div>

              {/* Row 2: Minimum Cash Balance */}
              <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-ink block">Lowest cash balance among participating shops</span>
                  <span className="text-[10px] text-ink-muted">Cash flow for this order only</span>
                </div>
                <div className="flex items-center gap-4 font-mono text-right">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Baseline Plan A</span>
                    <span className="font-bold text-danger">฿{amount(comparison?.data.planA.minimumShopCash)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-brand block">Simulated Plan B</span>
                    <span className={`font-extrabold ${Number(simMinCash) < 0 ? "text-danger" : "text-emerald-700"}`}>
                      ฿{amount(simMinCash)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Row 3: Funding Gap */}
              <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-ink block">Remaining working-capital gap</span>
                  <span className="text-[10px] text-ink-muted">Amount to borrow or add</span>
                </div>
                <div className="flex items-center gap-4 font-mono text-right">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Baseline Plan A</span>
                    <span className="font-bold text-danger">฿{amount(comparison?.data.planA.totalFundingGap)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-brand block">Simulated Plan B</span>
                    <span className="font-extrabold text-emerald-700">
                      ฿{amount(simFundingGap)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Insight Callout */}
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 leading-relaxed">
              <strong>Simulation summary:</strong> {pending ? "Calculating with the backend…" : error || (comparison ? `Funding gap: ฿${amount(simFundingGap)} · Remaining capacity shortfall: ${amount(comparison.data.planB.deficitBoxesPerDay)} per day · Order only; excludes other business cash flows.` : "No calculation results yet.")}
            </div>
          </div>
        </div>
      </div>
    </StateRenderer>
  );
};
