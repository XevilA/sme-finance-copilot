import type { FinancialInput } from "./activeAnalysis";

export type StatementRecord = {
  sheet: string;
  section: "balance_sheet" | "income_statement" | "cash_flow_statement";
  column: string;
  period: { header: string; year: number | null; periodEnd: string | null };
  currency: string | null;
  sourceScale: string;
  fields: Record<string, string | null>;
  status: string;
  missingFields: string[];
  warnings: string[];
  checks: { id: string; status: string }[];
};

export type UploadPreview =
  | { format: "financials"; input: FinancialInput; source: string; persisted: false }
  | { format: "statements"; source: string; statements: StatementRecord[]; warnings: string[]; persisted: false };

// Only FinancialInput fields; source totals and restricted cash stay in preview.
const importable = new Set([
  "assets", "liabilities", "equity", "current_assets", "current_liabilities", "cash_balance",
  "revenue", "total_expenses", "cost_of_goods_sold", "operating_expenses", "interest_expense", "tax_expense", "net_income",
  "operating_cash_flow", "investing_cash_flow", "financing_cash_flow", "capital_expenditure",
]);

/** Only fill an unspecified reporting year; never relabel a known source year. */
export function statementWithYear(record: StatementRecord, value: string): StatementRecord {
  if (record.period.year !== null) return record;
  if (!/^\d{4}$/.test(value.trim())) throw new Error("Enter the fiscal year as a 4-digit AD or Buddhist Era year.");
  const supplied = Number(value);
  const year = supplied >= 2400 ? supplied - 543 : supplied;
  if (year < 1900 || year > 2200) throw new Error("The fiscal year is outside the supported range.");
  return { ...record, period: { ...record.period, year } };
}

export function validateImportedPeriod(draft: Record<string, string>): void {
  if (draft.statement_year && draft.period_end && draft.period_end.slice(0, 4) !== draft.statement_year) {
    throw new Error(`The period end date must be in fiscal year ${draft.statement_year}.`);
  }
}

export function statementDraft(records: StatementRecord[]): Record<string, string> {
  if (!records.length) throw new Error("Select at least one statement to import.");
  const first = records[0];
  const sections = new Set<string>();
  const ends = new Set<string>();
  const draft: Record<string, string> = { currency: "THB", kind: "actual" };
  for (const record of records) {
    if (record.currency !== "THB") throw new Error("Calculations currently support THB only. Select a statement in Thai baht; USD is not converted automatically.");
    if (!record.period.year || ["invalid", "empty_template"].includes(record.status)) throw new Error("This statement is not ready to import. Check its fiscal year and any mismatched totals.");
    if (record.sheet !== first.sheet || record.period.year !== first.period.year) throw new Error("Select statements from the same sheet and fiscal year.");
    if (sections.has(record.section)) throw new Error("Select only one column for each statement type.");
    sections.add(record.section);
    if (record.period.periodEnd) ends.add(record.period.periodEnd);
    for (const [key, value] of Object.entries(record.fields)) {
      if (importable.has(key) && value !== null) draft[key] = value;
    }
  }
  if (ends.size > 1) throw new Error("The selected statements have different period end dates.");
  draft.statement_year = String(first.period.year);
  if (ends.size) draft.period_end = [...ends][0];
  // A year label does not establish the beginning/end of an accounting period.
  // The user supplies missing dates before the backend validates and analyses.
  return draft;
}
