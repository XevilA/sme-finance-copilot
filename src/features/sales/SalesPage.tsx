import React, { useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import { apiClient } from "@/api/client";
import { ProductSales, ChannelSales } from "@/api/contracts/types";
import { envelopeMode, useAnalysisContext, useEnvelope } from "@/hooks/useEnvelope";
import { DataKindBadge } from "@/components/signature/DataKindBadge";
import { StateRenderer } from "@/components/ui/StateRenderer";
import { missingDataLabel } from "@/api/dataAvailability";
import { useT } from "@/i18n";
import { SalesPreviewForm } from "./SalesPreviewForm";
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
  const t = useT();
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
      <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6" role="status" aria-label={t("sales.loadingLabel")}>
        <p className="text-xs text-ink-muted">{t("sales.loading")}</p>
        <div className="h-40 skeleton rounded-card" />
        <div className="h-80 skeleton rounded-card" />
      </div>
    );
  }

  const products = productsEnvelope?.data || [];
  const channels = channelsEnvelope?.data || [];
  const reportedTotals = [
    { field: "revenue", label: t("sales.line.revenue"), unit: "THB" },
    { field: "cost_of_goods_sold", label: t("missing.cost_of_goods_sold"), unit: "THB" },
    { field: "total_expenses", label: t("missing.total_expenses"), unit: "THB" },
    { field: "net_income", label: t("missing.net_income"), unit: "THB" },
    { field: "units_sold", label: t("missing.units_sold"), unit: "units" },
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
    const missingKeys = [...new Set([...(productsEnvelope?.missing || []), ...(channelsEnvelope?.missing || [])])];
    return (
      <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-5 text-ink animate-fade-in">
        <div className="border-b border-borderLine pb-4">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-display font-bold text-ink">{t("sales.title")}</h1>
            <DataKindBadge kind={accepted?.input.kind ?? "simulated"} size="md" />
          </div>
          <p className="text-xs text-ink-muted mt-1">
            {accepted
              ? t("sales.periodNote", { start: accepted.input.period_start, end: accepted.input.period_end })
              : t("sales.noStatement")}
          </p>
        </div>
        {reportedTotals.length > 0 && (
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3" aria-label={t("sales.reportedTotals")}>
            {reportedTotals.map((item) => (
              <div key={item.field} className="p-4 rounded-card bg-white border border-borderLine">
                <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">{item.label}</span>
                <div className="mt-2 text-lg font-bold font-mono tabular-nums">
                  {item.unit === "THB" ? "฿" : ""}{item.value.toLocaleString("en-US", { maximumFractionDigits: 2 })}{item.unit === "units" ? ` ${t("sales.units")}` : ""}
                </div>
                <span className="text-[10px] text-ink-muted">{t("common.reportedInStatement")}</span>
              </div>
            ))}
          </section>
        )}
        <div className={`rounded-xl border p-3 text-xs ${error ? "border-rose-200 bg-rose-50 text-rose-950" : "border-amber-200 bg-amber-50 text-amber-950"}`} role="status">
          <div className="font-semibold">{error ? t("sales.loadError") : t("sales.noBreakdown")}</div>
          <p className="mt-1">{error || (accepted
            ? t("sales.statementOnly")
            : unavailable
              ? t("sales.noDb")
              : t("sales.noRecords"))}</p>
          {missingKeys.length > 0 && <p className="mt-1 text-[11px]">{t("common.missingList", { list: missingKeys.map(missingDataLabel).join(", ") })}</p>}
          <div className="mt-2 flex flex-wrap gap-3">
            <button type="button" onClick={loadData} className="font-semibold underline">{t("common.tryLoadingAgain")}</button>
            {!accepted && <button type="button" onClick={() => setCurrentPage("import")} className="font-semibold underline">{t("common.importStatement")}</button>}
          </div>
        </div>
        <SalesPreviewForm />
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
                {t("sales.title")}
              </h1>
              <DataKindBadge kind={productsEnvelope.kind} size="md" />
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              {t("sales.subtitle")}
            </p>
          </div>
        </div>

        {/* Section: Channel Net Margin Reality Check (B2B vs Delivery App GP Fee) */}
        <div className="bg-white rounded-card p-5 border border-borderLine shadow-soft-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <h3 className="font-display font-bold text-xs uppercase tracking-wider text-ink">
                {t("sales.channelTitle")}
              </h3>
              <p className="text-[11px] text-ink-muted">
                {t("sales.channelSub")}
              </p>
            </div>
            <DataKindBadge kind={channelsEnvelope.kind} size="sm" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {channels.map((ch, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs"
              >
                <div className="font-bold text-ink leading-tight">{ch.channel}</div>
                <div className="flex items-baseline justify-between border-b border-slate-200 pb-2">
                  <span className="text-ink-muted">{t("sales.grossColon")}</span>
                  <span className="font-bold font-mono text-ink">฿{ch.grossSales.toLocaleString()}</span>
                </div>

                <div className="space-y-1 text-[11px] text-ink-muted">
                  <div className="flex justify-between">
                    <span>{t("sales.commissionColon")}</span>
                    <span className="text-danger font-mono">-฿{ch.commissionFee.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("sales.adsColon")}</span>
                    <span className="font-mono">-฿{ch.adCost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("sales.deliveryColon")}</span>
                    <span className="font-mono">-฿{ch.deliveryCost.toLocaleString()}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-brand">{t("sales.netColon")}</span>
                  <div className="text-right">
                    <span className="font-extrabold font-mono text-brand block">
                      ฿{ch.netProfit.toLocaleString()}
                    </span>
                    <span className={`text-[10px] font-bold ${ch.netMarginPercent > 20 ? "text-emerald-700" : "text-amber-800"}`}>
                      {t("sales.marginN", { n: ch.netMarginPercent })}
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
              {t("sales.productTitle")}
            </h3>
            <span className="text-xs text-ink-muted">{t("sales.itemsN", { n: products.length })}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-ink-muted">
                  <th className="py-2">{t("salesForm.colProduct")}</th>
                  <th className="py-2">{t("salesForm.category")}</th>
                  <th className="py-2 text-right">{t("missing.units_sold")}</th>
                  <th className="py-2 text-right">{t("salesForm.colRevenue")}</th>
                  <th className="py-2 text-right">{t("salesForm.netProfit")}</th>
                  <th className="py-2 text-right">{t("sales.marginPct")}</th>
                  <th className="py-2 text-center">{t("sales.velocity")}</th>
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
                        {p.velocity === "fast" ? `🔥 ${t("sales.bestSeller")}` : p.velocity === "normal" ? t("salesForm.normal") : `🐢 ${t("salesForm.slow")}`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <SalesPreviewForm />
      </div>
    </StateRenderer>
  );
};
