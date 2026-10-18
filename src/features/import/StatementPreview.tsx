import React, { useState } from "react";
import { StatementRecord, statementDraft, statementWithYear } from "@/api/statementImport";
import { useT } from "@/i18n";

const titleKeys = { balance_sheet: "stmt.balance", income_statement: "stmt.income", cash_flow_statement: "stmt.cashflow" } as const;

export function StatementPreview({ records, onImport }: { records: StatementRecord[]; onImport: (draft: Record<string, string>) => void }) {
  const t = useT();
  const titles = { balance_sheet: t(titleKeys.balance_sheet), income_statement: t(titleKeys.income_statement), cash_flow_statement: t(titleKeys.cash_flow_statement) };
  const [selected, setSelected] = useState<number[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [years, setYears] = useState<Record<number, string>>({});
  let draft: Record<string, string> | null = null;
  let error = "";
  try { draft = statementDraft(selected.map((index) => statementWithYear(records[index], years[index] || ""))); }
  catch (reason) { error = reason instanceof Error ? reason.message : t("stmt.review"); }
  return <section className="bg-white p-5 rounded-card border border-borderLine space-y-4" aria-label={t("stmt.selectLabel")}>
    <h3 className="font-bold text-sm">{t("stmt.title")}</h3>
    <p className="text-xs text-ink-muted">{t("stmt.intro")}</p>
    <div className="space-y-2">
      {records.map((record, index) => {
        let resolved: StatementRecord | null = null;
        try { resolved = statementWithYear(record, years[index] || ""); } catch { /* Require explicit year for placeholders. */ }
        const canAssignYear = record.currency === "THB" && !record.period.year && !["invalid", "empty_template"].includes(record.status);
        const blocked = record.currency !== "THB" || !resolved?.period.year || ["invalid", "empty_template"].includes(record.status);
        return <div key={`${record.sheet}-${record.section}-${record.column}`} className="p-3 rounded-xl border border-slate-200 text-xs space-y-2">
          <label className="flex gap-2 items-start">
            <input type="checkbox" disabled={blocked} checked={selected.includes(index)} onChange={(event) => { setSelected(event.target.checked ? [...selected, index] : selected.filter((item) => item !== index)); setConfirmed(false); }} />
            <span><strong>{record.sheet} · {titles[record.section]}</strong><br />{record.period.header} · {t("stmt.column", { col: record.column })} · {record.currency || t("stmt.noCurrency")} · {t("stmt.unitScale", { scale: record.sourceScale })}
              {blocked && <span className="block text-amber-800">{record.currency !== "THB" ? t("stmt.notThb") : record.status === "empty_template" ? t("stmt.empty") : canAssignYear ? t("stmt.needYear") : t("stmt.fixFile")}</span>}
            </span>
          </label>
          {canAssignYear && <label className="block text-xs">{t("stmt.yearLabel")}
            <input type="text" inputMode="numeric" maxLength={4} aria-label={t("stmt.yearAria", { sheet: record.sheet, title: titles[record.section], col: record.column })} placeholder={t("stmt.yearPh")}
              value={years[index] || ""} className="ml-2 p-2 border rounded-lg"
              onChange={(event) => { setYears({ ...years, [index]: event.target.value }); setConfirmed(false); }} />
            {resolved && <span className="ml-2">{t("stmt.usingYear", { year: resolved.period.year ?? "" })}</span>}
          </label>}
          <details><summary className="cursor-pointer text-brand">{t("stmt.details")}</summary>
            <dl className="grid grid-cols-2 gap-1 mt-2 font-mono">{Object.entries(record.fields).map(([key, value]) => <React.Fragment key={key}><dt>{key}</dt><dd>{value ?? t("common.unknown")}</dd></React.Fragment>)}</dl>
            {record.checks.map((check) => <p key={check.id}>{check.id}: {check.status}</p>)}
            {record.warnings.map((warning) => <p key={warning} className="text-amber-800">{warning}</p>)}
          </details>
        </div>;
      })}
    </div>
    <label className="flex gap-2 text-xs"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />{t("stmt.confirm")}</label>
    <p className="text-xs text-amber-800" role="status">{error || t("stmt.next")}</p>
    <button type="button" disabled={!draft || !confirmed} className="px-4 py-2 bg-brand text-white text-xs font-bold rounded-btn disabled:opacity-40" onClick={() => draft && onImport(draft)}>{t("stmt.reviewButton")}</button>
  </section>;
}
