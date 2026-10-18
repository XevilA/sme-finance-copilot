import React, { useState } from "react";
import { StatementRecord, statementDraft, statementWithYear } from "@/api/statementImport";

const titles = { balance_sheet: "Balance Sheet", income_statement: "Income Statement", cash_flow_statement: "Cash Flow Statement" };

export function StatementPreview({ records, onImport }: { records: StatementRecord[]; onImport: (draft: Record<string, string>) => void }) {
  const [selected, setSelected] = useState<number[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [years, setYears] = useState<Record<number, string>>({});
  let draft: Record<string, string> | null = null;
  let error = "";
  try { draft = statementDraft(selected.map((index) => statementWithYear(records[index], years[index] || ""))); }
  catch (reason) { error = reason instanceof Error ? reason.message : "Please review the selected statement."; }
  return <section className="bg-white p-5 rounded-card border border-borderLine space-y-4" aria-label="Select statements from Excel">
    <h3 className="font-bold text-sm">File read · Select a statement to import</h3>
    <p className="text-xs text-ink-muted">This file contains multiple statements and periods. Select statements from the same sheet, year, and THB currency. Different currencies will not be combined and blank cells will not be treated as zero.</p>
    <div className="space-y-2">
      {records.map((record, index) => {
        let resolved: StatementRecord | null = null;
        try { resolved = statementWithYear(record, years[index] || ""); } catch { /* Require explicit year for placeholders. */ }
        const canAssignYear = record.currency === "THB" && !record.period.year && !["invalid", "empty_template"].includes(record.status);
        const blocked = record.currency !== "THB" || !resolved?.period.year || ["invalid", "empty_template"].includes(record.status);
        return <div key={`${record.sheet}-${record.section}-${record.column}`} className="p-3 rounded-xl border border-slate-200 text-xs space-y-2">
          <label className="flex gap-2 items-start">
            <input type="checkbox" disabled={blocked} checked={selected.includes(index)} onChange={(event) => { setSelected(event.target.checked ? [...selected, index] : selected.filter((item) => item !== index)); setConfirmed(false); }} />
            <span><strong>{record.sheet} · {titles[record.section]}</strong><br />{record.period.header} · Column {record.column} · {record.currency || "Currency not specified"} · Unit scale {record.sourceScale}
              {blocked && <span className="block text-amber-800">{record.currency !== "THB" ? "Preview only; this currency cannot be calculated as THB." : record.status === "empty_template" ? "This template is empty. Add the year and actual figures to the file first." : canAssignYear ? "Data found. Enter the fiscal year below before selecting." : "Correct the year or inconsistent totals in the file first."}</span>}
            </span>
          </label>
          {canAssignYear && <label className="block text-xs">Fiscal year for this statement (AD or BE)
            <input type="text" inputMode="numeric" maxLength={4} aria-label={`ปีบัญชี ${record.sheet} ${titles[record.section]} คอลัมน์ ${record.column}`} placeholder="เช่น 2019 หรือ 2562"
              value={years[index] || ""} className="ml-2 p-2 border rounded-lg"
              onChange={(event) => { setYears({ ...years, [index]: event.target.value }); setConfirmed(false); }} />
            {resolved && <span className="ml-2">Using AD year {resolved.period.year}</span>}
          </label>}
          <details><summary className="cursor-pointer text-brand">View extracted data and validation results</summary>
            <dl className="grid grid-cols-2 gap-1 mt-2 font-mono">{Object.entries(record.fields).map(([key, value]) => <React.Fragment key={key}><dt>{key}</dt><dd>{value ?? "Unknown"}</dd></React.Fragment>)}</dl>
            {record.checks.map((check) => <p key={check.id}>{check.id}: {check.status}</p>)}
            {record.warnings.map((warning) => <p key={warning} className="text-amber-800">{warning}</p>)}
          </details>
        </div>;
      })}
    </div>
    <label className="flex gap-2 text-xs"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />I confirm the selected statements belong to the same business and fiscal period.</label>
    <p className="text-xs text-amber-800" role="status">{error || "Next: review the figures, enter any missing period start/end dates, then confirm to analyze."}</p>
    <button type="button" disabled={!draft || !confirmed} className="px-4 py-2 bg-brand text-white text-xs font-bold rounded-btn disabled:opacity-40" onClick={() => draft && onImport(draft)}>Review selected data in the form</button>
  </section>;
}
