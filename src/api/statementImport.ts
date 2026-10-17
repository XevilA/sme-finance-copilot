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

export function statementDraft(records: StatementRecord[]): Record<string, string> {
  if (!records.length) throw new Error("กรุณาเลือกงบที่ต้องการนำเข้า");
  const first = records[0];
  const sections = new Set<string>();
  const ends = new Set<string>();
  const draft: Record<string, string> = { currency: "THB", kind: "actual" };
  for (const record of records) {
    if (record.currency !== "THB") throw new Error("ระบบคำนวณรองรับ THB กรุณาเลือกงบสกุลเงินบาท ระบบจะไม่แปลง USD เอง");
    if (!record.period.year || ["invalid", "empty_template"].includes(record.status)) throw new Error("งบนี้ยังไม่พร้อมนำเข้า กรุณาตรวจปีและยอดที่ไม่ตรงกันในไฟล์");
    if (record.sheet !== first.sheet || record.period.year !== first.period.year) throw new Error("กรุณาเลือกงบจากชีตและปีเดียวกัน");
    if (sections.has(record.section)) throw new Error("เลือกได้หนึ่งคอลัมน์ต่อประเภทงบ");
    sections.add(record.section);
    if (record.period.periodEnd) ends.add(record.period.periodEnd);
    for (const [key, value] of Object.entries(record.fields)) {
      if (importable.has(key) && value !== null) draft[key] = value;
    }
  }
  if (ends.size > 1) throw new Error("วันสิ้นงวดของงบที่เลือกไม่ตรงกัน");
  if (ends.size) draft.period_end = [...ends][0];
  // A year label does not establish the beginning/end of an accounting period.
  // The user supplies missing dates before the backend validates and analyses.
  return draft;
}
