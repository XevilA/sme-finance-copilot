import React, { useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import { apiClient } from "@/api/client";
import { ProductSales, ChannelSales, Envelope } from "@/api/contracts/types";
import { envelopeMode, useAnalysisContext, useEnvelope } from "@/hooks/useEnvelope";
import { DataKindBadge } from "@/components/signature/DataKindBadge";
import { StateRenderer } from "@/components/ui/StateRenderer";
import {
  ShoppingBag,
  TrendingUp,
  Coins,
  Store,
  Flame,
  Clock,
  Sparkles,
  ArrowRight,
} from "lucide-react";

export const SalesPage: React.FC = () => {
  const { setCurrentPage } = useAppStore();
  const { accepted, stale } = useAnalysisContext();
  const productState = useEnvelope<ProductSales[]>(useCallback(() => apiClient.getProductSales(), []));
  const channelState = useEnvelope<ChannelSales[]>(useCallback(() => apiClient.getChannelSales(), []));
  const productsEnvelope = productState.envelope;
  const channelsEnvelope = channelState.envelope;
  const loading = productState.loading || channelState.loading;
  const error = productState.error || channelState.error;
  const loadData = () => { productState.reload(); channelState.reload(); };
  const productMode = envelopeMode(productState, (rows) => rows.length === 0);
  const channelMode = envelopeMode(channelState, (rows) => rows.length === 0);

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="h-40 bg-slate-200 rounded-card animate-pulse" />
        <div className="h-80 bg-slate-200 rounded-card animate-pulse" />
      </div>
    );
  }

  const products = productsEnvelope?.data || [];
  const channels = channelsEnvelope?.data || [];
  const reportedTotals = [
    { field: "revenue", label: "Revenue for period", unit: "THB" },
    { field: "cost_of_goods_sold", label: "Cost of goods sold", unit: "THB" },
    { field: "total_expenses", label: "Total expenses", unit: "THB" },
    { field: "net_income", label: "Net income", unit: "THB" },
    { field: "units_sold", label: "Units sold", unit: "units" },
  ].flatMap((item) => {
    const raw = accepted?.input?.[item.field];
    if (raw == null || raw === "") return [];
    const value = Number(raw);
    return Number.isFinite(value) ? [{ ...item, value }] : [];
  });

  // A product or channel breakdown needs catalogue rows. An imported statement
  // only carries period totals, so neither split is reconstructed from them.
  if (!productsEnvelope || !channelsEnvelope || productMode === "error" || channelMode === "error"
    || (productMode === "unavailable" && channelMode === "unavailable")
    || (products.length === 0 && channels.length === 0)) {
    const unavailable = productMode === "unavailable" || channelMode === "unavailable";
    const unavailableState = (
      <StateRenderer
        currentMode={error ? "error" : unavailable ? "unavailable" : "insufficient_data"}
        errorMessage={error || "Could not load product and channel sales from the backend"}
        unavailableReason={accepted
          ? "This statement has period totals only. Product and channel records are needed for a breakdown; importing the same summary again will not create those details."
          : "No products or sales channels have been recorded."}
        missingItems={[...(productsEnvelope?.missing || []), ...(channelsEnvelope?.missing || [])]}
        onRetry={loadData}
        onAddData={accepted ? undefined : () => setCurrentPage("import")}
      >
        {null}
      </StateRenderer>
    );
    if (!accepted) return unavailableState;

    return (
      <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-5 text-ink animate-fade-in">
        <div className="border-b border-borderLine pb-4">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-display font-bold text-ink">Sales & Products (Sales & Channel Profitability)</h1>
            <DataKindBadge kind={accepted.input.kind} size="md" />
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Statement period: {accepted.input.period_start} – {accepted.input.period_end}. Totals below are reported values; no product or channel split is inferred.
          </p>
        </div>
        {reportedTotals.length > 0 && (
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3" aria-label="Reported sales totals">
            {reportedTotals.map((item) => (
              <div key={item.field} className="p-4 rounded-card bg-white border border-borderLine">
                <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">{item.label}</span>
                <div className="mt-2 text-lg font-bold font-mono tabular-nums">
                  {item.unit === "THB" ? "฿" : ""}{item.value.toLocaleString("en-US", { maximumFractionDigits: 2 })}{item.unit === "units" ? " units" : ""}
                </div>
                <span className="text-[10px] text-ink-muted">Reported in the imported statement</span>
              </div>
            ))}
          </section>
        )}
        {unavailableState}
      </div>
    );
  }

  return (
    <StateRenderer currentMode={stale ? "stale" : undefined} onRetry={loadData} onReanalyze={() => setCurrentPage("import")}>
      <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6 text-ink animate-fade-in">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-borderLine pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-brand text-white flex items-center justify-center font-bold">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <h1 className="text-xl font-display font-bold text-ink">
                Sales & Products (Sales & Channel Profitability)
              </h1>
              <DataKindBadge kind="actual" size="md" />
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              Separate actual sales and profit; compare delivery channels with corporate catering.
            </p>
          </div>
        </div>

        {/* Section: Channel Net Margin Reality Check (B2B vs Delivery App GP Fee) */}
        <div className="bg-white rounded-card p-5 border border-borderLine shadow-soft-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <h3 className="font-display font-bold text-xs uppercase tracking-wider text-ink">
                Net profit by sales channel (after platform commissions, delivery, and advertising)
              </h3>
              <p className="text-[11px] text-ink-muted">
                Compare actual net profit from corporate catering with sales through delivery apps.
              </p>
            </div>
            <DataKindBadge kind="actual" size="sm" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {channels.map((ch, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs"
              >
                <div className="font-bold text-ink leading-tight">{ch.channel}</div>
                <div className="flex items-baseline justify-between border-b border-slate-200 pb-2">
                  <span className="text-ink-muted">Gross sales:</span>
                  <span className="font-bold font-mono text-ink">฿{ch.grossSales.toLocaleString()}</span>
                </div>

                <div className="space-y-1 text-[11px] text-ink-muted">
                  <div className="flex justify-between">
                    <span>Platform commission:</span>
                    <span className="text-danger font-mono">-฿{ch.commissionFee.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Delivery / advertising:</span>
                    <span className="font-mono">-฿{(ch.adCost + ch.deliveryCost).toLocaleString()}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-brand">Net profit:</span>
                  <div className="text-right">
                    <span className="font-extrabold font-mono text-brand block">
                      ฿{ch.netProfit.toLocaleString()}
                    </span>
                    <span className={`text-[10px] font-bold ${ch.netMarginPercent > 20 ? "text-emerald-700" : "text-amber-800"}`}>
                      Margin {ch.netMarginPercent}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Product sales table separates revenue from profit. */}
        <div className="bg-white rounded-card p-5 border border-borderLine shadow-soft-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-xs uppercase tracking-wider text-ink">
              Product Performance (Best Sellers & Margin Leaders)
            </h3>
            <span className="text-xs text-ink-muted">4 key items</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-ink-muted">
                  <th className="py-2">Product</th>
                  <th className="py-2">Category</th>
                  <th className="py-2 text-right">Units sold</th>
                  <th className="py-2 text-right">Revenue</th>
                  <th className="py-2 text-right">Net profit</th>
                  <th className="py-2 text-right">Margin (%)</th>
                  <th className="py-2 text-center">Sales velocity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-3 font-sans font-bold text-ink">{p.name}</td>
                    <td className="py-3 font-sans text-ink-muted">{p.category}</td>
                    <td className="py-3 text-right font-bold text-ink">{p.unitsSold}</td>
                    <td className="py-3 text-right font-bold text-ink">฿{p.revenue.toLocaleString()}</td>
                    <td className="py-3 text-right font-extrabold text-brand">฿{p.profit.toLocaleString()}</td>
                    <td className="py-3 text-right font-bold text-emerald-700">{p.profitMarginPercent}%</td>
                    <td className="py-3 text-center">
                      <span
                        className={`font-sans text-[10px] font-bold px-2 py-0.5 rounded-chip ${
                          p.velocity === "fast"
                            ? "bg-emerald-50 text-emerald-700"
                            : p.velocity === "normal"
                            ? "bg-slate-100 text-slate-700"
                            : "bg-amber-50 text-amber-800"
                        }`}
                      >
                        {p.velocity === "fast" ? "🔥 Best seller" : p.velocity === "normal" ? "Normal" : "🐢 Slow-moving"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </StateRenderer>
  );
};
