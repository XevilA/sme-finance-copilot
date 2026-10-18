import React, { useState } from "react";
import { apiClient } from "@/api/client";
import { CashflowDay, CashflowPreviewInput, FinancialEventType } from "@/api/contracts/types";
import { useSingleFlight } from "@/hooks/useEnvelope";
import { SimulatedNotice } from "@/components/ui/SimulatedNotice";
import { TranslationKey, tr, useT } from "@/i18n";
import { CashBalanceChart } from "@/components/charts/CashBalanceChart";
import { CalendarPlus, Calculator, Trash2, Loader2 } from "lucide-react";

type EventRow = CashflowPreviewInput["events"][number];

// backend ยอมให้เป็นเงินเข้าได้แค่ receive_payment เท่านั้น ที่เหลือเป็นเงินออก
const eventTypes: { value: FinancialEventType; label: TranslationKey }[] = [
  { value: "receive_payment", label: "cashForm.type.receive" },
  { value: "buy_materials", label: "cashForm.type.materials" },
  { value: "produce", label: "cashForm.type.produce" },
  { value: "deliver", label: "cashForm.type.deliver" },
  { value: "pay_obligations", label: "cashForm.type.obligations" },
];

const emptyRow = (): EventRow => ({ date: "", type: "receive_payment", title: "", amount: "", isInflow: true, partner: "" });

