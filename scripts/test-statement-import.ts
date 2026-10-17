import assert from "node:assert/strict";
import { StatementRecord, statementDraft } from "../src/api/statementImport";

const balance: StatementRecord = {
  sheet: "synthetic", section: "balance_sheet", column: "B",
  period: { header: "2019", year: 2019, periodEnd: null }, currency: "THB", sourceScale: "1",
  fields: { assets: "100000", liabilities: "60000", equity: "40000", cash_balance: null, reported_liabilities_and_equity: "100000" },
  status: "ok", missingFields: [], warnings: [], checks: [],
};
const income: StatementRecord = { ...balance, section: "income_statement", column: "C", fields: { revenue: "10000", total_expenses: "6500", net_income: "3500" } };
const draft = statementDraft([balance, income]);
assert.equal(draft.assets, "100000");
assert.equal(draft.net_income, "3500");
assert.equal(draft.kind, "actual");
assert.ok(!("period_start" in draft) && !("period_end" in draft), "Year labels must not invent accounting dates");
assert.ok(!("cash_balance" in draft) && !("reported_liabilities_and_equity" in draft));
assert.throws(() => statementDraft([]));
assert.throws(() => statementDraft([balance, balance]), /หนึ่งคอลัมน์/);
assert.throws(() => statementDraft([balance, { ...income, currency: "USD" }]), /THB/);
assert.throws(() => statementDraft([balance, { ...income, sheet: "other business" }]), /ชีตและปีเดียวกัน/);
assert.throws(() => statementDraft([balance, { ...income, period: { ...income.period, year: 2018 } }]), /ชีตและปีเดียวกัน/);
assert.throws(() => statementDraft([{ ...balance, status: "invalid" }]), /ยังไม่พร้อม/);
assert.throws(() => statementDraft([{ ...balance, status: "empty_template" }]), /ยังไม่พร้อม/);
assert.throws(() => statementDraft([{ ...balance, period: { ...balance.period, year: null } }]), /ยังไม่พร้อม/);
assert.throws(() => statementDraft([
  { ...balance, period: { ...balance.period, periodEnd: "2019-12-31" } },
  { ...income, period: { ...income.period, periodEnd: "2019-09-28" } },
]), /ไม่ตรงกัน/);
assert.equal(statementDraft([{ ...balance, period: { ...balance.period, periodEnd: "2019-12-31" } }]).period_end, "2019-12-31");
console.log("Statement import: matching source selection, unknown fields, dates and unsafe combinations passed.");
