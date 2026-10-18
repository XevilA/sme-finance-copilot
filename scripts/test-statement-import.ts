import assert from "node:assert/strict";
import { StatementRecord, statementDraft, statementWithYear, validateImportedPeriod } from "../src/api/statementImport";

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
assert.throws(() => statementDraft([balance, balance]), /one column/);
assert.throws(() => statementDraft([balance, { ...income, currency: "USD" }]), /THB/);
assert.throws(() => statementDraft([balance, { ...income, sheet: "other business" }]), /same sheet and fiscal year/);
assert.throws(() => statementDraft([balance, { ...income, period: { ...income.period, year: 2018 } }]), /same sheet and fiscal year/);
assert.throws(() => statementDraft([{ ...balance, status: "invalid" }]), /not ready to import/);
assert.throws(() => statementDraft([{ ...balance, status: "empty_template" }]), /not ready to import/);
assert.throws(() => statementDraft([{ ...balance, period: { ...balance.period, year: null } }]), /not ready to import/);
assert.throws(() => statementDraft([
  { ...balance, period: { ...balance.period, periodEnd: "2019-12-31" } },
  { ...income, period: { ...income.period, periodEnd: "2019-09-28" } },
]), /different period end dates/);
assert.equal(statementDraft([{ ...balance, period: { ...balance.period, periodEnd: "2019-12-31" } }]).period_end, "2019-12-31");
const unknownYear = { ...balance, status: "insufficient_data", period: { ...balance.period, year: null } };
assert.equal(statementWithYear(unknownYear, "2562").period.year, 2019);
assert.equal(statementWithYear(unknownYear, "2019").period.year, 2019);
assert.equal(unknownYear.period.year, null, "Source metadata must not be mutated");
assert.equal(statementWithYear(balance, "2026").period.year, 2019, "Known years cannot be relabelled");
assert.equal(statementDraft([statementWithYear(unknownYear, "2562"), income]).statement_year, "2019");
for (const value of ["", "1", "20xx", "2019.5", "9999"]) assert.throws(() => statementWithYear(unknownYear, value));
assert.throws(() => validateImportedPeriod({ statement_year: "2019", period_end: "2026-12-31" }), /period end date must be in fiscal year/);
assert.doesNotThrow(() => validateImportedPeriod({ statement_year: "2019", period_start: "2018-10-01", period_end: "2019-09-30" }));
assert.throws(() => statementDraft([statementWithYear({ ...unknownYear, status: "empty_template" }, "2562")]), /not ready to import/);
console.log("Statement import: matching source selection, unknown fields, dates and unsafe combinations passed.");
