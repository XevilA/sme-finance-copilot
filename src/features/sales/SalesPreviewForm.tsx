import React, { useState } from "react";
import { apiClient } from "@/api/client";
import { SalesPreviewInput } from "@/api/contracts/types";
import { useSingleFlight } from "@/hooks/useEnvelope";
import { SimulatedNotice } from "@/components/ui/SimulatedNotice";
import { tr, useT } from "@/i18n";
import { ProfitBarChart } from "@/components/charts/ProfitBarChart";
import { Calculator, PackagePlus, Store, Trash2, Loader2 } from "lucide-react";

// เก็บเป็น string ทั้งหมดก่อน ช่องว่าง = ยังไม่ได้กรอก (ห้ามแปลงเป็น 0)
type ProductRow = { name: string; category: string; unitsSold: string; revenue: string; cost: string; turnoverDays: string };
type ChannelRow = SalesPreviewInput["channels"][number];

const emptyProduct = (): ProductRow => ({ name: "", category: "", unitsSold: "", revenue: "", cost: "", turnoverDays: "" });
const emptyChannel = (): ChannelRow => ({ channel: "", grossSales: "", commissionFee: "", adCost: "", deliveryCost: "" });

const isMoney = (value: string) => /^\d{1,18}(\.\d{1,2})?$/.test(value.trim());
const isWhole = (value: string) => /^\d+$/.test(value.trim()) && Number.isSafeInteger(Number(value));
const baht = (value: number | null | undefined) =>
  value == null ? tr("common.noData") : `฿${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const percent = (value: number | null | undefined) => (value == null ? tr("common.noData") : `${value}%`);
// ยอดขายเป็น 0 -> margin หาไม่ได้ (หารด้วย 0) แต่ backend ส่ง 0 มา เลยแสดงว่าคำนวณไม่ได้แทน
const marginText = (margin: number | null | undefined, base: number) => (base === 0 ? tr("salesForm.marginUndefined") : percent(margin));

const stagger = (index: number) => ({ animationDelay: `${Math.min(index, 8) * 50}ms` });
const velocityText = { fast: "salesForm.fast", normal: "salesForm.normal", slow: "salesForm.slow" } as const;

export const SalesPreviewForm: React.FC = () => {
  const demo = apiClient.isDemoMode();
  const t = useT();
  const [products, setProducts] = useState<ProductRow[]>([emptyProduct()]);
  const [channels, setChannels] = useState<ChannelRow[]>([emptyChannel()]);
  const [errors, setErrors] = useState<string[]>([]);
  const [serverError, setServerError] = useState("");
  const [result, setResult] = useState<(Awaited<ReturnType<typeof apiClient.previewSales>>) | null>(null);
  const [changedAfterRun, setChangedAfterRun] = useState(false);
  // นับจำนวนครั้งที่คำนวณ ใช้เป็น key ให้ animation เล่นใหม่ทุกครั้ง
  const [resultKey, setResultKey] = useState(0);
  const { running, run } = useSingleFlight();

  const touched = () => { if (result) setChangedAfterRun(true); };
  const editProduct = (index: number, patch: Partial<ProductRow>) => {
    setProducts((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    touched();
  };
  const editChannel = (index: number, patch: Partial<ChannelRow>) => {
    setChannels((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    touched();
  };

  const validate = (): string[] => {
    const problems: string[] = [];
    products.forEach((row, i) => {
      const label = t("salesForm.productN", { n: i + 1 });
      if (!row.name.trim() || !row.category.trim()) problems.push(t("salesForm.err.name", { label }));
      if (!isWhole(row.unitsSold)) problems.push(t("salesForm.err.units", { label }));
      if (!isMoney(row.revenue) || !isMoney(row.cost)) problems.push(t("salesForm.err.money", { label }));
      if (!isWhole(row.turnoverDays) || Number(row.turnoverDays) > 3650) problems.push(t("salesForm.err.turnover", { label }));
    });
    channels.forEach((row, i) => {
      const label = t("salesForm.channelN", { n: i + 1 });
      if (!row.channel.trim()) problems.push(t("salesForm.err.channel", { label }));
      if (![row.grossSales, row.commissionFee, row.adCost, row.deliveryCost].every(isMoney)) {
        problems.push(t("salesForm.err.channelMoney", { label }));
      }
    });
    return problems;
  };

  const calculate = () => run(async () => {
    setServerError("");
    const problems = validate();
    setErrors(problems);
    if (problems.length) return;
    try {
      const response = await apiClient.previewSales({
        products: products.map((row) => ({
          name: row.name.trim(),
          category: row.category.trim(),
          unitsSold: Number(row.unitsSold),
          revenue: row.revenue.trim(),
          cost: row.cost.trim(),
          turnoverDays: Number(row.turnoverDays),
        })),
        channels: channels.map((row) => ({
          channel: row.channel.trim(),
          grossSales: row.grossSales.trim(),
          commissionFee: row.commissionFee.trim(),
          adCost: row.adCost.trim(),
          deliveryCost: row.deliveryCost.trim(),
        })),
      });
      setResult(response);
      setResultKey((n) => n + 1);
      setChangedAfterRun(false);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : t("preview.failed"));
    }
  });

  const inputClass = "mt-1 w-full rounded-lg border border-borderLine bg-white p-2 font-normal text-sm focus:border-brand outline-none";

  return (
    <section className="p-4 lg:p-6 rounded-card bg-white border border-borderLine space-y-5" aria-labelledby="sales-preview-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="sales-preview-title" className="font-display font-bold text-sm text-ink">{t("salesForm.title")}</h2>
          <p className="text-xs text-ink-muted mt-1 max-w-2xl">
            {t("salesForm.intro")}
          </p>
        </div>
        <span className="text-[10px] rounded-chip border border-dashed border-attention/50 bg-attention-light px-2 py-0.5 font-semibold text-amber-800">
          {t("preview.simOnly")}
        </span>
      </div>

      {demo && (
        <p className="rounded-lg bg-slate-50 border border-borderLine p-2 text-xs text-ink-muted">
          {t("preview.demo")}
        </p>
      )}

      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-ink-muted">{t("salesForm.productsTitle", { n: products.length })}</h3>
        {products.map((row, index) => (
          <fieldset key={index} className="animate-rise grid grid-cols-2 lg:grid-cols-12 gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <legend className="sr-only">{t("salesForm.productN", { n: index + 1 })}</legend>
            <label className="col-span-2 lg:col-span-3 text-[11px] font-semibold">{t("salesForm.productName")}
              <input maxLength={120} value={row.name} onChange={(e) => editProduct(index, { name: e.target.value })} className={inputClass} />
            </label>
            <label className="col-span-2 sm:col-span-1 lg:col-span-2 text-[11px] font-semibold">{t("salesForm.category")}
              <input maxLength={80} value={row.category} onChange={(e) => editProduct(index, { category: e.target.value })} className={inputClass} />
            </label>
            <label className="lg:col-span-1 text-[11px] font-semibold">{t("salesForm.unitsSold")}
              <input inputMode="numeric" value={row.unitsSold} onChange={(e) => editProduct(index, { unitsSold: e.target.value })} className={`${inputClass} font-mono`} />
            </label>
            <label className="lg:col-span-2 text-[11px] font-semibold">{t("salesForm.revenue")}
              <input inputMode="decimal" value={row.revenue} onChange={(e) => editProduct(index, { revenue: e.target.value })} className={`${inputClass} font-mono`} />
            </label>
            <label className="lg:col-span-2 text-[11px] font-semibold">{t("salesForm.cost")}
              <input inputMode="decimal" value={row.cost} onChange={(e) => editProduct(index, { cost: e.target.value })} className={`${inputClass} font-mono`} />
            </label>
            <div className="flex items-end gap-2 lg:col-span-2">
              <label className="flex-1 text-[11px] font-semibold">{t("salesForm.turnover")}
                <input inputMode="numeric" value={row.turnoverDays} onChange={(e) => editProduct(index, { turnoverDays: e.target.value })} className={`${inputClass} font-mono`} />
              </label>
              <button type="button" aria-label={t("salesForm.removeProduct", { n: index + 1 })} disabled={products.length < 2}
                onClick={() => { setProducts((rows) => rows.filter((_, i) => i !== index)); touched(); }}
                className="mb-0.5 rounded-lg border border-borderLine bg-white p-2 text-ink-muted hover:text-danger disabled:opacity-40">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </fieldset>
        ))}
        <button type="button" disabled={products.length >= 100} onClick={() => { setProducts((rows) => [...rows, emptyProduct()]); touched(); }}
          className="press w-full sm:w-auto rounded-btn border border-brand/30 px-3 py-2 text-xs font-semibold text-brand flex items-center justify-center gap-1.5 disabled:opacity-40">
          <PackagePlus className="w-4 h-4" /> {t("salesForm.addProduct")}
        </button>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-ink-muted">{t("salesForm.channelsTitle", { n: channels.length })}</h3>
        {channels.map((row, index) => (
          <fieldset key={index} className="animate-rise grid grid-cols-2 lg:grid-cols-10 gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <legend className="sr-only">{t("salesForm.channelN", { n: index + 1 })}</legend>
            <label className="col-span-2 lg:col-span-2 text-[11px] font-semibold">{t("salesForm.channel")}
              <input maxLength={120} placeholder={t("salesForm.ph.channel")} value={row.channel} onChange={(e) => editChannel(index, { channel: e.target.value })} className={inputClass} />
            </label>
            <label className="lg:col-span-2 text-[11px] font-semibold">{t("salesForm.gross")}
              <input inputMode="decimal" value={row.grossSales} onChange={(e) => editChannel(index, { grossSales: e.target.value })} className={`${inputClass} font-mono`} />
            </label>
            <label className="lg:col-span-2 text-[11px] font-semibold">{t("salesForm.commission")}
              <input inputMode="decimal" value={row.commissionFee} onChange={(e) => editChannel(index, { commissionFee: e.target.value })} className={`${inputClass} font-mono`} />
            </label>
            <label className="lg:col-span-2 text-[11px] font-semibold">{t("salesForm.ads")}
              <input inputMode="decimal" value={row.adCost} onChange={(e) => editChannel(index, { adCost: e.target.value })} className={`${inputClass} font-mono`} />
            </label>
            <div className="flex items-end gap-2 lg:col-span-2">
              <label className="flex-1 text-[11px] font-semibold">{t("salesForm.delivery")}
                <input inputMode="decimal" value={row.deliveryCost} onChange={(e) => editChannel(index, { deliveryCost: e.target.value })} className={`${inputClass} font-mono`} />
              </label>
              <button type="button" aria-label={t("salesForm.removeChannel", { n: index + 1 })} disabled={channels.length < 2}
                onClick={() => { setChannels((rows) => rows.filter((_, i) => i !== index)); touched(); }}
                className="mb-0.5 rounded-lg border border-borderLine bg-white p-2 text-ink-muted hover:text-danger disabled:opacity-40">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </fieldset>
        ))}
        <button type="button" disabled={channels.length >= 100} onClick={() => { setChannels((rows) => [...rows, emptyChannel()]); touched(); }}
          className="press w-full sm:w-auto rounded-btn border border-brand/30 px-3 py-2 text-xs font-semibold text-brand flex items-center justify-center gap-1.5 disabled:opacity-40">
          <Store className="w-4 h-4" /> {t("salesForm.addChannel")}
        </button>
      </div>

      <button type="button" disabled={running || demo} onClick={() => void calculate()}
        className="press w-full sm:w-auto rounded-btn bg-brand px-4 py-2 text-xs font-semibold text-white flex items-center justify-center gap-1.5 disabled:opacity-50">
        {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />} {running ? t("preview.calculating") : result ? t("preview.recalculate") : t("salesForm.calculate")}
      </button>

      {errors.length > 0 && (
        <div role="alert" className="animate-rise rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
          <strong>{t("preview.fixFirst")}</strong>
          <ul className="mt-1 list-disc pl-4 space-y-0.5">{errors.map((problem) => <li key={problem}>{problem}</li>)}</ul>
        </div>
      )}
      {serverError && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900 flex flex-wrap items-center justify-between gap-2">
          <span><strong>{t("preview.serverError")}</strong> {serverError}</span>
          <button type="button" onClick={() => void calculate()} className="font-semibold underline">{t("common.tryAgain")}</button>
        </div>
      )}

      {result && (
        <div key={resultKey} className="space-y-3 animate-rise">
          <SimulatedNotice kind={result.kind} persisted={result.persisted} source={result.source} outdated={changedAfterRun} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="animate-rise rounded-xl border border-borderLine p-3" style={stagger(1)}>
              <ProfitBarChart
                title={t("salesForm.chartProducts")}
                bars={result.data.products.map((p) => ({
                  label: p.name,
                  value: p.profit,
                  detail: t("salesForm.detailProduct", { revenue: baht(p.revenue), margin: marginText(p.profitMarginPercent, p.revenue) }),
                }))}
              />
            </div>
            <div className="animate-rise rounded-xl border border-borderLine p-3" style={stagger(2)}>
              <ProfitBarChart
                title={t("salesForm.chartChannels")}
                bars={result.data.channels.map((c) => ({
                  label: c.channel,
                  value: c.netProfit,
                  detail: t("salesForm.detailChannel", { gross: baht(c.grossSales), margin: marginText(c.netMarginPercent, c.grossSales) }),
                }))}
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-borderLine">
            <table className="w-full min-w-[640px] text-xs">
              <thead className="bg-slate-50 text-left text-ink-muted">
                <tr>
                  <th className="p-2">{t("salesForm.colProduct")}</th><th className="p-2">{t("salesForm.category")}</th><th className="p-2 text-right">{t("salesForm.colUnits")}</th>
                  <th className="p-2 text-right">{t("salesForm.colRevenue")}</th><th className="p-2 text-right">{t("salesForm.colProfit")}</th><th className="p-2 text-right">{t("salesForm.colMargin")}</th><th className="p-2">{t("salesForm.colSpeed")}</th>
                </tr>
              </thead>
              <tbody>
                {result.data.products.map((product, index) => (
                  <tr key={product.id} style={stagger(index + 1)} className="animate-rise border-t border-slate-100 transition-colors hover:bg-slate-50">
                    <td className="p-2 font-semibold">{product.name}</td>
                    <td className="p-2 text-ink-muted">{product.category}</td>
                    <td className="p-2 text-right font-mono">{product.unitsSold.toLocaleString("en-US")}</td>
                    <td className="p-2 text-right font-mono">{baht(product.revenue)}</td>
                    <td className={`p-2 text-right font-mono font-bold ${product.profit < 0 ? "text-danger" : "text-brand"}`}>{baht(product.profit)}</td>
                    <td className="p-2 text-right font-mono">{marginText(product.profitMarginPercent, product.revenue)}</td>
                    <td className="p-2">{velocityText[product.velocity] ? t(velocityText[product.velocity]) : product.velocity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {result.data.channels.map((channel, index) => (
              <div key={`${index}-${channel.channel}`} style={stagger(index + 2)} className="animate-rise rounded-xl border border-borderLine p-3 text-xs space-y-1 transition-shadow hover:shadow-soft-sm">
                <div className="font-bold text-ink">{channel.channel}</div>
                <div className="flex justify-between"><span className="text-ink-muted">{t("salesForm.grossShort")}</span><span className="font-mono">{baht(channel.grossSales)}</span></div>
                <div className="flex justify-between"><span className="text-ink-muted">{t("salesForm.commissionShort")}</span><span className="font-mono">{baht(channel.commissionFee)}</span></div>
                <div className="flex justify-between"><span className="text-ink-muted">{t("salesForm.adsDelivery")}</span><span className="font-mono">{baht(channel.adCost)} / {baht(channel.deliveryCost)}</span></div>
                <div className="flex justify-between border-t border-slate-100 pt-1">
                  <span className="font-semibold">{t("salesForm.netProfit")}</span>
                  <span className={`font-mono font-bold ${channel.netProfit < 0 ? "text-danger" : "text-brand"}`}>{baht(channel.netProfit)} ({marginText(channel.netMarginPercent, channel.grossSales)})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