const DAY = 86400000;
const stagger = (index: number) => ({ animationDelay: `${Math.min(index, 8) * 50}ms` });
function addDays(isoDate: string, days: number): string {
  const time = Date.parse(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(time)) return "";
  return new Date(time + days * DAY).toISOString().slice(0, 10);
}
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
}
// ใช้วันที่ตามเวลาเครื่อง ไม่ใช่ UTC (ไม่งั้นก่อน 7 โมงเช้าที่ไทยจะได้วันที่เมื่อวาน)
function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
// backend รับได้ไม่เกิน 18 หลักหน้าจุดทศนิยม
const isMoney = (value: string) => /^\d{1,18}(\.\d{1,2})?$/.test(value.trim());
const baht = (value: number | null | undefined) =>
  value == null ? tr("common.noData") : `฿${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

type Props = {
  // ค่าตั้งต้นจากงบที่ import (ถ้ามี) ผู้ใช้แก้ได้ ไม่บังคับ
  defaultAsOf?: string;
  defaultOpeningCash?: string;
  defaultReserve?: string;
};

export const CashflowPreviewForm: React.FC<Props> = ({ defaultAsOf, defaultOpeningCash, defaultReserve }) => {
  const demo = apiClient.isDemoMode();
  const t = useT();
  const [asOf, setAsOf] = useState(defaultAsOf || localToday());
  const [openingCash, setOpeningCash] = useState(defaultOpeningCash || "");
  const [reserve, setReserve] = useState(defaultReserve || "");
  const [rows, setRows] = useState<EventRow[]>([emptyRow()]);
  const [errors, setErrors] = useState<string[]>([]);
  const [serverError, setServerError] = useState("");
  const [result, setResult] = useState<(Awaited<ReturnType<typeof apiClient.previewCashflow>>) | null>(null);
  const [changedAfterRun, setChangedAfterRun] = useState(false);
  // นับจำนวนครั้งที่คำนวณ ใช้เป็น key ให้ animation เล่นใหม่ทุกครั้ง
  const [resultKey, setResultKey] = useState(0);
  // จำค่าที่ใช้ตอนกดคำนวณ (ถ้าแก้ฟอร์มทีหลัง กราฟยังตรงกับผลเดิม)
  const [ranWith, setRanWith] = useState({ asOf: "", openingCash: 0 });
  const [showAllDays, setShowAllDays] = useState(false);
  const { running, run } = useSingleFlight();

  const touched = () => { if (result) setChangedAfterRun(true); };
  const updateRow = (index: number, patch: Partial<EventRow>) => {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    touched();
  };

  // เช็คในฟอร์มก่อนส่ง จะได้ไม่ต้องรอ 422 จาก server แต่ server ก็ยังเช็คซ้ำอยู่ดี
  const validate = (): string[] => {
    const problems: string[] = [];
    if (!asOf) problems.push(t("cashForm.err.asOf"));
    if (!isMoney(openingCash)) problems.push(t("cashForm.err.opening"));
    if (!isMoney(reserve)) problems.push(t("cashForm.err.reserve"));
    rows.forEach((row, i) => {
      const n = i + 1;
      if (!row.date) problems.push(t("cashForm.err.date", { n }));
      else if (asOf) {
        const gap = daysBetween(asOf, row.date);
        if (gap < 1 || gap > 90) problems.push(t("cashForm.err.range", { n, date: asOf }));
      }
      if (!row.title.trim()) problems.push(t("cashForm.err.title", { n }));
      if (!isMoney(row.amount)) problems.push(t("cashForm.err.amount", { n }));
    });
    return problems;
  };

  const calculate = () => run(async () => {
    setServerError("");
    const problems = validate();
    setErrors(problems);
    if (problems.length) return;
    try {
      const response = await apiClient.previewCashflow({
        as_of: asOf,
        opening_cash: openingCash.trim(),
        reserve: reserve.trim(),
        events: rows.map((row) => ({
          ...row,
          title: row.title.trim(),
          amount: row.amount.trim(),
          partner: row.partner?.trim() || "",
          isInflow: row.type === "receive_payment",
        })),
      });
      setResult(response);
      setResultKey((n) => n + 1);
      setRanWith({ asOf, openingCash: Number(openingCash) });
      setChangedAfterRun(false);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : t("preview.failed"));
    }
  });

  const days: CashflowDay[] = result?.data ?? [];
  // แค่เลือกแถวจากผลที่ backend คำนวณมาแล้ว ไม่ได้คำนวณยอดเงินเองใน React
  const lowest = days.length ? days.reduce((min, day) => (day.projectedCash < min.projectedCash ? day : min)) : null;
  const firstBelowReserve = days.find((day) => day.isDeficit) || null;
  const visibleDays = showAllDays ? days : days.filter((day) => day.events.length > 0 || day.isDeficit);

  const inputClass = "mt-1 w-full rounded-lg border border-borderLine bg-white p-2 font-normal text-sm focus:border-brand outline-none";

  return (
    <section className="p-4 lg:p-6 rounded-card bg-white border border-borderLine space-y-4" aria-labelledby="cash-preview-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="cash-preview-title" className="font-display font-bold text-sm text-ink">{t("cashForm.title")}</h2>
          <p className="text-xs text-ink-muted mt-1 max-w-2xl">
            {t("cashForm.intro")}
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="text-xs font-semibold">{t("cashForm.asOf")}
          <input type="date" value={asOf} onChange={(e) => { setAsOf(e.target.value); touched(); }} className={inputClass} />
        </label>
        <label className="text-xs font-semibold">{t("cashForm.opening")}
          <input inputMode="decimal" placeholder={t("cashForm.ph.opening")} value={openingCash} onChange={(e) => { setOpeningCash(e.target.value); touched(); }} className={`${inputClass} font-mono`} />
        </label>
        <label className="text-xs font-semibold">{t("cashForm.reserve")}
          <input inputMode="decimal" placeholder={t("cashForm.ph.reserve")} value={reserve} onChange={(e) => { setReserve(e.target.value); touched(); }} className={`${inputClass} font-mono`} />
        </label>
      </div>
      {(defaultOpeningCash || defaultReserve) && (
        <p className="text-[11px] text-ink-muted -mt-2">{t("cashForm.copied")}</p>
      )}

      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-ink-muted">{t("cashForm.rowsTitle", { n: rows.length })}</h3>
        {rows.map((row, index) => (
          <fieldset key={index} className="animate-rise grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <legend className="sr-only">{t("cashForm.eventLegend", { n: index + 1 })}</legend>
            <label className="text-[11px] font-semibold lg:col-span-2">{t("cashForm.date")}
              <input type="date" min={addDays(asOf, 1)} max={addDays(asOf, 90)} value={row.date}
                onChange={(e) => updateRow(index, { date: e.target.value })} className={inputClass} />
            </label>
            <label className="text-[11px] font-semibold lg:col-span-3">{t("cashForm.type")}
              <select value={row.type} onChange={(e) => {
                const type = e.target.value as FinancialEventType;
                updateRow(index, { type, isInflow: type === "receive_payment" });
              }} className={inputClass}>
                {eventTypes.map((option) => <option key={option.value} value={option.value}>{t(option.label)}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-semibold lg:col-span-3">{t("cashForm.description")}
              <input maxLength={120} placeholder={t("cashForm.ph.title")} value={row.title}
                onChange={(e) => updateRow(index, { title: e.target.value })} className={inputClass} />
            </label>
            <label className="text-[11px] font-semibold lg:col-span-2">{t("cashForm.amount")}
              <input inputMode="decimal" placeholder="0.00" value={row.amount}
                onChange={(e) => updateRow(index, { amount: e.target.value })} className={`${inputClass} font-mono`} />
            </label>
            <div className="flex items-end gap-2 lg:col-span-2">
              <label className="text-[11px] font-semibold flex-1">{t("cashForm.partner")}
                <input maxLength={120} value={row.partner || ""} onChange={(e) => updateRow(index, { partner: e.target.value })} className={inputClass} />
              </label>
              <button type="button" aria-label={t("cashForm.removeEvent", { n: index + 1 })} disabled={rows.length < 2}
                onClick={() => { setRows((current) => current.filter((_, i) => i !== index)); touched(); }}
                className="mb-0.5 rounded-lg border border-borderLine bg-white p-2 text-ink-muted hover:text-danger disabled:opacity-40">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </fieldset>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <button type="button" disabled={rows.length >= 100} onClick={() => { setRows((current) => [...current, emptyRow()]); touched(); }}
          className="press rounded-btn border border-brand/30 px-3 py-2 text-xs font-semibold text-brand flex items-center justify-center gap-1.5 disabled:opacity-40">
          <CalendarPlus className="w-4 h-4" /> {t("cashForm.addEvent")}
        </button>
        <button type="button" disabled={running || demo} onClick={() => void calculate()}
          className="press rounded-btn bg-brand px-4 py-2 text-xs font-semibold text-white flex items-center justify-center gap-1.5 disabled:opacity-50">
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />} {running ? t("preview.calculating") : result ? t("preview.recalculate") : t("cashForm.calculate")}
        </button>
      </div>

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
          <SimulatedNotice kind={result.kind} persisted={result.persisted} source={result.source} asOf={result.asOf} outdated={changedAfterRun} />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div className="animate-rise rounded-xl border border-borderLine p-3" style={stagger(1)}>
              <span className="text-[10px] font-bold uppercase text-ink-muted">{t("cashForm.lowest")}</span>
              <div className="mt-1 font-mono text-base font-bold">{baht(lowest?.projectedCash)}</div>
              <span className="text-[11px] text-ink-muted">{lowest ? t("cashForm.onDate", { date: lowest.date }) : t("cashForm.noDays")}</span>
            </div>
            <div className={`animate-rise rounded-xl border p-3 ${firstBelowReserve ? "border-danger/40 bg-red-50" : "border-emerald-200 bg-emerald-50"}`} style={stagger(2)}>
              <span className="text-[10px] font-bold uppercase text-ink-muted">{t("cashForm.reserveCheck")}</span>
              <div className="mt-1 font-semibold">{firstBelowReserve ? t("cashForm.belowFrom", { date: firstBelowReserve.date }) : t("cashForm.staysAbove")}</div>
              <span className="text-[11px] text-ink-muted">{t("cashForm.daysBelow", { below: days.filter((day) => day.isDeficit).length, total: days.length })}</span>
            </div>
            <div className="animate-rise rounded-xl border border-borderLine p-3" style={stagger(3)}>
              <span className="text-[10px] font-bold uppercase text-ink-muted">{t("cashForm.eventsUsed")}</span>
              <div className="mt-1 font-semibold">{t("cashForm.enteredRows", { n: days.reduce((count, day) => count + day.events.length, 0) })}</div>
              <span className="text-[11px] text-ink-muted">{t("cashForm.noOther")}</span>
            </div>
          </div>

          <div className="animate-rise rounded-xl border border-borderLine p-3" style={stagger(4)}>
            <CashBalanceChart asOf={ranWith.asOf} openingCash={ranWith.openingCash} days={days} />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-ink-muted">{showAllDays ? t("cashForm.showingAll", { n: days.length }) : t("cashForm.showingSome")}</span>
            <button type="button" onClick={() => setShowAllDays((value) => !value)} className="text-[11px] font-semibold text-brand underline">
              {showAllDays ? t("cashForm.showFewer") : t("cashForm.showEvery")}
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-borderLine">
            <table className="w-full min-w-[560px] text-xs">
              <thead className="bg-slate-50 text-left text-ink-muted">
                <tr><th className="p-2">{t("cashForm.date")}</th><th className="p-2 text-right">{t("cashForm.colIn")}</th><th className="p-2 text-right">{t("cashForm.colOut")}</th><th className="p-2 text-right">{t("cashForm.colBalance")}</th><th className="p-2">{t("cashForm.colReserve")}</th></tr>
              </thead>
              <tbody>
                {visibleDays.map((day, index) => (
                  <tr key={day.date} style={stagger(index + 3)} className={`animate-rise border-t border-slate-100 transition-colors hover:bg-slate-50 ${day.isDeficit ? "bg-red-50/60" : ""}`}>
                    <td className="p-2 whitespace-nowrap">{day.date}{day.events.length ? <span className="block text-[10px] text-ink-muted">{day.events.map((ev) => ev.title).join(", ")}</span> : null}</td>
                    <td className="p-2 text-right font-mono text-emerald-700">{baht(day.inflow)}</td>
                    <td className="p-2 text-right font-mono text-danger">{baht(day.outflow)}</td>
                    <td className="p-2 text-right font-mono font-bold">{baht(day.simulatedCash ?? day.projectedCash)}</td>
                    <td className="p-2">{day.isDeficit ? t("cashForm.shortBy", { amount: baht(day.deficitAmount) }) : t("common.ok")}</td>
                  </tr>
                ))}
                {visibleDays.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-ink-muted">{t("cashForm.noRows")}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};
