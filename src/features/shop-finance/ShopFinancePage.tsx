import React, { useCallback, useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { apiClient } from "@/api/client";
import { Shop, ShopFinance } from "@/api/contracts/types";
import { envelopeMode, useEnvelope } from "@/hooks/useEnvelope";
import { useCapabilities } from "@/hooks/useCapabilities";
import { DataKindBadge } from "@/components/signature/DataKindBadge";
import { StateRenderer } from "@/components/ui/StateRenderer";
import {
  Users,
  Coins,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  FileCheck,
  ShieldCheck,
  Building,
} from "lucide-react";

export const ShopFinancePage: React.FC = () => {
  const { selectedShopId, setSelectedShopId, setCurrentPage, addToast } = useAppStore();
  // The switcher lists the shops the backend actually has, with their real
  // UUIDs. Placeholder identifiers cannot be used to read a stored record.
  const shopsState = useEnvelope<Shop[]>(useCallback(() => apiClient.getShops(), []));
  const shops = shopsState.envelope?.data || [];
  const activeShopId = selectedShopId || shops[0]?.id || "";
  // Adopt the first real shop once the catalogue arrives, so the selection is a
  // UUID the backend can read rather than an empty or placeholder identifier.
  const firstShopId = shops[0]?.id;
  useEffect(() => {
    if (!selectedShopId && firstShopId) setSelectedShopId(firstShopId);
  }, [selectedShopId, firstShopId, setSelectedShopId]);
  const financeState = useEnvelope<ShopFinance | null>(useCallback(
    () => (activeShopId ? apiClient.getShopFinance(activeShopId) : Promise.reject(new Error("No shop has been selected."))),
    [activeShopId]), [activeShopId]);
  const capabilityState = useCapabilities();
  const canSign = capabilityState.isAvailable("agreementSignature");
  const signBlockedReason = capabilityState.reasonFor("agreementSignature", "The backend does not support agreement signing.");
  const finance = financeState.envelope?.data || null;
  const loading = shopsState.loading || financeState.loading;
  const error = shopsState.error || financeState.error;
  const loadData = () => { shopsState.reload(); financeState.reload(); };
  const mode = envelopeMode(financeState, (data) => data == null);
  const amount = (value: number | null | undefined) =>
    value == null ? "No data" : `฿${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  // Stored acceptance flags. The page shows what is recorded and never signs.
  const parties = finance?.partyAcceptance;

  const handleSignAgreement = () => {
    // /capabilities declares agreementSignature unavailable: there is no actor,
    // no persisted signature and no status transition behind this button.
    addToast({
      type: "warning",
      title: "Live signing is unavailable",
      message: `${signBlockedReason} · The status shown is read from the database; this page does not sign agreements.`,
      duration: 9000,
    });
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="h-40 bg-slate-200 rounded-card animate-pulse" />
        <div className="h-96 bg-slate-200 rounded-card animate-pulse" />
      </div>
    );
  }

  if (!finance || mode === "error" || mode === "unavailable" || mode === "insufficient_data") {
    return (
      <StateRenderer
        currentMode={mode === "error" ? "error" : "unavailable"}
        errorMessage={error || "Could not load the shop financial plan from the backend."}
        unavailableReason={shops.length
          ? "No financial plan is saved for the selected shop."
          : "There are no shops in the database to select."}
        missingItems={[...(shopsState.envelope?.missing || []), ...(financeState.envelope?.missing || [])]}
        onRetry={loadData}
        onAddData={() => setCurrentPage("swarm")}
      >
        {null}
      </StateRenderer>
    );
  }

  const isShortage = finance.fundingGap > 0;

  return (
    <StateRenderer onRetry={loadData}>
      <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6 text-ink animate-fade-in">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-borderLine pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-display font-bold text-ink">
                Team Shop Financial Plan
              </h1>
              <DataKindBadge kind={financeState.envelope?.kind ?? "forecast"} size="md" />
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              Review cash flow and shortfall dates, and track four-party agreement acceptance.
            </p>
          </div>

          {/* Shop Switcher Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            {shops.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedShopId(s.id)}
                className={`px-3 py-1 rounded-chip text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedShopId === s.id
                    ? "bg-brand text-white shadow-xs"
                    : "bg-white border border-borderLine text-ink hover:border-brand/40"
                }`}
              >
                {s.fundingGap > 0 ? `${s.name} (shortfall ${amount(s.fundingGap)})` : s.name}
              </button>
            ))}
          </div>
        </div>

        {/* Essential Headline Callout: 'รับงานเพิ่มแล้วเหลือเงินเพิ่มจริงไหม' (Rule D & G10) */}
        <div className="p-5 rounded-card bg-gradient-to-r from-brand/5 via-white to-emerald-50/50 border border-brand/20 space-y-2 shadow-soft-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-display font-bold text-ink flex items-center gap-2">
              <Coins className="w-4 h-4 text-brand" />
              <span>Will taking this order leave more cash? (Profit vs. cash)</span>
            </h2>
            <DataKindBadge kind={financeState.envelope?.kind ?? "forecast"} size="sm" />
          </div>
          <p className="text-xs text-ink-muted leading-relaxed">
            For <strong>{finance.name}</strong>, at a capacity of {finance.boxesPerDay} {finance.totalBoxes ? `per day (${finance.totalBoxes} total)` : "per day"}:
            total revenue is <strong>{amount(finance.revenue)}</strong>, less total costs of{" "}
            <strong>{amount(finance.totalCost)}</strong>, leaving projected order profit before other expenses of{" "}
            <strong>{amount(finance.projectedProfit)}</strong> ({finance.profitMarginPercent}% margin) ·{" "}
            <strong>projected minimum cash balance: {amount(finance.minCashBalance)}</strong>
            {finance.minCashBalance < 0
              ? " Additional working capital is needed before the order starts."
              : " Cash does not go negative in this schedule; other business obligations are excluded."}
          </p>
        </div>

        {/* Financial Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3 bg-white rounded-card border border-borderLine">
            <span className="text-[10px] text-ink-muted block">Order capacity</span>
            <span className="text-sm font-bold font-mono text-ink">
              {finance.boxesPerDay} boxes/day
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">{finance.totalBoxes} boxes total</span>
          </div>

          <div className="p-3 bg-white rounded-card border border-borderLine">
            <span className="text-[10px] text-ink-muted block">Total revenue</span>
            <span className="text-sm font-bold font-mono text-ink">
              ฿{finance.revenue.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">@ ฿{finance.sellingPricePerBox}/box</span>
          </div>

          <div className="p-3 bg-white rounded-card border border-borderLine">
            <span className="text-[10px] text-ink-muted block">Total cost</span>
            <span className="text-sm font-bold font-mono text-ink">
              ฿{finance.totalCost.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Materials + labor + delivery</span>
          </div>

          <div className="p-3 bg-white rounded-card border border-brand/30 bg-brand/5">
            <span className="text-[10px] font-bold text-brand block">Projected net profit</span>
            <span className="text-sm font-extrabold font-mono text-brand">
              ฿{finance.projectedProfit.toLocaleString()}
            </span>
            <span className="text-[10px] text-brand/80 block mt-0.5">Margin {finance.profitMarginPercent}%</span>
          </div>

          <div className="p-3 bg-white rounded-card border border-borderLine">
            <span className="text-[10px] text-ink-muted block">Upfront cash required</span>
            <span className="text-sm font-bold font-mono text-ink">
              ฿{finance.upfrontCashNeeded.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Fresh ingredient deposit · Day 1</span>
          </div>

          <div className={`p-3 rounded-card border ${isShortage ? "bg-red-50 border-danger" : "bg-emerald-50 border-emerald-300"}`}>
            <span className={`text-[10px] font-bold block ${isShortage ? "text-danger" : "text-emerald-800"}`}>
              {isShortage ? "Funding shortfall" : "Liquidity"}
            </span>
            <span className={`text-sm font-extrabold font-mono ${isShortage ? "text-danger" : "text-emerald-700"}`}>
              {isShortage ? `Short ฿${finance.fundingGap.toLocaleString("en-US")}` : "Sufficient"}
            </span>
            {isShortage && (
              <button
                type="button"
                onClick={() => setCurrentPage("funding", { shopId: finance.shopId })}
                className="text-[10px] font-bold text-danger underline block mt-0.5"
              >
                Find funding for this shop →
              </button>
            )}
          </div>
        </div>

        {/* Cost Itemization Table */}
        <div className="bg-white rounded-card border border-borderLine p-4 space-y-3">
          <h3 className="text-xs font-display font-bold text-ink uppercase tracking-wider">
            Cost breakdown per shop
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 bg-slate-50 rounded-xl">
              <span className="text-ink-muted block text-[10px]">Fresh materials</span>
              <span className="font-bold text-ink font-mono">฿{finance.rawMaterialCost.toLocaleString()}</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl">
              <span className="text-ink-muted block text-[10px]">Additional labor</span>
              <span className="font-bold text-ink font-mono">฿{finance.additionalLaborCost.toLocaleString()}</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl">
              <span className="text-ink-muted block text-[10px]">Temperature-controlled delivery</span>
              <span className="font-bold text-ink font-mono">฿{finance.deliveryCost.toLocaleString()}</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl">
              <span className="text-ink-muted block text-[10px]">SWARM service fee</span>
              <span className="font-bold text-ink font-mono">฿{finance.serviceFee.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Cashflow Timeline Events */}
        <div className="bg-white rounded-card border border-borderLine p-4 space-y-3">
          <h3 className="text-xs font-display font-bold text-ink uppercase tracking-wider flex items-center justify-between">
            <span>Shop cash timeline (Purchase → Production → Delivery → Payment)</span>
            <DataKindBadge kind={financeState.envelope?.kind ?? "forecast"} size="sm" />
          </h3>

          <div className="space-y-2">
            {finance.cashTimeline.map((item, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-brand bg-brand/10 px-2 py-0.5 rounded text-[11px]">
                    {item.date}
                  </span>
                  <div>
                    <div className="font-semibold text-ink">{item.title}</div>
                    <div className="text-[11px] text-ink-muted">{item.note}</div>
                  </div>
                </div>

                <div className="text-right">
                  <div
                    className={`font-mono font-bold text-xs ${
                      item.amount > 0 ? "text-emerald-700" : item.amount < 0 ? "text-danger" : "text-slate-500"
                    }`}
                  >
                    {item.amount > 0 ? "+" : ""}{item.amount !== 0 ? `฿${item.amount.toLocaleString("en-US")}` : "Delivered"}
                  </div>
                  <div className="text-[10px] text-ink-muted font-mono">
                    Cash balance: ฿{item.cashBalance.toLocaleString("en-US")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4-Party Agreement Sign-off Box */}
        <div className="p-5 rounded-card bg-white border border-borderLine space-y-4 shadow-soft-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-display font-bold text-ink uppercase tracking-wider">
                Four-party agreement acceptance before work begins
              </h3>
              <p className="text-[11px] text-ink-muted">
                Confirm pricing, allocation, standards, delivery dates, and payment terms.
              </p>
            </div>
            <DataKindBadge kind={financeState.envelope?.kind ?? "actual"} size="sm" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
              <span className="text-[10px] text-slate-400 block">1. Buyer</span>
              <div className="font-bold text-ink">
                {parties?.buyerSigned ? "Buyer name not recorded" : "Buyer acceptance not recorded"}
              </div>
              {parties?.buyerSigned && (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-semibold">
                  <CheckCircle2 className="w-3 h-3" /> Acceptance recorded
                </span>
              )}
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
              <span className="text-[10px] text-slate-400 block">2. Logistics</span>
              <div className="font-bold text-ink">
                {parties?.logisticsSigned ? "Delivery provider not recorded" : "Logistics acceptance not recorded"}
              </div>
              {parties?.logisticsSigned && (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-semibold">
                  <CheckCircle2 className="w-3 h-3" /> Acceptance recorded
                </span>
              )}
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
              <span className="text-[10px] text-slate-400 block">3. Shop</span>
              <div className="font-bold text-ink">{finance.name}</div>
              {parties?.shopSigned ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-semibold">
                  <CheckCircle2 className="w-3 h-3" /> Acceptance recorded
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 font-semibold">
                  <AlertTriangle className="w-3 h-3" /> Acceptance not recorded
                </span>
              )}
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
              <span className="text-[10px] text-slate-400 block">4. Funder</span>
              <div className="font-bold text-ink">Funder not recorded</div>
              {parties?.funderSigned ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-semibold">
                  <CheckCircle2 className="w-3 h-3" /> Acceptance recorded
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                  Acceptance not recorded
                </span>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-ink-muted">
              {canSign
                ? "Changes to a shop or key terms always create a new agreement for review and acceptance."
                : `Status above is read from saved records · ${signBlockedReason}`}
            </span>
            <button
              type="button"
              onClick={handleSignAgreement}
              disabled={!canSign}
              title={canSign ? undefined : signBlockedReason}
              className="px-5 py-2 bg-brand hover:bg-brand-dark disabled:opacity-50 text-white rounded-btn text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
            >
              <FileCheck className="w-4 h-4" />
              <span>{canSign ? "Accept this plan" : "Signing is unavailable"}</span>
            </button>
          </div>
        </div>
      </div>
    </StateRenderer>
  );
};
