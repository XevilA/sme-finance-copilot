import React, { useCallback, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { apiClient } from "@/api/client";
import { ProductSales, ChannelSales, Envelope, SalesPreviewInput, SalesPreviewResult } from "@/api/contracts/types";
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

type ProductDraft = { name: string; category: string; unitsSold: string; revenue: string; cost: string; turnoverDays: string };

export const SalesPage: React.FC = () => {
  const { setCurrentPage } = useAppStore();
  const { accepted, stale } = useAnalysisContext();
  const [productRows, setProductRows] = useState<ProductDraft[]>([
    { name: "", category: "", unitsSold: "", revenue: "", cost: "", turnoverDays: "" },
  ]);
  const [channelRows, setChannelRows] = useState<SalesPreviewInput["channels"]>([
    { channel: "", grossSales: "", commissionFee: "", adCost: "", deliveryCost: "" },
  ]);
  const [salesPreview, setSalesPreview] = useState<SalesPreviewResult | null>(null);
  const [salesPreviewError, setSalesPreviewError] = useState("");
  const [salesPreviewLoading, setSalesPreviewLoading] = useState(false);
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
    return (
      <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-5 text-ink animate-fade-in">
        <div className="border-b border-borderLine pb-4">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-display font-bold text-ink">Sales & Products (Sales & Channel Profitability)</h1>
            <DataKindBadge kind={accepted?.input.kind ?? "simulated"} size="md" />
          </div>
          <p className="text-xs text-ink-muted mt-1">
            {accepted
              ? `Statement period: ${accepted.input.period_start} – ${accepted.input.period_end}. Totals below are reported values; no product or channel split is inferred.`
              : "No statement is selected. Enter product and channel details below to calculate a simulated preview."}
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
        <section className="p-4 lg:p-6 rounded-card bg-white border border-borderLine space-y-4">
          <div>
            <h2 className="font-display font-bold text-sm text-ink">Enter product and channel details</h2>
            <p className="text-xs text-ink-muted mt-1">The statement has period totals only. Add item-level sales and channel costs for a backend-calculated preview. This preview is not saved.</p>
          </div>
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wide">Products</h3>
            {productRows.map((row, index) => <div key={index} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 p-3 rounded-xl bg-slate-50">
              <label className="text-[11px] font-semibold">Product<input required maxLength={120} value={row.name} onChange={(e) => setProductRows((rows) => rows.map((item, i) => i === index ? { ...item, name: e.target.value } : item))} className="mt-1 w-full rounded border border-borderLine p-2 font-normal" /></label>
              <label className="text-[11px] font-semibold">Category<input required maxLength={80} value={row.category} onChange={(e) => setProductRows((rows) => rows.map((item, i) => i === index ? { ...item, category: e.target.value } : item))} className="mt-1 w-full rounded border border-borderLine p-2 font-normal" /></label>
              <label className="text-[11px] font-semibold">Units sold<input required min="0" type="number" value={row.unitsSold} onChange={(e) => setProductRows((rows) => rows.map((item, i) => i === index ? { ...item, unitsSold: e.target.value } : item))} className="mt-1 w-full rounded border border-borderLine p-2 font-normal" /></label>
              <label className="text-[11px] font-semibold">Revenue (THB)<input required min="0" type="number" step="0.01" value={row.revenue} onChange={(e) => setProductRows((rows) => rows.map((item, i) => i === index ? { ...item, revenue: e.target.value } : item))} className="mt-1 w-full rounded border border-borderLine p-2 font-normal" /></label>
              <label className="text-[11px] font-semibold">Product cost (THB)<input required min="0" type="number" step="0.01" value={row.cost} onChange={(e) => setProductRows((rows) => rows.map((item, i) => i === index ? { ...item, cost: e.target.value } : item))} className="mt-1 w-full rounded border border-borderLine p-2 font-normal" /></label>
              <div className="flex items-end gap-2"><label className="text-[11px] font-semibold flex-1">Turnover (days)<input required min="0" type="number" value={row.turnoverDays} onChange={(e) => setProductRows((rows) => rows.map((item, i) => i === index ? { ...item, turnoverDays: e.target.value } : item))} className="mt-1 w-full rounded border border-borderLine p-2 font-normal" /></label><button type="button" disabled={productRows.length < 2} onClick={() => setProductRows((rows) => rows.filter((_, i) => i !== index))} className="rounded border border-borderLine px-2 py-2 text-[11px] disabled:opacity-40">Remove</button></div>
            </div>)}
            <button type="button" onClick={() => setProductRows((rows) => [...rows, { name: "", category: "", unitsSold: "", revenue: "", cost: "", turnoverDays: "" }])} className="rounded-btn border border-brand/30 px-3 py-2 text-xs font-semibold text-brand">+ Add product</button>
          </div>
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wide">Sales channels</h3>
            {channelRows.map((row, index) => <div key={index} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 p-3 rounded-xl bg-slate-50">
              <label className="text-[11px] font-semibold">Channel<input required maxLength={120} value={row.channel} onChange={(e) => setChannelRows((rows) => rows.map((item, i) => i === index ? { ...item, channel: e.target.value } : item))} className="mt-1 w-full rounded border border-borderLine p-2 font-normal" /></label>
              <label className="text-[11px] font-semibold">Gross sales (THB)<input required min="0" type="number" step="0.01" value={row.grossSales} onChange={(e) => setChannelRows((rows) => rows.map((item, i) => i === index ? { ...item, grossSales: e.target.value } : item))} className="mt-1 w-full rounded border border-borderLine p-2 font-normal" /></label>
              <label className="text-[11px] font-semibold">Commission (THB)<input required min="0" type="number" step="0.01" value={row.commissionFee} onChange={(e) => setChannelRows((rows) => rows.map((item, i) => i === index ? { ...item, commissionFee: e.target.value } : item))} className="mt-1 w-full rounded border border-borderLine p-2 font-normal" /></label>
              <label className="text-[11px] font-semibold">Advertising (THB)<input required min="0" type="number" step="0.01" value={row.adCost} onChange={(e) => setChannelRows((rows) => rows.map((item, i) => i === index ? { ...item, adCost: e.target.value } : item))} className="mt-1 w-full rounded border border-borderLine p-2 font-normal" /></label>
              <div className="flex items-end gap-2"><label className="text-[11px] font-semibold flex-1">Delivery (THB)<input required min="0" type="number" step="0.01" value={row.deliveryCost} onChange={(e) => setChannelRows((rows) => rows.map((item, i) => i === index ? { ...item, deliveryCost: e.target.value } : item))} className="mt-1 w-full rounded border border-borderLine p-2 font-normal" /></label><button type="button" disabled={channelRows.length < 2} onClick={() => setChannelRows((rows) => rows.filter((_, i) => i !== index))} className="rounded border border-borderLine px-2 py-2 text-[11px] disabled:opacity-40">Remove</button></div>
            </div>)}
            <button type="button" onClick={() => setChannelRows((rows) => [...rows, { channel: "", grossSales: "", commissionFee: "", adCost: "", deliveryCost: "" }])} className="rounded-btn border border-brand/30 px-3 py-2 text-xs font-semibold text-brand">+ Add sales channel</button>
          </div>
          <button type="button" disabled={salesPreviewLoading} onClick={async () => {
            setSalesPreviewLoading(true); setSalesPreviewError("");
            try {
              const incompleteProduct = productRows.some((row) => !row.name.trim() || !row.category.trim() || row.unitsSold === "" || row.revenue === "" || row.cost === "" || row.turnoverDays === "");
              const incompleteChannel = channelRows.some((row) => !row.channel.trim() || row.grossSales === "" || row.commissionFee === "" || row.adCost === "" || row.deliveryCost === "");
              if (incompleteProduct || incompleteChannel) throw new Error("Complete every product and channel field before calculating. Blank values are not treated as zero.");
              const input: SalesPreviewInput = {
                products: productRows.map((row) => ({ ...row, unitsSold: Number(row.unitsSold), turnoverDays: Number(row.turnoverDays) })),
                channels: channelRows,
              };
              const result = await apiClient.previewSales(input); setSalesPreview(result.data);
            }
            catch (error) { setSalesPreviewError(error instanceof Error ? error.message : "Could not calculate preview"); }
            finally { setSalesPreviewLoading(false); }
          }} className="rounded-btn bg-brand px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{salesPreviewLoading ? "Calculating…" : "Calculate sales preview"}</button>
          {salesPreviewError && <p role="alert" className="text-xs text-danger">{salesPreviewError}</p>}
          {salesPreview && <div className="space-y-3"><p className="text-xs font-semibold text-brand">Simulated preview · not saved</p><div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b text-left"><th className="p-2">Product</th><th className="p-2">Units</th><th className="p-2">Profit</th><th className="p-2">Margin</th><th className="p-2">Velocity</th></tr></thead><tbody>{salesPreview.products.map((product) => <tr key={product.id} className="border-b border-slate-100"><td className="p-2">{product.name}</td><td className="p-2">{product.unitsSold}</td><td className="p-2">฿{product.profit.toLocaleString()}</td><td className="p-2">{product.profitMarginPercent}%</td><td className="p-2">{product.velocity}</td></tr>)}</tbody></table></div><div className="grid grid-cols-1 md:grid-cols-3 gap-2">{salesPreview.channels.map((channel) => <div key={channel.channel} className="rounded-lg border border-borderLine p-3 text-xs"><b>{channel.channel}</b><div className="mt-1">Net profit: ฿{channel.netProfit.toLocaleString()} ({channel.netMarginPercent}%)</div></div>)}</div></div>}
        </section>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950" role="status">
          <div className="font-semibold">Saved product and channel records are unavailable</div>
          <p className="mt-1">{error || (accepted
            ? "This statement has period totals only. The preview above uses only the product and channel details you enter."
            : unavailable
              ? "No database-backed sales records are available. You can still calculate a preview above from your own inputs."
              : "No product or channel records are saved yet. You can still calculate a preview above from your own inputs.")}</p>
          <button type="button" onClick={loadData} className="mt-2 font-semibold underline">Retry saved records</button>
        </div>
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
